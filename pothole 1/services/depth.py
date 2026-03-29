from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np

from utils.pfm_reader import read_pfm
from models.midas.run import run_midas


def _iqr_filter(values: np.ndarray) -> np.ndarray:
    if values.size == 0:
        return values
    q1 = np.quantile(values, 0.25)
    q3 = np.quantile(values, 0.75)
    iqr = q3 - q1
    low = q1 - 1.5 * iqr
    high = q3 + 1.5 * iqr
    return values[(values >= low) & (values <= high)]


def compute_depth_map_normalized(
    *,
    image_path: str | Path,
    output_dir: str | Path = "output",
) -> dict:
    img_path = Path(image_path)
    if not img_path.exists():
        raise FileNotFoundError(f"Image not found: {img_path}")

    img_bgr = cv2.imread(str(img_path))
    if img_bgr is None:
        raise ValueError("Failed to read image")

    img_resized = cv2.resize(img_bgr, (384, 384), interpolation=cv2.INTER_AREA)

    output_dir = Path(output_dir)
    pfm_path = output_dir / "depth" / (img_path.stem + ".pfm")
    run_midas(image_bgr=img_resized, pfm_output_path=pfm_path)

    depth_map, _ = read_pfm(pfm_path)
    if depth_map.ndim == 3:
        depth_map = depth_map[:, :, 0]

    d = depth_map.astype(np.float32)
    d_min = float(np.nanmin(d))
    d_max = float(np.nanmax(d))
    if d_max - d_min < 1e-6:
        d_norm = np.zeros_like(d)
    else:
        d_norm = (d - d_min) / (d_max - d_min)

    return {
        "depth_norm": d_norm,
        "pfm_path": str(pfm_path),
        "size": (384, 384),
    }


def compute_pothole_depth_difference(
    *,
    depth_norm: np.ndarray,
    mask: np.ndarray,
) -> dict:
    if depth_norm.ndim != 2:
        raise ValueError("depth_norm must be 2D")

    m = (mask > 0.5).astype(np.uint8)
    if m.shape != depth_norm.shape:
        m = cv2.resize(m, (depth_norm.shape[1], depth_norm.shape[0]), interpolation=cv2.INTER_NEAREST)

    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11))
    dil = cv2.dilate(m, k, iterations=1)
    ring = ((dil == 1) & (m == 0)).astype(np.uint8)

    pothole_pixels = depth_norm[m == 1]
    road_pixels = depth_norm[ring == 1]
    if road_pixels.size == 0:
        road_pixels = depth_norm[m == 0]

    def trim(values: np.ndarray, *, low_q: float = 0.10, high_q: float = 0.90) -> np.ndarray:
        if values.size == 0:
            return values
        lo = float(np.quantile(values, low_q))
        hi = float(np.quantile(values, high_q))
        if hi <= lo:
            return values
        return values[(values >= lo) & (values <= hi)]

    pothole_pixels = _iqr_filter(trim(pothole_pixels))
    road_pixels = _iqr_filter(trim(road_pixels))

    pothole_depth = float(np.mean(pothole_pixels)) if pothole_pixels.size else 0.0
    road_depth = float(np.mean(road_pixels)) if road_pixels.size else 0.0
    depth_difference = float(road_depth - pothole_depth)

    return {
        "pothole_depth": pothole_depth,
        "road_depth": road_depth,
        "depth_difference": depth_difference,
    }
