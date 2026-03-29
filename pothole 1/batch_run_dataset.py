from __future__ import annotations

import argparse
import json
from pathlib import Path

from config import CONF_THRESHOLD, MIN_AREA
from services.detection import YoloSegmentationService
from services.pipeline import process_image


def _iter_images(images_dir: Path) -> list[Path]:
    exts = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
    paths = [p for p in images_dir.rglob("*") if p.is_file() and p.suffix.lower() in exts]
    paths.sort()
    return paths


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--dataset",
        default=r"PUBLIC POTHOLE DATASET",
        help="Path to dataset root (must contain an 'images' folder)",
    )
    parser.add_argument("--images-subdir", default="images")
    parser.add_argument("--model", default="best.pt")
    parser.add_argument("--limit", type=int, default=10)
    parser.add_argument("--conf", type=float, default=float(CONF_THRESHOLD))
    parser.add_argument("--min-area", type=int, default=int(MIN_AREA))
    parser.add_argument("--merge-all", action="store_true")
    parser.add_argument("--output", default="output")
    args = parser.parse_args()

    dataset_root = Path(args.dataset)
    images_dir = dataset_root / args.images_subdir
    if not images_dir.exists():
        raise FileNotFoundError(f"Images dir not found: {images_dir}")

    out_dir = Path(args.output)
    out_dir.mkdir(parents=True, exist_ok=True)

    image_paths = _iter_images(images_dir)
    if args.limit and args.limit > 0:
        image_paths = image_paths[: int(args.limit)]

    detector = YoloSegmentationService(model_path=args.model)

    results: list[dict] = []
    for i, img_path in enumerate(image_paths, start=1):
        potholes = process_image(
            img_path,
            model_path=args.model,
            detector=detector,
            input_dir=images_dir,
            output_dir=out_dir,
            save_visualization=True,
            conf_threshold=float(args.conf),
            min_area_pixels=int(args.min_area),
            merge_all=bool(args.merge_all),
        )

        print(f"[{i}/{len(image_paths)}] {img_path.name}: potholes={len(potholes)}")
        for p in potholes:
            print(
                f"  id={p.get('id')} area_px={float(p.get('area_pixels', 0.0)):.0f} "
                f"area_m2={float(p.get('area_m2', 0.0)):.4f} "
                f"depth={float(p.get('depth', 0.0)):.3f} conf={float(p.get('confidence', 0.0)):.2f}"
            )

        results.append({"image": str(img_path), "potholes": potholes})

    summary_path = out_dir / "batch_results.json"
    summary_path.write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(f"\nSaved batch summary: {summary_path}")
    print(f"Saved output images to: {out_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
