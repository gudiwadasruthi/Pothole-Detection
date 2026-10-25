import os
import sys
import uuid
from pathlib import Path
from fastapi.testclient import TestClient
from api.app import app
from database.db import init_db

# Initialize database
init_db()

client = TestClient(app)

print("=" * 70)
print("TESTING CONTRACTOR SELF-REGISTRATION & ADMIN APPROVAL WORKFLOW")
print("=" * 70)

# Generate unique test email
test_id = uuid.uuid4().hex[:6]
test_email = f"contractor_{test_id}@roadworks.in"
test_pwd = "SecureRoadPass!2026"
company_name = f"Apex Road Solutions {test_id}"

# ─── 1. Test Contractor Self-Registration ──────────────────────────────────────
print("\n[Step 1] Contractor Self-Registration")

# 1a. Validation errors: short password
res_short_pwd = client.post("/api/auth/register-contractor", json={
    "name": company_name,
    "contact_person": "Vikram Patel",
    "email": test_email,
    "phone": "9876543210",
    "password": "123",
    "confirm_password": "123",
    "service_area": "North Zone",
    "specialization": "Asphalt Paving"
})
print("Short password status (expected 400):", res_short_pwd.status_code)
assert res_short_pwd.status_code == 400

# 1b. Validation errors: password mismatch
res_mismatch = client.post("/api/auth/register-contractor", json={
    "name": company_name,
    "contact_person": "Vikram Patel",
    "email": test_email,
    "phone": "9876543210",
    "password": test_pwd,
    "confirm_password": "WrongPassword123",
    "service_area": "North Zone",
    "specialization": "Asphalt Paving"
})
print("Password mismatch status (expected 400):", res_mismatch.status_code)
assert res_mismatch.status_code == 400

# 1c. Valid Registration Submission
res_reg = client.post("/api/auth/register-contractor", json={
    "name": company_name,
    "contact_person": "Vikram Patel",
    "email": test_email,
    "phone": "9876543210",
    "password": test_pwd,
    "confirm_password": test_pwd,
    "service_area": "North Corridor (Outer Ring Road)",
    "specialization": "High-Grade Bitumen Laying & Crack Sealing"
})
print("Registration status (expected 201):", res_reg.status_code)
assert res_reg.status_code == 201
reg_data = res_reg.json()
contractor_obj = reg_data.get("contractor", {})
new_contractor_id = contractor_obj.get("id")
print("Registered Contractor ID:", new_contractor_id)
assert contractor_obj.get("approval_status") == "pending"
assert contractor_obj.get("is_active") is False
assert contractor_obj.get("role") == "contractor"
assert "password" not in contractor_obj
assert "password_hash" not in contractor_obj

# 1d. Duplicate Email Registration Prevention
res_dup = client.post("/api/auth/register-contractor", json={
    "name": "Another Company",
    "contact_person": "Another Person",
    "email": test_email,  # duplicate
    "phone": "9999988888",
    "password": test_pwd,
    "confirm_password": test_pwd,
})
print("Duplicate email registration status (expected 400):", res_dup.status_code)
assert res_dup.status_code == 400

# ─── 2. Test Pending Contractor Login Denial ──────────────────────────────────
print("\n[Step 2] Login Denial for Pending Contractor")
res_pending_login = client.post("/api/auth/login", json={
    "email": test_email,
    "password": test_pwd,
    "role": "contractor"
})
print("Pending contractor login status (expected 403 Forbidden):", res_pending_login.status_code)
assert res_pending_login.status_code == 403
login_resp = res_pending_login.json()
print("Pending login denial payload:", login_resp)
assert login_resp.get("status") == "pending"
assert "approval" in login_resp.get("message", "").lower()

# ─── 3. Test Assignment Eligibility for Pending Contractor ─────────────────────
print("\n[Step 3] Contract Assignment Eligibility for Pending Contractor")
res_assign_pending = client.post(
    f"/api/contractors/{new_contractor_id}/validate-assignment",
    headers={"X-User-Role": "admin", "X-User-Id": "ADM_001"}
)
print("Pending assignment status (expected 400 Ineligible):", res_assign_pending.status_code)
assert res_assign_pending.status_code == 400
print("Ineligibility detail:", res_assign_pending.json().get("detail"))

# ─── 4. Test RBAC on Admin Approval Queue ─────────────────────────────────────
print("\n[Step 4] RBAC Protection on Approval Queue & Decisions")

# Citizen attempting to view queue
res_citizen_queue = client.get(
    "/api/contractor-applications",
    headers={"X-User-Role": "user", "X-User-Id": "USR_DEMO"}
)
print("Citizen view queue status (expected 403):", res_citizen_queue.status_code)
assert res_citizen_queue.status_code == 403

