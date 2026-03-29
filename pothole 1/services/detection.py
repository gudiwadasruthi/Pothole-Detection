from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np
from ultralytics import YOLO


def _resolve_model_path(model_path: str | Path | None) -> Path:
    if model_path is not None:
        p = Path(model_path)
        if p.exists():
            return p

    candidates = [
        Path("best.pt"),
        Path("models") / "best.pt",
    ]
    for c in candidates:
        if c.exists():
            return c
    raise FileNotFoundError("best.pt not found (expected at ./best.pt or ./models/best.pt)")


class YoloSegmentationService:
    def __init__(self, model_path: str | Path | None = None):
        self.model_path = _resolve_model_path(model_path)
        self.model = YOLO(str(self.model_path))

    def detect(self, image_path: str | Path, *, conf: float | None = None, verbose: bool = True) -> dict:
        img_path = Path(image_path)
        if not img_path.exists():
            raise FileNotFoundError(f"Image not found: {img_path}")

        if conf is None:
            res = self.model(str(img_path), verbose=bool(verbose))[0]
        else:
            res = self.model(str(img_path), conf=float(conf), verbose=bool(verbose))[0]

        masks = None
        if res.masks is not None and res.masks.data is not None:
            masks = res.masks.data.detach().cpu().numpy().astype(np.float32)

        boxes = []
        if res.boxes is not None:
            for i, b in enumerate(res.boxes):
                xyxy = b.xyxy[0].detach().cpu().numpy().tolist()
                conf = float(b.conf[0].detach().cpu().numpy())
                boxes.append({"id": i + 1, "xyxy": xyxy, "confidence": conf})

        potholes = []
        if masks is not None:
            for i, m in enumerate(masks):
                area = float((m > 0.5).sum())
                conf = boxes[i]["confidence"] if i < len(boxes) else float(res.boxes.conf[i]) if res.boxes is not None else 0.0
                xyxy = boxes[i]["xyxy"] if i < len(boxes) else None
                potholes.append(
                    {
                        "id": i + 1,
                        "area": area,
                        "confidence": float(conf),
                        "mask": m,
                        "box": xyxy,
                    }
                )
        else:
            for b in boxes:
                potholes.append({"id": b["id"], "area": 0.0, "confidence": b["confidence"], "mask": None, "box": b["xyxy"]})

        return {"image_path": str(img_path), "potholes": potholes, "raw": res}


def render_output(
    *,
    image_path: str | Path,
    potholes: list[dict],
    output_path: str | Path,
    depth_norm: np.ndarray | None = None,
) -> None:
    img = cv2.imread(str(image_path))
    if img is None:
        raise ValueError("Failed to read input image")

    overlay = img.copy()

    for p in potholes:
        pid = int(p["id"])
        conf = float(p["confidence"])
        box = p.get("box")
        mask = p.get("mask")
        area = float(p.get("area", 0.0))
        depth_val = p.get("depth")
        depth_text = "" if depth_val is None else f" D:{float(depth_val):.3f}"

        if mask is not None:
            m = (mask > 0.5).astype(np.uint8)
            m = cv2.resize(m, (img.shape[1], img.shape[0]), interpolation=cv2.INTER_NEAREST)
            color = np.array([0, 255, 0], dtype=np.uint8)
            overlay[m == 1] = (0.5 * overlay[m == 1] + 0.5 * color).astype(np.uint8)

        if box is not None:
            x1, y1, x2, y2 = map(int, box)
            cv2.rectangle(overlay, (x1, y1), (x2, y2), (0, 255, 0), 2)
            cv2.putText(
                overlay,
                f"ID {pid} C:{conf:.2f} A:{int(area)}{depth_text}",
                (x1, max(0, y1 - 10)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (0, 255, 0),
                2,
            )
        else:
            # If no bbox, still place a label somewhere on the mask.
            if mask is not None:
                ys, xs = np.where(m == 1)
                if xs.size:
                    x1 = int(np.min(xs))
                    y1 = int(np.min(ys))
                    cv2.putText(
                        overlay,
                        f"ID {pid} C:{conf:.2f} A:{int(area)}{depth_text}",
                        (x1, max(0, y1 - 10)),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.6,
                        (0, 255, 0),
                        2,
                    )

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(output_path), overlay)
