from __future__ import annotations

import argparse
import contextlib
import io
import json
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

from config import CONF_THRESHOLD, IOU_THRESHOLD, MIN_AREA, POST_CONF_THRESHOLD
from services.depth import compute_depth_map_normalized, compute_pothole_depth_difference
from services.detection import YoloSegmentationService
from services.postprocess import PostprocessConfig, filter_and_merge


@dataclass
class Match:
    gt_idx: int
    pred_idx: int
    iou: float


def _polyline_to_mask(points_norm: list[float], *, width: int, height: int) -> np.ndarray:
    if len(points_norm) < 6 or len(points_norm) % 2 != 0:
        return np.zeros((height, width), dtype=np.uint8)

    pts = np.array(points_norm, dtype=np.float32).reshape(-1, 2)
    pts[:, 0] = np.clip(pts[:, 0] * width, 0, width - 1)
    pts[:, 1] = np.clip(pts[:, 1] * height, 0, height - 1)
    pts = pts.astype(np.int32)

    mask = np.zeros((height, width), dtype=np.uint8)
    cv2.fillPoly(mask, [pts], 1)
    return mask


def _load_yolo_seg_labels(label_path: Path, *, width: int, height: int) -> list[np.ndarray]:
    if not label_path.exists():
        return []

    masks: list[np.ndarray] = []
    for line in label_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue

        parts = line.split()
        if len(parts) < 3:
            continue

        points = [float(x) for x in parts[1:]]
        masks.append(_polyline_to_mask(points, width=width, height=height))

    return masks


def _iou(a: np.ndarray, b: np.ndarray) -> float:
    a = a.astype(bool)
    b = b.astype(bool)
    inter = float(np.logical_and(a, b).sum())
    union = float(np.logical_or(a, b).sum())
    return 0.0 if union <= 0 else inter / union


def _greedy_match(gt_masks: list[np.ndarray], pred_masks: list[np.ndarray], *, iou_thr: float) -> list[Match]:
    if not gt_masks or not pred_masks:
        return []

    scores: list[Match] = []
    for gi, g in enumerate(gt_masks):
        for pi, p in enumerate(pred_masks):
            scores.append(Match(gt_idx=gi, pred_idx=pi, iou=_iou(g, p)))

    scores.sort(key=lambda m: m.iou, reverse=True)
    used_g: set[int] = set()
    used_p: set[int] = set()
    matches: list[Match] = []
    for m in scores:
        if m.iou < iou_thr:
            break
        if m.gt_idx in used_g or m.pred_idx in used_p:
            continue
        used_g.add(m.gt_idx)
        used_p.add(m.pred_idx)
        matches.append(m)

    return matches


def _normalize_depth_map(depth: np.ndarray) -> np.ndarray:
    d = depth.astype(np.float32)
    d_min = float(np.nanmin(d))
    d_max = float(np.nanmax(d))
    if d_max - d_min < 1e-6:
        return np.zeros_like(d, dtype=np.float32)
    return (d - d_min) / (d_max - d_min)


