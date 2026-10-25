import hashlib
import math
import secrets
import sqlite3
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

_DB_PATH = Path(__file__).resolve().parent / "potholes.db"


def get_connection(db_path: Path | None = None) -> sqlite3.Connection:
    path = db_path or _DB_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path))
    conn.row_factory = sqlite3.Row
    return conn


def hash_password(password: str, salt: str | None = None) -> tuple[str, str]:
    if salt is None:
        salt = secrets.token_hex(16)
    pw_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        100000,
    ).hex()
    return pw_hash, salt


def verify_password(password: str, password_hash: str, salt: str) -> bool:
    computed_hash, _ = hash_password(password, salt)
    return secrets.compare_digest(computed_hash, password_hash)


def init_db(db_path: Path | None = None) -> None:
    conn = get_connection(db_path)
    try:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS image_runs (
                image_id TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                input_image BLOB,
                output_image BLOB,
                output_json TEXT,
                lat REAL,
                lon REAL,
                created_at TEXT NOT NULL
            )
            """
        )

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS global_potholes (
                global_id TEXT PRIMARY KEY,
                lat REAL NOT NULL,
                lon REAL NOT NULL,
                created_at TEXT NOT NULL,
                area_m2 REAL,
                depth REAL,
                hu1 REAL,
                hu2 REAL,
                hu3 REAL,
                hu4 REAL,
                hu5 REAL,
                hu6 REAL,
                hu7 REAL,
                updated_at TEXT
            )
            """
        )

        gcols = {r[1] for r in conn.execute("PRAGMA table_info(global_potholes)").fetchall()}
        for name, typ in [
            ("area_m2", "REAL"),
            ("depth", "REAL"),
            ("hu1", "REAL"),
            ("hu2", "REAL"),
            ("hu3", "REAL"),
            ("hu4", "REAL"),
            ("hu5", "REAL"),
            ("hu6", "REAL"),
            ("hu7", "REAL"),
            ("updated_at", "TEXT"),
        ]:
            if name not in gcols:
                conn.execute(f"ALTER TABLE global_potholes ADD COLUMN {name} {typ}")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS potholes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                image_id TEXT,
                image_path TEXT NOT NULL,
                pothole_id INTEGER NOT NULL,
                pothole_global_id TEXT,
                lat REAL,
                lon REAL,
                area REAL NOT NULL,
                confidence REAL NOT NULL,
                depth REAL NOT NULL,
                timestamp TEXT NOT NULL
            )
            """
        )

        cols = {r[1] for r in conn.execute("PRAGMA table_info(potholes)").fetchall()}
        if "image_id" not in cols:
            conn.execute("ALTER TABLE potholes ADD COLUMN image_id TEXT")
        if "pothole_global_id" not in cols:
            conn.execute("ALTER TABLE potholes ADD COLUMN pothole_global_id TEXT")
        if "lat" not in cols:
            conn.execute("ALTER TABLE potholes ADD COLUMN lat REAL")
        if "lon" not in cols:
            conn.execute("ALTER TABLE potholes ADD COLUMN lon REAL")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS user_profiles (
                user_id TEXT PRIMARY KEY,
                role TEXT NOT NULL,
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                phone TEXT,
                contact_person TEXT,
                service_area TEXT,
                specialization TEXT,
                department TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )

        # Migrate user_profiles if missing status fields
        pcols = {r[1] for r in conn.execute("PRAGMA table_info(user_profiles)").fetchall()}
        for name, typ in [
            ("approval_status", "TEXT DEFAULT 'approved'"),
            ("is_active", "INTEGER DEFAULT 1"),
            ("rejection_reason", "TEXT"),
            ("reviewed_by", "TEXT"),
            ("reviewed_at", "TEXT"),
        ]:
            if name not in pcols:
                conn.execute(f"ALTER TABLE user_profiles ADD COLUMN {name} {typ}")

        # Dedicated accounts table for secure authentication & credentials
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS accounts (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                role TEXT NOT NULL,
                approval_status TEXT NOT NULL DEFAULT 'approved',
                is_active INTEGER NOT NULL DEFAULT 1,
                rejection_reason TEXT,
                reviewed_by TEXT,
                reviewed_at TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )

        _seed_demo_accounts_internal(conn)
        conn.commit()
    finally:
        conn.close()


def _seed_demo_accounts_internal(conn: sqlite3.Connection) -> None:
    demo_accounts = [
        {
            "id": "USR_DEMO",
            "email": "citizen@smartroad.gov.in",
            "password": "citizen123",
            "role": "user",
            "name": "Priya Sharma",
            "phone": "9876501234",
            "created_at": "12 Jan 2026",
        },
        {
            "id": "ADM_001",
            "email": "admin@smartroad.gov.in",
            "password": "admin123",
            "role": "admin",
            "name": "Gov Admin",
            "phone": "0863-2345678",
            "department": "Road & Transport Infrastructure Authority",
            "created_at": "01 Nov 2025",
        },
        {
            "id": "CON1",
            "email": "rajesh@constructions.com",
            "password": "rajesh123",
            "role": "contractor",
            "name": "Rajesh Constructions",
            "contact_person": "Rajesh Varma",
            "phone": "9876543210",
            "service_area": "East Zone (Koramangala, Indiranagar, HSR Layout)",
            "specialization": "Bituminous Pavements & Emergency Surface Restoration",
            "created_at": "15 Dec 2025",
        },
        {
            "id": "CON2",
            "email": "sharma@infra.com",
            "password": "sharma123",
            "role": "contractor",
            "name": "Sharma Infra",
            "contact_person": "Alok Sharma",
            "phone": "9845678901",
            "service_area": "South Zone (Jayanagar, JP Nagar, BTM Layout)",
            "specialization": "Drainage Re-Compaction & Edge Sealing",
            "created_at": "10 Jan 2026",
        },
        {
            "id": "CON3",
            "email": "mnr@roads.com",
            "password": "mnr123",
            "role": "contractor",
            "name": "MNR Roads",
            "contact_person": "M. N. Rao",
            "phone": "9823456789",
            "service_area": "North Zone (Malleshwaram, Rajajinagar)",
            "specialization": "Concrete Road Repair & High-Grade Bitumen Mixing",
            "created_at": "02 Feb 2026",
        },
    ]

    now_iso = datetime.now().isoformat()
    now_display = datetime.now().strftime("%d %b %Y, %H:%M")

    for acc in demo_accounts:
        email = acc["email"].lower()
        existing = conn.execute("SELECT id FROM accounts WHERE LOWER(email) = ?", (email,)).fetchone()
        if not existing:
            h, s = hash_password(acc["password"])
            conn.execute(
                """
                INSERT INTO accounts (id, email, password_hash, salt, role, approval_status, is_active, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 'approved', 1, ?, ?)
                """,
                (acc["id"], email, h, s, acc["role"], now_iso, now_iso),
            )

        existing_prof = conn.execute("SELECT user_id FROM user_profiles WHERE user_id = ?", (acc["id"],)).fetchone()
        if not existing_prof:
            conn.execute(
                """
                INSERT INTO user_profiles (user_id, role, name, email, phone, contact_person, service_area, specialization, department, approval_status, is_active, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', 1, ?, ?)
                """,
                (
                    acc["id"],
                    acc["role"],
                    acc["name"],
                    email,
                    acc.get("phone"),
                    acc.get("contact_person"),
                    acc.get("service_area"),
                    acc.get("specialization"),
                    acc.get("department"),
                    acc.get("created_at") or now_display,
                    now_display,
                ),
            )


def insert_image_run(
    *,
    image_id: str,
    filename: str,
    created_at: str,
    input_image: bytes | None = None,
    lat: float | None = None,
    lon: float | None = None,
    db_path: Path | None = None,
) -> None:
    init_db(db_path)
    conn = get_connection(db_path)
    try:
        conn.execute(
            """
            INSERT OR REPLACE INTO image_runs (image_id, filename, input_image, lat, lon, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (str(image_id), str(filename), input_image, lat, lon, str(created_at)),
        )
        conn.commit()
    finally:
        conn.close()


def update_image_run_outputs(
    *,
    image_id: str,
    output_json: str | None = None,
    output_image: bytes | None = None,
    db_path: Path | None = None,
) -> None:
    init_db(db_path)
    conn = get_connection(db_path)
    try:
        if output_json is not None:
            conn.execute("UPDATE image_runs SET output_json = ? WHERE image_id = ?", (str(output_json), str(image_id)))
        if output_image is not None:
            conn.execute("UPDATE image_runs SET output_image = ? WHERE image_id = ?", (output_image, str(image_id)))
        conn.commit()
    finally:
        conn.close()


def _haversine_m(*, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371000.0
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2.0) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlon / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(max(0.0, 1.0 - a)))
    return float(r * c)


