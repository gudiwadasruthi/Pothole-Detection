from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, File, UploadFile, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from database.db import clear_all_records, fetch_all_records, init_db, get_user_profile, upsert_user_profile
from services.pipeline import process_image
from services.cost import get_rates, update_rates
from datetime import datetime


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


# ─── ROLE-BASED ACCESS & PROFILE ENDPOINTS ──────────────────────────────

class ProfileUpdateRequest(BaseModel):
    name: str | None = None
    phone: str | None = None
    contact_person: str | None = None
    service_area: str | None = None
    specialization: str | None = None
    department: str | None = None


# Seed profiles for known default accounts
SEED_PROFILES = {
    "USR_DEMO": {
        "user_id": "USR_DEMO",
        "role": "user",
        "name": "Priya Sharma",
        "email": "citizen@smartroad.gov.in",
        "phone": "9876501234",
        "contact_person": None,
        "service_area": None,
        "specialization": None,
        "department": None,
        "created_at": "12 Jan 2026",
    },
    "ADM_001": {
        "user_id": "ADM_001",
        "role": "admin",
        "name": "Gov Admin",
        "email": "admin@smartroad.gov.in",
        "phone": "0863-2345678",
        "contact_person": None,
        "service_area": None,
        "specialization": None,
        "department": "Road & Transport Infrastructure Authority",
        "created_at": "01 Nov 2025",
    },
    "CON1": {
        "user_id": "CON1",
        "role": "contractor",
        "name": "Rajesh Constructions",
        "email": "rajesh@constructions.com",
        "phone": "9876543210",
        "contact_person": "Rajesh Varma",
        "service_area": "East Zone (Koramangala, Indiranagar, HSR Layout)",
        "specialization": "Bituminous Pavements & Emergency Surface Restoration",
        "department": None,
        "created_at": "15 Dec 2025",
    },
    "CON2": {
        "user_id": "CON2",
        "role": "contractor",
        "name": "Sharma Infra",
        "email": "sharma@infra.com",
        "phone": "9845678901",
        "contact_person": "Alok Sharma",
        "service_area": "South Zone (Jayanagar, JP Nagar, BTM Layout)",
        "specialization": "Drainage Re-Compaction & Edge Sealing",
        "department": None,
        "created_at": "10 Jan 2026",
    },
    "CON3": {
        "user_id": "CON3",
        "role": "contractor",
        "name": "MNR Roads",
        "email": "mnr@roads.com",
        "phone": "9823456789",
        "contact_person": "M. N. Rao",
        "service_area": "North Zone (Malleshwaram, Rajajinagar)",
        "specialization": "Concrete Road Repair & High-Grade Bitumen Mixing",
        "department": None,
        "created_at": "02 Feb 2026",
    },
}


@app.get("/api/profile")
def get_profile(
    x_user_id: str | None = Header(None, alias="X-User-Id"),
    x_user_role: str | None = Header(None, alias="X-User-Role"),
    user_id: str | None = Query(None),
    role: str | None = Query(None),
) -> dict:
    uid = x_user_id or user_id
    urole = x_user_role or role or "user"
    if not uid:
        raise HTTPException(status_code=401, detail="Authentication identity required")

    profile = get_user_profile(uid)
    if not profile:
        seed = SEED_PROFILES.get(uid)
        now_str = datetime.now().strftime("%d %b %Y, %H:%M")
        if seed:
            profile = upsert_user_profile(
                user_id=seed["user_id"],
                role=seed["role"],
                name=seed["name"],
                email=seed["email"],
                phone=seed.get("phone"),
                contact_person=seed.get("contact_person"),
                service_area=seed.get("service_area"),
                specialization=seed.get("specialization"),
                department=seed.get("department"),
                created_at=seed.get("created_at"),
                updated_at=now_str,
            )
        else:
            profile = upsert_user_profile(
                user_id=uid,
                role=urole,
                name="Citizen User" if urole == "user" else "Contractor",
                email=f"{uid.lower()}@smartroad.gov.in",
                updated_at=now_str,
            )

    return {
        "status": "success",
        "profile": profile,
    }


