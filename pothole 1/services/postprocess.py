from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np

from config import MERGE_IOU_THRESHOLD, MIN_AREA, POST_CONF_THRESHOLD


@dataclass
class PostprocessConfig:
    conf_threshold: float = POST_CONF_THRESHOLD
    min_area_pixels: int = MIN_AREA
    morph_kernel: int = 5
    morph_iterations: int = 1
    merge_all: bool = False
    merge_iou_threshold: float = MERGE_IOU_THRESHOLD
    compactness_min: float = 0.0


def _to_binary_mask(mask: np.ndarray, *, threshold: float = 0.5) -> np.ndarray:
    return (mask > threshold).astype(np.uint8)


def smooth_mask(mask: np.ndarray, *, kernel_size: int = 5, iterations: int = 1) -> np.ndarray:
    if kernel_size <= 1 or iterations <= 0:
        return mask
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size, kernel_size))
    m = mask.copy()
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, k, iterations=iterations)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, k, iterations=iterations)
    return m


def _mask_iou(a: np.ndarray, b: np.ndarray) -> float:
    a = a.astype(bool)
    b = b.astype(bool)
    inter = float(np.logical_and(a, b).sum())
    union = float(np.logical_or(a, b).sum())
    return 0.0 if union <= 0 else inter / union


def _mask_compactness(mask: np.ndarray) -> float:
    m = mask.astype(np.uint8)
    area = float(m.sum())
    if area <= 0:
        return 0.0

    contours, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return 0.0

    perim = 0.0
    for c in contours:
        perim += float(cv2.arcLength(c, True))
    if perim <= 1e-6:
        return 0.0
    return float(area / (perim * perim))


def _passes_adaptive_compactness(*, area: int, compactness: float) -> bool:
    if area < 3000:
        return compactness >= 0.006
    if area < 8000:
        return compactness >= 0.004
    return compactness >= 0.002


def _merge_overlapping_masks(potholes: list[dict], *, iou_thr: float) -> list[dict]:
    if not potholes:
        return []

    masks: list[np.ndarray] = []
    for p in potholes:
        m = p.get("mask")
        if m is None:
            masks.append(None)  # type: ignore[arg-type]
        else:
            masks.append(m.astype(np.uint8))

    n = len(potholes)
    parent = list(range(n))

    def find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a: int, b: int) -> None:
        ra = find(a)
        rb = find(b)
        if ra != rb:
            parent[rb] = ra

    for i in range(n):
        if masks[i] is None:
            continue
        for j in range(i + 1, n):
            if masks[j] is None:
                continue
            if _mask_iou(masks[i], masks[j]) > float(iou_thr):
                union(i, j)

    groups: dict[int, list[int]] = {}
    for i in range(n):
        groups.setdefault(find(i), []).append(i)

    merged: list[dict] = []
    for _, idxs in groups.items():
        if len(idxs) == 1:
            merged.append(potholes[idxs[0]])
            continue

        combined = np.zeros_like(potholes[idxs[0]]["mask"], dtype=np.uint8)
        confs: list[float] = []
        for k in idxs:
            combined = np.logical_or(combined.astype(bool), potholes[k]["mask"].astype(bool)).astype(np.uint8)
            confs.append(float(potholes[k].get("confidence", 0.0)))

        merged.append(
            {
                **potholes[idxs[0]],
                "mask": combined,
                "area": float(combined.sum()),
                "confidence": float(max(confs)) if confs else 0.0,
                "box": None,
            }
        )

    return merged


def filter_and_merge(potholes: list[dict], *, cfg: PostprocessConfig) -> list[dict]:
    kept: list[dict] = []

    for p in potholes:
        conf = float(p.get("confidence", 0.0))
        if conf < cfg.conf_threshold:
            continue

        mask = p.get("mask")
        if mask is None:
            box = p.get("box")
            if box is not None:
                x1, y1, x2, y2 = box
                area = int((x2 - x1) * (y2 - y1))
                if area >= int(cfg.min_area_pixels):
                    kept.append({**p, "area": float(area)})
            continue

        m = _to_binary_mask(mask)
        area = int(m.sum())
        if area < int(cfg.min_area_pixels):
            continue

        m = smooth_mask(m, kernel_size=int(cfg.morph_kernel), iterations=int(cfg.morph_iterations))
        area = int(m.sum())
        if area < int(cfg.min_area_pixels):
            continue

        compactness = _mask_compactness(m)
        if not _passes_adaptive_compactness(area=area, compactness=float(compactness)):
            continue

        kept.append(
            {
                **p,
                "mask": m,
                "area": float(area),
            }
        )

    if not kept:
        return []

    if not cfg.merge_all and float(cfg.merge_iou_threshold) > 0:
        kept = _merge_overlapping_masks(kept, iou_thr=float(cfg.merge_iou_threshold))

    if not cfg.merge_all:
        # Reassign IDs sequentially
        out: list[dict] = []
        for i, p in enumerate(kept, start=1):
            out.append({**p, "id": i})
        return out

    # Merge all kept masks into a single pothole
    combined = np.zeros_like(kept[0]["mask"], dtype=np.uint8)
    confs = []
    for p in kept:
        combined = np.logical_or(combined.astype(bool), p["mask"].astype(bool)).astype(np.uint8)
        confs.append(float(p.get("confidence", 0.0)))

    combined = smooth_mask(combined, kernel_size=int(cfg.morph_kernel), iterations=int(cfg.morph_iterations))
    area = float(combined.sum())
    confidence = float(max(confs)) if confs else 0.0

    return [
        {
            "id": 1,
            "area": area,
            "confidence": confidence,
            "mask": combined,
            "box": None,
        }
    ]