def _depth_path_for_image(depths_dir: Path, image_name: str) -> Path:
    prefix = image_name.split("_color")[0]
    return depths_dir / f"{prefix}_depth.npy"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", default=str(Path("PUBLIC POTHOLE DATASET")))
    parser.add_argument("--model", default="best.pt")
    parser.add_argument("--limit", type=int, default=100)
    parser.add_argument("--conf", type=float, default=float(CONF_THRESHOLD))
    parser.add_argument("--post-conf", type=float, default=float(POST_CONF_THRESHOLD))
    parser.add_argument("--min-area", type=int, default=int(MIN_AREA))
    parser.add_argument("--merge-all", action="store_true")
    parser.add_argument("--iou", type=float, default=float(IOU_THRESHOLD))
    parser.add_argument("--out", default="output/verification_report.json")
    parser.add_argument("--include-midas", action="store_true")
    parser.add_argument("--debug", action="store_true", help="Enable verbose logging and optional MiDaS comparison")
    args = parser.parse_args()

    if not bool(args.debug):
        args.include_midas = False

    root = Path(args.dataset)
    images_dir = root / "images"
    labels_dir = root / "labels"
    depths_dir = root / "depths"

    if not images_dir.exists() or not labels_dir.exists() or not depths_dir.exists():
        raise FileNotFoundError("Expected dataset/images, dataset/labels, dataset/depths")

    image_paths = sorted(list(images_dir.glob("*.jpg")) + list(images_dir.glob("*.jpeg")) + list(images_dir.glob("*.png")))
    if not image_paths:
        raise FileNotFoundError(f"No images found in {images_dir}")

    if args.limit and args.limit > 0:
        image_paths = image_paths[: int(args.limit)]

    detector = YoloSegmentationService(model_path=args.model)

    tp = fp = fn = 0
    all_ious: list[float] = []
    depth_abs_errors: list[float] = []
    midas_abs_errors: list[float] = []

    per_image: list[dict] = []

    for img_path in image_paths:
        img = cv2.imread(str(img_path))
        if img is None:
            continue
        h, w = img.shape[:2]

        label_path = labels_dir / f"{img_path.stem}.txt"
        gt_masks = _load_yolo_seg_labels(label_path, width=w, height=h)

        depth_path = _depth_path_for_image(depths_dir, img_path.name)
        if depth_path.exists():
            depth_raw = np.load(depth_path)
            if depth_raw.shape != (h, w):
                depth_raw = cv2.resize(depth_raw, (w, h), interpolation=cv2.INTER_NEAREST)
            depth_norm_gt = _normalize_depth_map(depth_raw)
        else:
            depth_norm_gt = None

        if bool(args.debug):
            det = detector.detect(img_path, conf=float(args.conf), verbose=True)
        else:
            buf = io.StringIO()
            with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(buf):
                det = detector.detect(img_path, conf=float(args.conf), verbose=False)
        cfg = PostprocessConfig(
            conf_threshold=float(args.post_conf),
            min_area_pixels=int(args.min_area),
            merge_all=bool(args.merge_all),
        )
        pred_pp = filter_and_merge(det["potholes"], cfg=cfg)

        pred_masks: list[np.ndarray] = []
        for p in pred_pp:
            m = p.get("mask")
            if m is None:
                continue
            m = (m > 0.5).astype(np.uint8)
            if m.shape != (h, w):
                m = cv2.resize(m, (w, h), interpolation=cv2.INTER_NEAREST)
            pred_masks.append(m)

        matches = _greedy_match(gt_masks, pred_masks, iou_thr=float(args.iou))

        tp += len(matches)
        fp += max(0, len(pred_masks) - len(matches))
        fn += max(0, len(gt_masks) - len(matches))

        matched_depths: list[dict] = []
        if depth_norm_gt is not None:
            for m in matches:
                gmask = gt_masks[m.gt_idx]
                pmask = pred_masks[m.pred_idx]
                gdm = compute_pothole_depth_difference(depth_norm=depth_norm_gt, mask=gmask)
                pdm = compute_pothole_depth_difference(depth_norm=depth_norm_gt, mask=pmask)
                err = abs(float(gdm["depth_difference"]) - float(pdm["depth_difference"]))
                depth_abs_errors.append(float(err))
                all_ious.append(float(m.iou))
                matched_depths.append(
                    {
                        "gt_idx": int(m.gt_idx),
                        "pred_idx": int(m.pred_idx),
                        "iou": float(m.iou),
                        "gt_depth": float(gdm["depth_difference"]),
                        "pred_depth_on_gt": float(pdm["depth_difference"]),
                        "abs_error": float(err),
                    }
                )

        if bool(args.include_midas) and pred_masks:
            if bool(args.debug):
                depth_info = compute_depth_map_normalized(image_path=img_path, output_dir="output")
            else:
                buf = io.StringIO()
                with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(buf):
                    depth_info = compute_depth_map_normalized(image_path=img_path, output_dir="output")
            depth_norm_midas = depth_info["depth_norm"]
            if depth_norm_midas.shape != (h, w):
                depth_norm_midas = cv2.resize(depth_norm_midas, (w, h), interpolation=cv2.INTER_CUBIC)

            if depth_norm_gt is not None:
                for m in matches:
                    gmask = gt_masks[m.gt_idx]
                    pmask = pred_masks[m.pred_idx]
                    gdm = compute_pothole_depth_difference(depth_norm=depth_norm_gt, mask=gmask)
                    pmidas = compute_pothole_depth_difference(depth_norm=depth_norm_midas, mask=pmask)
                    err = abs(float(gdm["depth_difference"]) - float(pmidas["depth_difference"]))
                    midas_abs_errors.append(float(err))

        per_image.append(
            {
                "image": str(img_path),
                "gt_count": int(len(gt_masks)),
                "pred_count": int(len(pred_masks)),
                "matched": matched_depths,
            }
        )

    precision = float(tp) / float(tp + fp) if (tp + fp) > 0 else 0.0
    recall = float(tp) / float(tp + fn) if (tp + fn) > 0 else 0.0
    mean_iou = float(np.mean(all_ious)) if all_ious else 0.0
    mean_depth_abs_error = float(np.mean(depth_abs_errors)) if depth_abs_errors else 0.0
    mean_midas_abs_error = float(np.mean(midas_abs_errors)) if midas_abs_errors else 0.0

    report = {
        "dataset": str(root),
        "n_images": int(len(image_paths)),
        "conf": float(args.conf),
        "min_area": int(args.min_area),
        "merge_all": bool(args.merge_all),
        "iou_thr": float(args.iou),
        "metrics": {
            "tp": int(tp),
            "fp": int(fp),
            "fn": int(fn),
            "precision": precision,
            "recall": recall,
            "mean_iou": mean_iou,
            "mean_abs_depth_error_on_gt": mean_depth_abs_error,
            "mean_abs_depth_error_midas_vs_gt": mean_midas_abs_error if bool(args.include_midas) else None,
            "n_matched_with_depth": int(len(depth_abs_errors)),
        },
        "per_image": per_image,
    }

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print(json.dumps(report["metrics"], indent=2))
    if bool(args.debug):
        print(f"Saved verification report: {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
