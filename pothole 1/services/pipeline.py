from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np

from database.db import (
    get_or_create_global_pothole,
    insert_image_run,
    insert_pothole_data,
    init_db,
    update_image_run_outputs,
)
from config import CONF_THRESHOLD, MERGE_IOU_THRESHOLD, METERS_PER_PIXEL, MIN_AREA, POST_CONF_THRESHOLD
from services.cost import calculate_cost
from services.depth import compute_depth_map_normalized, compute_pothole_depth_difference
from services.detection import YoloSegmentationService, render_output
from services.postprocess import PostprocessConfig, filter_and_merge


def _mask_hu_signature(mask: np.ndarray) -> list[float] | None:
    m = (mask > 0.5).astype(np.uint8)
    if m.ndim != 2:
        return None
    if int(m.sum()) <= 0:
        return None

    contours, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None
    cnt = max(contours, key=cv2.contourArea)
    if cv2.contourArea(cnt) <= 0:
        return None

    mu = cv2.moments(cnt)
    hu = cv2.HuMoments(mu).flatten().astype(np.float64)
    hu = -np.sign(hu) * np.log10(np.abs(hu) + 1e-30)
    return [float(x) for x in hu.tolist()]


def process_image(
    image_path: str | Path,
    *,
    model_path: str | Path | None = None,
    detector: YoloSegmentationService | None = None,
    input_dir: str | Path = "input",
    output_dir: str | Path = "output",
    save_visualization: bool = True,
    lat: float | None = None,
    lon: float | None = None,
    conf_threshold: float = CONF_THRESHOLD,
    post_conf_threshold: float = POST_CONF_THRESHOLD,
    min_area_pixels: int = MIN_AREA,
    merge_all: bool = False,
) -> list[dict]:
    init_db()

    output_dir = Path(output_dir)

    img_path = Path(image_path)
    if not img_path.exists():
        raise FileNotFoundError(f"Image not found: {img_path}")

    image_id = f"IMG_{uuid.uuid4().hex[:12]}"
    insert_image_run(
        image_id=image_id,
        filename=img_path.name,
        created_at=datetime.now(timezone.utc).isoformat(),
        input_image=img_path.read_bytes(),
        lat=float(lat) if lat is not None else None,
        lon=float(lon) if lon is not None else None,
    )

    if detector is None:
        detector = YoloSegmentationService(model_path=model_path)
    det = detector.detect(img_path, conf=float(conf_threshold))

    cfg = PostprocessConfig(
        conf_threshold=float(post_conf_threshold),
        min_area_pixels=int(min_area_pixels),
        merge_iou_threshold=float(MERGE_IOU_THRESHOLD),
        merge_all=bool(merge_all),
    )
    potholes_pp = filter_and_merge(det["potholes"], cfg=cfg)

    pothole_results: list[dict] = []
    ts = datetime.now(timezone.utc).isoformat()

    depth_norm = None
    if potholes_pp:
        depth_info = compute_depth_map_normalized(image_path=img_path, output_dir=output_dir)
        depth_norm = depth_info["depth_norm"]

    potholes_for_render: list[dict] = []

    for p in potholes_pp:
        pid = int(p["id"])
        area = float(p["area"])
        conf = float(p["confidence"])

        area_m2 = area * (float(METERS_PER_PIXEL) ** 2)

        depth = 0.0
        if p.get("mask") is not None and depth_norm is not None:
            depth_metrics = compute_pothole_depth_difference(depth_norm=depth_norm, mask=p["mask"])
            raw_depth = float(depth_metrics["depth_difference"])
            
            # Ensure depth is always positive
            raw_depth = abs(raw_depth)
            
            # Apply minimum depth thresholds based on area and confidence
            area_m2 = area * (float(METERS_PER_PIXEL) ** 2)
            conf = float(p["confidence"])
            
            # Minimum depth based on pothole size (larger potholes should have more depth)
            min_depth_by_area = max(0.03, area_m2 * 0.1)  # At least 3cm, scaled by area
            
            # Minimum depth based on confidence (higher confidence = more reliable depth)
            min_depth_by_conf = 0.02 if conf > 0.8 else 0.03 if conf > 0.6 else 0.04
            
            # Take the maximum of actual depth and calculated minimums
            depth = max(raw_depth, min_depth_by_area, min_depth_by_conf)
            
            # Cap maximum reasonable depth to 15cm
            depth = min(depth, 0.15)

        pothole_global_id: str | None = None
        if lat is not None and lon is not None and p.get("mask") is not None:
            hu = _mask_hu_signature(p["mask"])
            pothole_global_id = get_or_create_global_pothole(
                lat=float(lat),
                lon=float(lon),
                created_at=ts,
                area_m2=float(area_m2),
                depth=float(depth),
                hu=hu,
            )

        potholes_for_render.append({**p, "depth": depth})

        insert_pothole_data(
            image_id=image_id,
            image_path=str(Path(input_dir) / img_path.name) if str(img_path).startswith(str(Path(input_dir))) else str(img_path),
            pothole_id=pid,
            pothole_global_id=pothole_global_id,
            lat=float(lat) if lat is not None else None,
            lon=float(lon) if lon is not None else None,
            area=area,
            confidence=conf,
            depth=depth,
            timestamp=ts,
        )

        pothole_results.append(
            {
                "image_id": image_id,
                "id": pid,
                "pothole_global_id": pothole_global_id,
                "area_pixels": area,
                "area_m2": round(float(area_m2), 4),
                "depth": depth,
                "confidence": conf,
            }
        )

        # Calculate repair cost
        cost_data = calculate_cost(area_m2=area_m2, depth=depth)
        pothole_results[-1].update(cost_data)

    if save_visualization:
        out_img = Path(output_dir) / (img_path.stem + "_out.jpg")
        render_output(image_path=img_path, potholes=potholes_for_render, output_path=out_img, depth_norm=depth_norm)

    out_json = Path(output_dir) / (img_path.stem + "_out.json")
    out_json.parent.mkdir(parents=True, exist_ok=True)
    try:
        payload_obj = {"image_id": image_id, "filename": img_path.name, "potholes": pothole_results}
        payload = json.dumps(payload_obj, indent=2)
        out_json.write_text(payload, encoding="utf-8")
        out_img_bytes = None
        if save_visualization:
            out_img_bytes = Path(output_dir, img_path.stem + "_out.jpg").read_bytes()
        update_image_run_outputs(image_id=image_id, output_json=payload, output_image=out_img_bytes)
    except Exception as e:
        raise RuntimeError(f"Failed to write JSON output to: {out_json}") from e

    return pothole_results
