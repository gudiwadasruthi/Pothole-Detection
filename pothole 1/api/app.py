from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from database.db import clear_all_records, fetch_all_records, init_db
from services.pipeline import process_image
from services.cost import get_rates, update_rates


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize DB with optional Render Disk path
    db_path = os.getenv("DB_PATH")
    init_db(db_path=Path(db_path) if db_path else None)
    yield
    # Shutdown: cleanup if needed


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check() -> dict:
    """Render health check endpoint"""
    return {"status": "healthy", "service": "pothole-detection-api"}

INPUT_DIR = Path("input")
INPUT_DIR.mkdir(parents=True, exist_ok=True)

OUTPUT_DIR = Path("output")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


class RateUpdate(BaseModel):
    cement_per_bag: float
    sand_per_m3: float
    aggregate_per_m3: float
    labor_per_m3: float


import base64


@app.post("/upload")
async def upload(
    file: UploadFile = File(...),
) -> dict:
    filename = Path(file.filename).name
    dest = INPUT_DIR / filename
    content = await file.read()
    dest.write_bytes(content)

    try:
        potholes = process_image(dest, input_dir=INPUT_DIR, output_dir=OUTPUT_DIR, save_visualization=True)
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": "Processing failed", "detail": str(e)}
        )
    
    encoded = ""
    out_img_path = OUTPUT_DIR / (dest.stem + "_out.jpg")
    if out_img_path.exists():
        encoded = base64.b64encode(out_img_path.read_bytes()).decode("utf-8")
        
    return {
        "potholes": potholes,
        "annotated_image": f"data:image/jpeg;base64,{encoded}" if encoded else None
    }


@app.get("/records")
def records() -> list[dict]:
    return fetch_all_records()


@app.delete("/records")
def clear_records() -> dict:
    deleted = clear_all_records()
    return {"deleted": int(deleted)}


@app.get("/")
def root() -> dict:
    """Root endpoint for quick verification"""
    return {
        "service": "Pothole Detection API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health"
    }


# Admin endpoints
@app.get("/admin/rates")
def get_current_rates() -> dict:
    """Get current material rates"""
    rates = get_rates()
    return {
        "rates": rates,
        "message": "Current rates retrieved successfully"
    }


@app.post("/admin/update-rates")
def update_material_rates(data: RateUpdate) -> dict:
    """Update material rates (admin only)"""
    success = update_rates(
        cement=data.cement_per_bag,
        sand=data.sand_per_m3,
        aggregate=data.aggregate_per_m3,
        labor=data.labor_per_m3
    )
    
    if success:
        return {
            "message": "Rates updated successfully",
            "rates": get_rates()
        }
    else:
        return {"message": "Failed to update rates"}, 500
