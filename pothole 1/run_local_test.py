import argparse
import contextlib
import io
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

from config import CONF_THRESHOLD, IOU_THRESHOLD, MIN_AREA, POST_CONF_THRESHOLD
from services.detection import YoloSegmentationService
from services.depth import compute_depth_map_normalized, compute_pothole_depth_difference
from services.postprocess import PostprocessConfig, filter_and_merge


@dataclass
class Match:
    gt_idx: int
    pred_idx: int
    iou: float


def _apply_mask_overlay(img_bgr: np.ndarray, mask: np.ndarray, color_bgr: tuple[int, int, int], alpha: float) -> None:
    if alpha <= 0:
        return
    m = mask.astype(bool)
    if not m.any():
        return
    overlay = np.zeros_like(img_bgr, dtype=np.uint8)
    overlay[:, :] = np.array(color_bgr, dtype=np.uint8)
    img_bgr[m] = (img_bgr[m].astype(np.float32) * (1.0 - alpha) + overlay[m].astype(np.float32) * alpha).astype(
        np.uint8
    )


def _save_debug_overlay(
    *,
    img_path: Path,
    img_bgr: np.ndarray,
    gt_masks: list[np.ndarray],
    pred_masks: list[np.ndarray],
    matches: list[Match],
    pred_depths: list[float] | None,
    out_dir: Path,
) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    canvas = img_bgr.copy()

    # GT in red, pred in green
    for g in gt_masks:
        _apply_mask_overlay(canvas, g, (0, 0, 255), alpha=0.35)
    for p in pred_masks:
        _apply_mask_overlay(canvas, p, (0, 255, 0), alpha=0.25)

    # Overlap (yellow)
    if gt_masks and pred_masks:
        gt_union = np.zeros(gt_masks[0].shape, dtype=np.uint8)
        for g in gt_masks:
            gt_union = np.logical_or(gt_union.astype(bool), g.astype(bool)).astype(np.uint8)
        pr_union = np.zeros(pred_masks[0].shape, dtype=np.uint8)
        for p in pred_masks:
            pr_union = np.logical_or(pr_union.astype(bool), p.astype(bool)).astype(np.uint8)
        overlap = np.logical_and(gt_union.astype(bool), pr_union.astype(bool)).astype(np.uint8)
        _apply_mask_overlay(canvas, overlap, (0, 255, 255), alpha=0.35)

    # draw match IoU labels near matched GT centroid
    for m in matches:
        g = gt_masks[m.gt_idx]
        ys, xs = np.where(g.astype(bool))
        if xs.size == 0:
            continue
        cx = int(np.mean(xs))
        cy = int(np.mean(ys))
        cv2.putText(
            canvas,
            f"GT{m.gt_idx+1}-P{m.pred_idx+1} IoU {m.iou:.2f}",
            (cx, cy),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            (255, 255, 255),
            2,
            cv2.LINE_AA,
        )

    # optional depth labels near predicted centroids
    if pred_depths is not None:
        for i, p in enumerate(pred_masks):
            if i >= len(pred_depths):
                break
            ys, xs = np.where(p.astype(bool))
            if xs.size == 0:
                continue
            cx = int(np.mean(xs))
            cy = int(np.mean(ys))
            cv2.putText(
                canvas,
                f"D {float(pred_depths[i]):.3f}",
                (cx, cy + 18),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.55,
                (255, 255, 255),
                2,
                cv2.LINE_AA,
            )

    # header
    cv2.putText(
        canvas,
        f"GT:{len(gt_masks)} Pred:{len(pred_masks)} Matched:{len(matches)}",
        (10, 25),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.8,
        (255, 255, 255),
        2,
        cv2.LINE_AA,
    )

    out_path = out_dir / f"{img_path.stem}_debug.jpg"
    cv2.imwrite(str(out_path), canvas)


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

        # YOLO-seg format: class x1 y1 x2 y2 ...
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


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--dataset",
        default=str(Path("PUBLIC POTHOLE DATASET")),
        help="Path to PUBLIC POTHOLE DATASET folder",
    )
    parser.add_argument("--limit", type=int, default=50, help="How many images to evaluate")
    parser.add_argument("--iou", type=float, default=float(IOU_THRESHOLD), help="IoU threshold for a match")
    parser.add_argument("--conf", type=float, default=float(CONF_THRESHOLD), help="Model inference confidence")
    parser.add_argument("--post-conf", type=float, default=float(POST_CONF_THRESHOLD), help="Postprocess confidence filter")
    parser.add_argument("--model", default=None, help="Optional path to best.pt")
    parser.add_argument("--debug", action="store_true", help="Enable debug overlays, debug depth, and verbose logging")
    parser.add_argument("--debug-dir", default=None, help="If set, saves GT vs Pred overlay images into this folder")
    parser.add_argument("--debug-n", type=int, default=20, help="How many images to save overlays for")
    parser.add_argument(
        "--debug-depth",
        action="store_true",
        help="If set, compute MiDaS depth for debug images and annotate per-prediction depth_difference",
    )
    args = parser.parse_args()

    if not bool(args.debug):
        args.debug_dir = None
        args.debug_depth = False

    root = Path(args.dataset)
    images_dir = root / "images"
    labels_dir = root / "labels"

    if not images_dir.exists() or not labels_dir.exists():
        raise FileNotFoundError("Expected dataset/images and dataset/labels")

    detector = YoloSegmentationService(model_path=args.model)

    image_paths = sorted(images_dir.glob("*.jpg")) + sorted(images_dir.glob("*.png")) + sorted(images_dir.glob("*.jpeg"))
    if not image_paths:
        raise FileNotFoundError("No images found in dataset/images")

    image_paths = image_paths[: max(0, int(args.limit))] if args.limit else image_paths

    tp = fp = fn = 0
    ious: list[float] = []
    area_abs_errors: list[float] = []

    debug_dir = Path(args.debug_dir) if args.debug_dir else None
    debug_saved = 0

    for img_path in image_paths:
        img = cv2.imread(str(img_path))
        if img is None:
            continue
        h, w = img.shape[:2]

        label_path = labels_dir / (img_path.stem + ".txt")
        gt_masks = _load_yolo_seg_labels(label_path, width=w, height=h)

        if bool(args.debug):
            det = detector.detect(img_path, conf=float(args.conf), verbose=True)
        else:
            buf = io.StringIO()
            with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(buf):
                det = detector.detect(img_path, conf=float(args.conf), verbose=False)
        cfg = PostprocessConfig(
            conf_threshold=float(args.post_conf),
            min_area_pixels=int(MIN_AREA),
            merge_all=False,
        )
        pred_pp = filter_and_merge(det["potholes"], cfg=cfg)
        pred = [p for p in pred_pp if p.get("mask") is not None]

        pred_masks: list[np.ndarray] = []
        pred_areas: list[float] = []
        for p in pred:
            m = (p["mask"] > 0.5).astype(np.uint8)
            if m.shape != (h, w):
                m = cv2.resize(m, (w, h), interpolation=cv2.INTER_NEAREST)
            pred_masks.append(m)
            pred_areas.append(float(m.sum()))

        matches = _greedy_match(gt_masks, pred_masks, iou_thr=float(args.iou))

        pred_depths: list[float] | None = None
        if args.debug_dir and debug_saved < int(args.debug_n):
            pred_depths = None
            if args.debug_depth:
                if bool(args.debug):
                    depth_info = compute_depth_map_normalized(image_path=img_path, output_dir="output")
                else:
                    buf = io.StringIO()
                    with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(buf):
                        depth_info = compute_depth_map_normalized(image_path=img_path, output_dir="output")

                depth_norm = depth_info["depth_norm"]
                pred_depths = []
                for pm in pred_masks:
                    depth_metrics = compute_pothole_depth_difference(depth_norm=depth_norm, mask=pm)
                    pred_depths.append(float(depth_metrics["depth_difference"]))

        if debug_dir is not None and debug_saved < int(args.debug_n):
            _save_debug_overlay(
                img_path=img_path,
                img_bgr=img,
                gt_masks=gt_masks,
                pred_masks=pred_masks,
                matches=matches,
                pred_depths=pred_depths,
                out_dir=debug_dir,
            )
            debug_saved += 1

        tp += len(matches)
        fp += max(0, len(pred_masks) - len(matches))
        fn += max(0, len(gt_masks) - len(matches))

        for m in matches:
            ious.append(m.iou)
            gt_area = float(gt_masks[m.gt_idx].sum())
            pr_area = float(pred_masks[m.pred_idx].sum())
            area_abs_errors.append(abs(pr_area - gt_area))

    precision = (tp / (tp + fp)) if (tp + fp) else 0.0
    recall = (tp / (tp + fn)) if (tp + fn) else 0.0
    mean_iou = float(np.mean(ious)) if ious else 0.0
    mean_area_abs_error = float(np.mean(area_abs_errors)) if area_abs_errors else 0.0

    print("images_evaluated:", len(image_paths))
    print("tp:", tp, "fp:", fp, "fn:", fn)
    print("precision:", round(precision, 4), "recall:", round(recall, 4))
    print("mean_iou:", round(mean_iou, 4))
    print("mean_abs_area_error_pixels:", round(mean_area_abs_error, 2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