def get_or_create_global_pothole(
    *,
    lat: float,
    lon: float,
    created_at: str,
    area_m2: float | None = None,
    depth: float | None = None,
    hu: list[float] | None = None,
    radius_m: float = 3.0,
    area_rel_tol: float = 0.35,
    depth_abs_tol: float = 0.10,
    hu_tol: float = 0.005,
    db_path: Path | None = None,
) -> str:
    init_db(db_path)
    conn = get_connection(db_path)
    try:
        rows = conn.execute(
            "SELECT global_id, lat, lon, area_m2, depth, hu1, hu2, hu3, hu4, hu5, hu6, hu7 FROM global_potholes"
        ).fetchall()
        best_id: str | None = None
        best_d = float("inf")
        for r in rows:
            d = _haversine_m(lat1=float(lat), lon1=float(lon), lat2=float(r["lat"]), lon2=float(r["lon"]))

            if d > float(radius_m):
                continue

            if area_m2 is not None and r["area_m2"] is not None:
                denom = max(1e-9, float(r["area_m2"]))
                rel = abs(float(area_m2) - float(r["area_m2"])) / denom
                if rel > float(area_rel_tol):
                    continue

            if depth is not None and r["depth"] is not None:
                if abs(float(depth) - float(r["depth"])) > float(depth_abs_tol):
                    continue

            if hu is not None:
                cand = [r["hu1"], r["hu2"], r["hu3"], r["hu4"], r["hu5"], r["hu6"], r["hu7"]]
                if any(x is None for x in cand):
                    continue
                hd = sum(abs(float(hu[i]) - float(cand[i])) for i in range(min(7, len(hu))))
                if hd > float(hu_tol):
                    continue

            if d < best_d:
                best_d = d
                best_id = str(r["global_id"])

        if best_id is not None:
            conn.execute("UPDATE global_potholes SET updated_at = ? WHERE global_id = ?", (str(created_at), best_id))
            conn.commit()
            return best_id

        gid = f"PH_{uuid.uuid4().hex[:12]}"
        hu_vals = [None] * 7
        if hu is not None:
            for i in range(min(7, len(hu))):
                hu_vals[i] = float(hu[i])

        conn.execute(
            """
            INSERT INTO global_potholes (global_id, lat, lon, created_at, area_m2, depth, hu1, hu2, hu3, hu4, hu5, hu6, hu7, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                gid,
                float(lat),
                float(lon),
                str(created_at),
                float(area_m2) if area_m2 is not None else None,
                float(depth) if depth is not None else None,
                hu_vals[0],
                hu_vals[1],
                hu_vals[2],
                hu_vals[3],
                hu_vals[4],
                hu_vals[5],
                hu_vals[6],
                str(created_at),
            ),
        )
        conn.commit()
        return gid
    finally:
        conn.close()


def insert_pothole_data(
    *,
    image_id: str | None = None,
    image_path: str,
    pothole_id: int,
    pothole_global_id: str | None = None,
    lat: float | None = None,
    lon: float | None = None,
    area: float,
    confidence: float,
    depth: float,
    timestamp: str,
    db_path: Path | None = None,
) -> int:
    init_db(db_path)
    conn = get_connection(db_path)
    try:
        cur = conn.execute(
            """
            INSERT INTO potholes (image_id, image_path, pothole_id, pothole_global_id, lat, lon, area, confidence, depth, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (image_id, image_path, pothole_id, pothole_global_id, lat, lon, area, confidence, depth, timestamp),
        )
        conn.commit()
        return int(cur.lastrowid)
    finally:
        conn.close()


def fetch_all_records(db_path: Path | None = None) -> list[dict[str, Any]]:
    init_db(db_path)
    conn = get_connection(db_path)
    try:
        cols = {r[1] for r in conn.execute("PRAGMA table_info(potholes)").fetchall()}
        base = ["id", "image_path", "pothole_id", "area", "confidence", "depth", "timestamp"]
        if "image_id" in cols:
            base.insert(1, "image_id")
        if "pothole_global_id" in cols:
            base.insert(3, "pothole_global_id")
        if "lat" in cols:
            base.insert(4 if "pothole_global_id" in cols else 3, "lat")
        if "lon" in cols:
            base.insert(5 if "pothole_global_id" in cols else 4, "lon")
        q = "SELECT " + ", ".join(base) + " FROM potholes ORDER BY id DESC"
        rows = conn.execute(q).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def clear_all_records(db_path: Path | None = None) -> int:
    init_db(db_path)
    conn = get_connection(db_path)
    try:
        cur = conn.execute("DELETE FROM potholes")
        conn.commit()
        return int(cur.rowcount if cur.rowcount is not None else 0)
    finally:
        conn.close()


def get_user_profile(user_id: str, db_path: Path | None = None) -> dict[str, Any] | None:
    init_db(db_path)
    conn = get_connection(db_path)
    try:
        row = conn.execute("SELECT * FROM user_profiles WHERE user_id = ?", (user_id,)).fetchone()
        if not row:
            return None
        return dict(row)
    finally:
        conn.close()


def upsert_user_profile(
    *,
    user_id: str,
    role: str,
    name: str,
    email: str,
    phone: str | None = None,
    contact_person: str | None = None,
    service_area: str | None = None,
    specialization: str | None = None,
    department: str | None = None,
    created_at: str | None = None,
    updated_at: str,
    db_path: Path | None = None,
) -> dict[str, Any]:
    init_db(db_path)
    conn = get_connection(db_path)
    try:
        existing = conn.execute("SELECT * FROM user_profiles WHERE user_id = ?", (user_id,)).fetchone()
        if existing:
            conn.execute(
                """
                UPDATE user_profiles
                SET name = ?, phone = ?, contact_person = ?, service_area = ?, specialization = ?, department = ?, updated_at = ?
                WHERE user_id = ?
                """,
                (
                    name,
                    phone or existing["phone"],
                    contact_person or existing["contact_person"],
                    service_area or existing["service_area"],
                    specialization or existing["specialization"],
                    department or existing["department"],
                    updated_at,
                    user_id,
                ),
            )
        else:
            conn.execute(
                """
                INSERT INTO user_profiles (user_id, role, name, email, phone, contact_person, service_area, specialization, department, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    user_id,
                    role,
                    name,
                    email,
                    phone,
                    contact_person,
                    service_area,
                    specialization,
                    department,
                    created_at or updated_at,
                    updated_at,
                ),
            )
        conn.commit()
        updated_row = conn.execute("SELECT * FROM user_profiles WHERE user_id = ?", (user_id,)).fetchone()
        return dict(updated_row) if updated_row else {}
    finally:
        conn.close()


def get_account_by_email(email: str, db_path: Path | None = None) -> dict[str, Any] | None:
    norm_email = email.strip().lower()
    init_db(db_path)
    conn = get_connection(db_path)
    try:
        row = conn.execute("SELECT * FROM accounts WHERE LOWER(email) = ?", (norm_email,)).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def get_account_by_id(account_id: str, db_path: Path | None = None) -> dict[str, Any] | None:
    init_db(db_path)
    conn = get_connection(db_path)
    try:
        row = conn.execute("SELECT * FROM accounts WHERE id = ?", (account_id,)).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def create_contractor_registration(
    *,
    name: str,
    contact_person: str,
    email: str,
    phone: str,
    password: str,
    service_area: str | None = None,
    specialization: str | None = None,
    db_path: Path | None = None,
) -> dict[str, Any]:
    norm_email = email.strip().lower()
    init_db(db_path)
    conn = get_connection(db_path)
    try:
        # Check duplicate email in accounts
        existing_acc = conn.execute("SELECT id FROM accounts WHERE LOWER(email) = ?", (norm_email,)).fetchone()
        if existing_acc:
            raise ValueError("Email address is already registered.")

        # Check duplicate email in user_profiles
        existing_prof = conn.execute("SELECT user_id FROM user_profiles WHERE LOWER(email) = ?", (norm_email,)).fetchone()
        if existing_prof:
            raise ValueError("Email address is already registered.")

        account_id = f"CON_{uuid.uuid4().hex[:8].upper()}"
        pw_hash, salt = hash_password(password)
        now_iso = datetime.now().isoformat()
        now_display = datetime.now().strftime("%d %b %Y, %H:%M")

        # Initial account state: role='contractor', approval_status='pending', is_active=0 (disabled)
        conn.execute(
            """
            INSERT INTO accounts (id, email, password_hash, salt, role, approval_status, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'contractor', 'pending', 0, ?, ?)
            """,
            (account_id, norm_email, pw_hash, salt, now_iso, now_iso),
        )

        conn.execute(
            """
            INSERT INTO user_profiles (user_id, role, name, email, phone, contact_person, service_area, specialization, approval_status, is_active, created_at, updated_at)
            VALUES (?, 'contractor', ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?)
            """,
            (
                account_id,
                name.strip(),
                norm_email,
                phone.strip(),
                contact_person.strip(),
                (service_area or "").strip(),
                (specialization or "").strip(),
                now_display,
                now_display,
            ),
        )
        conn.commit()

        return {
            "id": account_id,
            "name": name.strip(),
            "contact_person": contact_person.strip(),
            "email": norm_email,
            "phone": phone.strip(),
            "service_area": (service_area or "").strip(),
            "specialization": (specialization or "").strip(),
            "role": "contractor",
            "approval_status": "pending",
            "is_active": False,
            "created_at": now_display,
        }
    finally:
        conn.close()


def authenticate_account(
    email: str,
    password: str,
    expected_role: str | None = None,
    db_path: Path | None = None,
) -> tuple[int, dict[str, Any]]:
    """
    Authenticate account credentials and enforce role & contractor approval status.
    Returns (status_code, response_data).
    """
    norm_email = email.strip().lower()
    init_db(db_path)
    conn = get_connection(db_path)
    try:
        acc = conn.execute("SELECT * FROM accounts WHERE LOWER(email) = ?", (norm_email,)).fetchone()
        if not acc:
            return 401, {"error": "Invalid email or password", "status": "invalid_credentials"}

        acc_dict = dict(acc)
        if not verify_password(password, acc_dict["password_hash"], acc_dict["salt"]):
            return 401, {"error": "Invalid email or password", "status": "invalid_credentials"}

        if expected_role and acc_dict["role"] != expected_role:
            return 403, {"error": f"Role mismatch: account is registered as {acc_dict['role']}", "status": "role_mismatch"}

        # Strict security enforcement for Contractor accounts
        if acc_dict["role"] == "contractor":
            status = acc_dict.get("approval_status", "pending")
            is_active = bool(acc_dict.get("is_active", 0))

            if status == "pending":
                return 403, {
                    "error": "Account pending approval",
                    "status": "pending",
                    "approval_status": "pending",
                    "message": "Your contractor application has been received and is awaiting Admin review and approval. Municipal access will be enabled once authorized.",
                }
            if status == "rejected":
                return 403, {
                    "error": "Account application rejected",
                    "status": "rejected",
                    "approval_status": "rejected",
                    "rejection_reason": acc_dict.get("rejection_reason") or "Application did not meet municipal requirements.",
                    "message": "Your contractor registration was rejected by the municipal administration.",
                }
            if not is_active:
                return 403, {
                    "error": "Account deactivated",
                    "status": "disabled",
                    "approval_status": status,
                    "message": "Your contractor account has been deactivated or suspended by the municipal administration.",
                }

        prof = conn.execute("SELECT * FROM user_profiles WHERE user_id = ?", (acc_dict["id"],)).fetchone()
        prof_dict = dict(prof) if prof else {}

        # Omit password_hash and salt from output
        safe_user = {
            "id": acc_dict["id"],
            "email": acc_dict["email"],
            "role": acc_dict["role"],
            "approval_status": acc_dict.get("approval_status", "approved"),
            "is_active": bool(acc_dict.get("is_active", 1)),
            "name": prof_dict.get("name", acc_dict["email"]),
            "contact_person": prof_dict.get("contact_person"),
            "phone": prof_dict.get("phone"),
            "service_area": prof_dict.get("service_area"),
            "specialization": prof_dict.get("specialization"),
            "department": prof_dict.get("department"),
            "created_at": prof_dict.get("created_at") or acc_dict["created_at"],
        }
        return 200, safe_user
    finally:
        conn.close()


def get_contractor_applications(
    status_filter: str | None = None,
    db_path: Path | None = None,
) -> list[dict[str, Any]]:
    init_db(db_path)
    conn = get_connection(db_path)
    try:
        query = """
            SELECT 
                a.id, a.email, a.role, a.approval_status, a.is_active, 
                a.rejection_reason, a.reviewed_by, a.reviewed_at, a.created_at as account_created_at,
                p.name, p.phone, p.contact_person, p.service_area, p.specialization, p.created_at
            FROM accounts a
            LEFT JOIN user_profiles p ON a.id = p.user_id
            WHERE a.role = 'contractor'
        """
        params = []
        if status_filter and status_filter != "all":
            query += " AND a.approval_status = ?"
            params.append(status_filter)
        query += " ORDER BY a.created_at DESC"

        rows = conn.execute(query, params).fetchall()
        result = []
        for r in rows:
            d = dict(r)
            result.append({
                "id": d["id"],
                "name": d.get("name") or "Contractor Applicant",
                "email": d["email"],
                "phone": d.get("phone") or "",
                "contact_person": d.get("contact_person") or "",
                "service_area": d.get("service_area") or "",
                "specialization": d.get("specialization") or "",
                "approval_status": d["approval_status"],
                "is_active": bool(d["is_active"]),
                "rejection_reason": d.get("rejection_reason"),
                "reviewed_by": d.get("reviewed_by"),
                "reviewed_at": d.get("reviewed_at"),
                "created_at": d.get("created_at") or d.get("account_created_at"),
            })
        return result
    finally:
        conn.close()


def review_contractor_application(
    contractor_id: str,
    decision: str,
    admin_id: str,
    rejection_reason: str | None = None,
    db_path: Path | None = None,
) -> dict[str, Any]:
    decision_clean = decision.lower().strip()
    if decision_clean not in ("approve", "reject"):
        raise ValueError("Decision must be either 'approve' or 'reject'")

    init_db(db_path)
    conn = get_connection(db_path)
    try:
        acc = conn.execute("SELECT * FROM accounts WHERE id = ? AND role = 'contractor'", (contractor_id,)).fetchone()
        if not acc:
            raise KeyError("Contractor application not found")

        acc_dict = dict(acc)
        # Prevent applicant from self-approving
        if contractor_id == admin_id:
            raise PermissionError("Applicants cannot review their own application")

        now_str = datetime.now().strftime("%d %b %Y, %H:%M")
        now_iso = datetime.now().isoformat()

        if decision_clean == "approve":
            new_status = "approved"
            new_active = 1
            reason = None
        else:
            new_status = "rejected"
            new_active = 0
            reason = (rejection_reason or "Application rejected by municipal administration.").strip()

        conn.execute(
            """
            UPDATE accounts
            SET approval_status = ?, is_active = ?, rejection_reason = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ?
            WHERE id = ?
            """,
            (new_status, new_active, reason, admin_id, now_str, now_iso, contractor_id),
        )

        conn.execute(
            """
            UPDATE user_profiles
            SET approval_status = ?, is_active = ?, rejection_reason = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ?
            WHERE user_id = ?
            """,
            (new_status, new_active, reason, admin_id, now_str, now_str, contractor_id),
        )
        conn.commit()

        updated_acc = conn.execute("SELECT * FROM accounts WHERE id = ?", (contractor_id,)).fetchone()
        updated_prof = conn.execute("SELECT * FROM user_profiles WHERE user_id = ?", (contractor_id,)).fetchone()
        p = dict(updated_prof) if updated_prof else {}
        a = dict(updated_acc)

        return {
            "id": a["id"],
            "name": p.get("name", "Contractor"),
            "email": a["email"],
            "role": a["role"],
            "approval_status": a["approval_status"],
            "is_active": bool(a["is_active"]),
            "rejection_reason": a.get("rejection_reason"),
            "reviewed_by": a.get("reviewed_by"),
            "reviewed_at": a.get("reviewed_at"),
            "updated_at": a["updated_at"],
        }
    finally:
        conn.close()


def validate_contractor_assignment_eligibility(
    contractor_id: str,
    db_path: Path | None = None,
) -> tuple[bool, str]:
    init_db(db_path)
    conn = get_connection(db_path)
    try:
        acc = conn.execute("SELECT * FROM accounts WHERE id = ?", (contractor_id,)).fetchone()
        if not acc:
            prof = conn.execute("SELECT * FROM user_profiles WHERE user_id = ?", (contractor_id,)).fetchone()
            if not prof:
                return False, f"Contractor '{contractor_id}' not found"
            p = dict(prof)
            if p.get("role") != "contractor":
                return False, "Account does not have contractor role"
            if p.get("approval_status") and p.get("approval_status") != "approved":
                return False, f"Contractor status is '{p.get('approval_status')}'; must be approved before contract assignment"
            if p.get("is_active") is not None and not p.get("is_active"):
                return False, "Contractor account is deactivated or suspended"
            return True, "Eligible"

        a = dict(acc)
        if a["role"] != "contractor":
            return False, "Account does not have contractor role"
        if a["approval_status"] != "approved":
            return False, f"Contractor account status is '{a['approval_status']}'; must be approved before contract assignment"
        if not a["is_active"]:
            return False, "Contractor account is deactivated or suspended"
        return True, "Eligible"
    finally:
        conn.close()


def get_all_contractors(eligible_only: bool = False, db_path: Path | None = None) -> list[dict[str, Any]]:
    init_db(db_path)
    conn = get_connection(db_path)
    try:
        query = """
            SELECT 
                a.id, a.email, a.role, a.approval_status, a.is_active,
                p.name, p.phone, p.contact_person, p.service_area, p.specialization, p.created_at
            FROM accounts a
            LEFT JOIN user_profiles p ON a.id = p.user_id
            WHERE a.role = 'contractor'
        """
        if eligible_only:
            query += " AND a.approval_status = 'approved' AND a.is_active = 1"
        query += " ORDER BY a.created_at ASC"

        rows = conn.execute(query).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