# Contractor attempting to approve themselves
res_self_approve = client.post(
    f"/api/contractor-applications/{new_contractor_id}/approve",
    headers={"X-User-Role": "contractor", "X-User-Id": new_contractor_id}
)
print("Contractor self-approval status (expected 403):", res_self_approve.status_code)
assert res_self_approve.status_code == 403

# Admin viewing approval queue
res_admin_queue = client.get(
    "/api/contractor-applications?status=pending",
    headers={"X-User-Role": "admin", "X-User-Id": "ADM_001"}
)
print("Admin view queue status (expected 200):", res_admin_queue.status_code)
assert res_admin_queue.status_code == 200
queue_data = res_admin_queue.json()
pending_ids = [app_item["id"] for app_item in queue_data.get("applications", [])]
print(f"Total pending applications in queue: {len(pending_ids)}")
assert new_contractor_id in pending_ids

# ─── 5. Test Rejection Workflow ───────────────────────────────────────────────
print("\n[Step 5] Admin Rejection Workflow")
rejection_reason = "Incomplete municipal GST and equipment certifications."
res_reject = client.post(
    f"/api/contractor-applications/{new_contractor_id}/reject",
    headers={"X-User-Role": "admin", "X-User-Id": "ADM_001"},
    json={"reason": rejection_reason}
)
print("Admin reject status (expected 200):", res_reject.status_code)
assert res_reject.status_code == 200
rej_app = res_reject.json().get("application", {})
assert rej_app.get("approval_status") == "rejected"
assert rej_app.get("rejection_reason") == rejection_reason
assert rej_app.get("is_active") is False

# Rejected contractor login denial
res_rejected_login = client.post("/api/auth/login", json={
    "email": test_email,
    "password": test_pwd,
    "role": "contractor"
})
print("Rejected contractor login status (expected 403 Forbidden):", res_rejected_login.status_code)
assert res_rejected_login.status_code == 403
assert res_rejected_login.json().get("status") == "rejected"
assert res_rejected_login.json().get("rejection_reason") == rejection_reason

# ─── 6. Test Approval & Activation Workflow ───────────────────────────────────
print("\n[Step 6] Admin Approval & Account Activation Workflow")
res_approve = client.post(
    f"/api/contractor-applications/{new_contractor_id}/approve",
    headers={"X-User-Role": "admin", "X-User-Id": "ADM_001"}
)
print("Admin approve status (expected 200):", res_approve.status_code)
assert res_approve.status_code == 200
appr_app = res_approve.json().get("application", {})
assert appr_app.get("approval_status") == "approved"
assert appr_app.get("is_active") is True

# Approved contractor login succeeds
res_approved_login = client.post("/api/auth/login", json={
    "email": test_email,
    "password": test_pwd,
    "role": "contractor"
})
print("Approved contractor login status (expected 200):", res_approved_login.status_code)
assert res_approved_login.status_code == 200
user_info = res_approved_login.json().get("user", {})
print("Logged in user:", user_info.get("name"), "| Role:", user_info.get("role"))
assert user_info.get("approval_status") == "approved"
assert user_info.get("is_active") is True
assert user_info.get("role") == "contractor"

# Contract assignment eligibility now passes
res_assign_approved = client.post(
    f"/api/contractors/{new_contractor_id}/validate-assignment",
    headers={"X-User-Role": "admin", "X-User-Id": "ADM_001"}
)
print("Approved contractor assignment eligibility (expected 200):", res_assign_approved.status_code)
assert res_assign_approved.status_code == 200
assert res_assign_approved.json().get("eligible") is True

# ─── 7. Test Existing Demo Accounts Preservation ──────────────────────────────
print("\n[Step 7] Demo Accounts Authentication Integrity")
for demo_email, demo_pw, demo_role in [
    ("citizen@smartroad.gov.in", "citizen123", "user"),
    ("admin@smartroad.gov.in", "admin123", "admin"),
    ("rajesh@constructions.com", "rajesh123", "contractor"),
    ("sharma@infra.com", "sharma123", "contractor"),
    ("mnr@roads.com", "mnr123", "contractor"),
]:
    res_demo = client.post("/api/auth/login", json={
        "email": demo_email,
        "password": demo_pw,
        "role": demo_role
    })
    print(f"Demo login for {demo_email} (role: {demo_role}): status {res_demo.status_code}")
    assert res_demo.status_code == 200
    assert res_demo.json().get("user", {}).get("role") == demo_role

print("\n" + "=" * 70)
print(">>> ALL CONTRACTOR WORKFLOW & SECURITY TESTS PASSED! <<<")
print("=" * 70)
