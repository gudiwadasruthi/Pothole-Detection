import argparse
from pathlib import Path

from ultralytics import YOLO
import matplotlib.pyplot as plt
import cv2


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="best.pt")
    parser.add_argument("--source", default="test.jpeg")
    args = parser.parse_args()

    model_path = Path(args.model)
    image_path = Path(args.source)

    if not model_path.exists():
        raise FileNotFoundError(f"Model not found: {model_path.resolve()}")
    if not image_path.exists():
        raise FileNotFoundError(f"Image not found: {image_path.resolve()}")

    # load model
    model = YOLO(str(model_path))

    # run prediction
    results = model(str(image_path))[0]

    # read image using OpenCV
    img = cv2.imread(str(image_path))

    # draw bounding boxes + IDs
    for i, box in enumerate(results.boxes):
        x1, y1, x2, y2 = map(int, box.xyxy[0])
        conf = float(box.conf[0])

        label = f"ID {i+1} pothole {conf:.2f}"

        # draw rectangle
        cv2.rectangle(img, (x1, y1), (x2, y2), (0, 255, 0), 2)

        # draw label
        cv2.putText(
            img,
            label,
            (x1, y1 - 10),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (0, 255, 0),
            2
        )

    # show image
    cv2.imshow("Detection with IDs", img)
    cv2.waitKey(0)
    cv2.destroyAllWindows()

    # segmentation + area (same as before)
    if results.masks is not None:
        masks = results.masks.data

        for i, m in enumerate(masks):
            mask = m.cpu().numpy()
            area = mask.sum()

            print(f"Pothole ID {i+1} area (pixels):", area)

            plt.imshow(mask, cmap="gray")
            plt.title(f"Pothole ID {i+1} Mask")
            plt.show()
    else:
        print("No pothole detected")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())