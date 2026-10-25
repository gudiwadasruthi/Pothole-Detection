from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, File, UploadFile, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from database.db import (
    clear_all_records,
    fetch_all_records,
    init_db,
    get_user_profile,
    upsert_user_profile,
    create_contractor_registration,
    authenticate_account,
    get_contractor_applications,
    review_contractor_application,
    validate_contractor_assignment_eligibility,
    get_all_contractors,
)
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


# ─── CONTRACTOR SELF-REGISTRATION & APPROVAL WORKFLOW ─────────────────────────

class ContractorRegisterRequest(BaseModel):
    name: str
    contact_person: str
    email: str
    phone: str
    password: str
    confirm_password: str
    service_area: str | None = None
    specialization: str | None = None


class LoginRequest(BaseModel):
    email: str
    password: str
    role: str | None = None


class ApplicationDecisionRequest(BaseModel):
    reason: str | None = None


@app.post("/api/auth/register-contractor")
def register_contractor(data: ContractorRegisterRequest) -> JSONResponse:
    """
    Public contractor self-registration endpoint.
    Initializes account in PENDING state and disabled access.
    Admin approval is strictly required before login.
    """
    # Server-side validations
    name = data.name.strip()
    contact = data.contact_person.strip()
    email = data.email.strip().lower()
    phone = data.phone.strip()
    pwd = data.password
    cpwd = data.confirm_password

    if not name or len(name) < 2:
        raise HTTPException(status_code=400, detail="Company or contractor name must be at least 2 characters long.")
    if not contact or len(contact) < 2:
        raise HTTPException(status_code=400, detail="Contact person name must be at least 2 characters long.")
    if not email or "@" not in email or "." not in email:
        raise HTTPException(status_code=400, detail="Please provide a valid business email address.")
    if not phone or len(phone) < 7:
        raise HTTPException(status_code=400, detail="Please provide a valid phone number.")
    if not pwd or len(pwd) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long.")
    if pwd != cpwd:
        raise HTTPException(status_code=400, detail="Password and confirmation password do not match.")

    try:
        contractor = create_contractor_registration(
            name=name,
            contact_person=contact,
            email=email,
            phone=phone,
            password=pwd,
            service_area=data.service_area,
            specialization=data.specialization,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return JSONResponse(
        status_code=201,
        content={
            "status": "success",
            "message": "Your contractor application has been submitted successfully and is awaiting review by a municipal administrator. You will be able to log in once your account is authorized.",
            "contractor": contractor,
        },
    )


@app.post("/api/auth/login")
def login(data: LoginRequest) -> JSONResponse:
    """
    Unified authentication endpoint enforcing status restrictions.
    Pending, rejected, or inactive contractors are strictly denied access.
    """
    if not data.email or not data.password:
        raise HTTPException(status_code=400, detail="Email and password are required.")

    code, resp = authenticate_account(
        email=data.email,
        password=data.password,
        expected_role=data.role,
    )

    if code == 401:
        raise HTTPException(status_code=401, detail=resp.get("error", "Invalid email or password."))

    if code == 403:
        # Return structured 403 with status detail (pending, rejected, disabled, role_mismatch)
        return JSONResponse(status_code=403, content=resp)

    return JSONResponse(
        status_code=200,
        content={
            "status": "success",
            "user": resp,
        },
    )


@app.get("/api/contractor-applications")
def list_contractor_applications(
    status: str = Query("all"),
    x_user_id: str | None = Header(None, alias="X-User-Id"),
    x_user_role: str | None = Header(None, alias="X-User-Role"),
) -> dict:
    """
    Admin-only endpoint to inspect contractor applications awaiting or with decisions.
    """
    if x_user_role != "admin":
        raise HTTPException(status_code=403, detail="Forbidden: Only administrators can access the contractor approval queue.")

    apps = get_contractor_applications(status_filter=status)
    return {
        "status": "success",
        "total": len(apps),
        "applications": apps,
    }


@app.post("/api/contractor-applications/{contractor_id}/approve")
def approve_contractor_application(
    contractor_id: str,
    x_user_id: str | None = Header(None, alias="X-User-Id"),
    x_user_role: str | None = Header(None, alias="X-User-Role"),
) -> dict:
    """
    Admin-only endpoint to approve and activate a pending contractor account.
    """
    if x_user_role != "admin":
        raise HTTPException(status_code=403, detail="Forbidden: Only administrators can approve contractor applications.")

    if x_user_id == contractor_id:
        raise HTTPException(status_code=403, detail="Forbidden: Self-approval is strictly prohibited.")

    try:
        updated = review_contractor_application(
            contractor_id=contractor_id,
            decision="approve",
            admin_id=x_user_id or "ADMIN",
        )
    except KeyError:
        raise HTTPException(status_code=404, detail="Contractor application not found.")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "status": "success",
        "message": f"Contractor application approved and activated successfully for {updated.get('name')}.",
        "application": updated,
    }


@app.post("/api/contractor-applications/{contractor_id}/reject")
def reject_contractor_application(
    contractor_id: str,
    data: ApplicationDecisionRequest,
    x_user_id: str | None = Header(None, alias="X-User-Id"),
    x_user_role: str | None = Header(None, alias="X-User-Role"),
) -> dict:
    """
    Admin-only endpoint to reject a contractor application with a reason.
    """
    if x_user_role != "admin":
        raise HTTPException(status_code=403, detail="Forbidden: Only administrators can reject contractor applications.")

    try:
        updated = review_contractor_application(
            contractor_id=contractor_id,
            decision="reject",
            admin_id=x_user_id or "ADMIN",
            rejection_reason=data.reason,
        )
    except KeyError:
        raise HTTPException(status_code=404, detail="Contractor application not found.")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "status": "success",
        "message": f"Contractor application rejected.",
        "application": updated,
    }


@app.get("/api/contractors")
def list_contractors(
    eligible_only: bool = Query(False),
    x_user_role: str | None = Header(None, alias="X-User-Role"),
) -> dict:
    """
    List contractors. If eligible_only=True, only approved & active contractors are returned.
    """
    contractors = get_all_contractors(eligible_only=eligible_only)
    return {
        "status": "success",
        "total": len(contractors),
        "contractors": contractors,
    }


@app.post("/api/contractors/{contractor_id}/validate-assignment")
def validate_contractor_assignment(
    contractor_id: str,
    x_user_role: str | None = Header(None, alias="X-User-Role"),
) -> dict:
    """
    Validates if a contractor is eligible for contract assignment before dispatch.
    Pending, rejected, or inactive contractors are strictly rejected.
    """
    if x_user_role != "admin":
        raise HTTPException(status_code=403, detail="Forbidden: Only administrators can assign contracts.")

    is_eligible, reason = validate_contractor_assignment_eligibility(contractor_id)
    if not is_eligible:
        raise HTTPException(status_code=400, detail=f"Contractor assignment ineligible: {reason}")

    return {
        "status": "success",
        "eligible": True,
        "contractor_id": contractor_id,
        "message": "Contractor is approved, active, and eligible for contract assignment.",
    }


