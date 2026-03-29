from __future__ import annotations

import re
from pathlib import Path

import numpy as np


def read_pfm(path: str | Path) -> tuple[np.ndarray, float]:
    p = Path(path)
    with p.open("rb") as f:
        header = f.readline().decode("ascii").rstrip()
        if header not in {"PF", "Pf"}:
            raise ValueError("Not a PFM file")

        dims_line = f.readline().decode("ascii").strip()
        while dims_line.startswith("#"):
            dims_line = f.readline().decode("ascii").strip()
        m = re.match(r"^(\d+)\s+(\d+)$", dims_line)
        if not m:
            raise ValueError("Malformed PFM dimensions")
        width, height = int(m.group(1)), int(m.group(2))

        scale = float(f.readline().decode("ascii").strip())
        endian = "<" if scale < 0 else ">"
        scale = abs(scale)

        data = np.fromfile(f, endian + "f")
        channels = 3 if header == "PF" else 1
        expected = width * height * channels
        if data.size != expected:
            raise ValueError("Malformed PFM data")

        shape = (height, width, channels) if channels == 3 else (height, width)
        img = np.reshape(data, shape)
        img = np.flipud(img)
        return img.astype(np.float32), scale


def write_pfm(path: str | Path, image: np.ndarray, scale: float = 1.0) -> None:
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)

    if image.dtype != np.float32:
        image = image.astype(np.float32)

    if image.ndim == 2:
        color = False
    elif image.ndim == 3 and image.shape[2] == 3:
        color = True
    else:
        raise ValueError("PFM image must be HxW or HxWx3")

    image = np.flipud(image)

    with p.open("wb") as f:
        f.write(("PF\n" if color else "Pf\n").encode("ascii"))
        f.write(f"{image.shape[1]} {image.shape[0]}\n".encode("ascii"))
        endian_scale = -scale if (image.dtype.byteorder == "<" or (image.dtype.byteorder == "=" and np.little_endian)) else scale
        f.write(f"{endian_scale}\n".encode("ascii"))
        image.tofile(f)
