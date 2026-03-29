#!/usr/bin/env python3
"""Warm-up script to pre-download and cache models for faster startup on Render."""
import os
import sys
from pathlib import Path

# Add the project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent))

print("🔥 Warming up models for Render deployment...")

# Pre-download MiDaS model
print("  → Loading MiDaS depth model...")
import torch
try:
    model = torch.hub.load(
        "intel-isl/MiDaS",
        "DPT_Large",
        trust_repo=True,
        skip_validation=True
    )
    print("  ✓ MiDaS model loaded successfully")
except Exception as e:
    print(f"  ⚠ Warning: MiDaS warm-up failed: {e}")
    print("  → Will retry on first request (may cause timeout)")

# Pre-load YOLO model
print("  → Loading YOLO segmentation model...")
try:
    from ultralytics import YOLO
    from services.detection import _resolve_model_path
    
    model_path = _resolve_model_path(None)
    if model_path.exists():
        yolo = YOLO(str(model_path))
        print(f"  ✓ YOLO model loaded from {model_path}")
    else:
        print(f"  ⚠ Warning: best.pt not found at {model_path}")
        print("  → Ensure best.pt is included in Docker build")
except Exception as e:
    print(f"  ⚠ Warning: YOLO warm-up failed: {e}")

print("✅ Warm-up complete. Ready for deployment!")