@app.put("/api/profile")
def update_profile(
    data: ProfileUpdateRequest,
    x_user_id: str | None = Header(None, alias="X-User-Id"),
    x_user_role: str | None = Header(None, alias="X-User-Role"),
    user_id: str | None = Query(None),
    role: str | None = Query(None),
) -> dict:
    uid = x_user_id or user_id
    urole = x_user_role or role or "user"
    if not uid:
        raise HTTPException(status_code=401, detail="Authentication identity required")

    existing = get_user_profile(uid)
    if not existing:
        seed = SEED_PROFILES.get(uid, {})
        existing = {
            "user_id": uid,
            "role": urole,
            "name": seed.get("name", "User"),
            "email": seed.get("email", f"{uid.lower()}@smartroad.gov.in"),
            "phone": seed.get("phone", ""),
            "contact_person": seed.get("contact_person", ""),
            "service_area": seed.get("service_area", ""),
            "specialization": seed.get("specialization", ""),
            "department": seed.get("department", ""),
            "created_at": seed.get("created_at", datetime.now().strftime("%d %b %Y")),
        }

    # Strict role-based field allowlists enforced on backend
    now_str = datetime.now().strftime("%d %b %Y, %H:%M")
    if urole == "user":
        # Citizen can only edit permitted personal fields: name and phone
        new_name = (data.name.strip() if data.name else None) or existing["name"]
        new_phone = (data.phone.strip() if data.phone is not None else existing.get("phone"))
        updated = upsert_user_profile(
            user_id=uid,
            role="user",
            name=new_name,
            email=existing["email"],
            phone=new_phone,
            created_at=existing.get("created_at"),
            updated_at=now_str,
        )
    elif urole == "contractor":
        # Contractor can only edit permitted operational fields: contact_person, phone, service_area, specialization
        # Company name, budgets, and verification status are strictly protected from modification
        updated = upsert_user_profile(
            user_id=uid,
            role="contractor",
            name=existing["name"],  # Preserve official registered company name
            email=existing["email"],
            phone=data.phone.strip() if data.phone is not None else existing.get("phone"),
            contact_person=data.contact_person.strip() if data.contact_person is not None else existing.get("contact_person"),
            service_area=data.service_area.strip() if data.service_area is not None else existing.get("service_area"),
            specialization=data.specialization.strip() if data.specialization is not None else existing.get("specialization"),
            created_at=existing.get("created_at"),
            updated_at=now_str,
        )
    elif urole == "admin":
        # Admin can update personal admin details
        updated = upsert_user_profile(
            user_id=uid,
            role="admin",
            name=(data.name.strip() if data.name else None) or existing["name"],
            email=existing["email"],
            phone=data.phone.strip() if data.phone is not None else existing.get("phone"),
            department=data.department.strip() if data.department is not None else existing.get("department"),
            created_at=existing.get("created_at"),
            updated_at=now_str,
        )
    else:
        raise HTTPException(status_code=403, detail="Unauthorized role operation")

    return {
        "status": "success",
        "message": "Profile updated successfully with backend authorization",
        "profile": updated,
    }


@app.get("/api/contractors/{contractor_id}")
def get_contractor_profile(
    contractor_id: str,
    x_user_id: str | None = Header(None, alias="X-User-Id"),
    x_user_role: str | None = Header(None, alias="X-User-Role"),
) -> dict:
    # Role-based authorization check: Only Admin or the contractor themselves can view
    if x_user_role not in ["admin", "contractor"]:
        raise HTTPException(status_code=403, detail="Forbidden: Citizens cannot inspect contractor private dossiers")
    if x_user_role == "contractor" and x_user_id != contractor_id:
        raise HTTPException(status_code=403, detail="Forbidden: Contractors cannot inspect competitor private profiles")

    profile = get_user_profile(contractor_id)
    if not profile:
        seed = SEED_PROFILES.get(contractor_id)
        if seed:
            profile = seed
        else:
            raise HTTPException(status_code=404, detail="Contractor not found")

    return {
        "status": "success",
        "contractor": profile,
    }

