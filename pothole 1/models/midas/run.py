from __future__ import annotations

from pathlib import Path

import numpy as np
import torch

from utils.pfm_reader import write_pfm


class _MidasRunner:
    def __init__(self) -> None:
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = torch.hub.load("intel-isl/MiDaS", "DPT_Large", trust_repo=True)
        self.model.to(self.device)
        self.model.eval()

        midas_transforms = torch.hub.load("intel-isl/MiDaS", "transforms", trust_repo=True)
        self.transform = midas_transforms.dpt_transform

    @torch.inference_mode()
    def infer(self, image_rgb: np.ndarray) -> np.ndarray:
        input_batch = self.transform(image_rgb).to(self.device)
        prediction = self.model(input_batch)
        prediction = torch.nn.functional.interpolate(
            prediction.unsqueeze(1),
            size=image_rgb.shape[:2],
            mode="bicubic",
            align_corners=False,
        ).squeeze()
        depth = prediction.detach().cpu().numpy().astype(np.float32)
        return depth


_RUNNER: _MidasRunner | None = None


def run_midas(*, image_bgr: np.ndarray, pfm_output_path: str | Path) -> str:
    global _RUNNER
    if _RUNNER is None:
        _RUNNER = _MidasRunner()

    image_rgb = image_bgr[:, :, ::-1].copy()
    depth = _RUNNER.infer(image_rgb=image_rgb)

    pfm_path = Path(pfm_output_path)
    write_pfm(pfm_path, depth, scale=1.0)
    return str(pfm_path)
