import math
import sqlite3
import uuid
from pathlib import Path
from typing import Any

_DB_PATH = Path(__file__).resolve().parent / "potholes.db"


def get_connection(db_path: Path | None = None) -> sqlite3.Connection:
    path = db_path or _DB_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path))
    conn.row_factory = sqlite3.Row
    return conn


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
        conn.commit()
    finally:
        conn.close()


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
