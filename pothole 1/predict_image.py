from __future__ import annotations

import argparse
from pathlib import Path

from ultralytics import YOLO


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="best.pt")
    parser.add_argument("--source", required=True)
    parser.add_argument("--project", default="runs")
    parser.add_argument("--name", default="predict")
    args = parser.parse_args()

    model_path = Path(args.model)
    source_path = Path(args.source)

    if not model_path.exists():
        raise FileNotFoundError(f"Model not found: {model_path}")
    if not source_path.exists():
        raise FileNotFoundError(f"Image not found: {source_path}")

    model = YOLO(str(model_path))
    model.predict(
        source=str(source_path),
        save=True,
        project=args.project,
        name=args.name,
    )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
