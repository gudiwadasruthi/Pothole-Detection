from __future__ import annotations

from database.db import get_connection, init_db
from pathlib import Path


def get_rates() -> dict:
    """Fetch current material rates from database"""
    init_db()
    conn = get_connection()
    try:
        # Check if material_rates table exists, create if not
        conn.execute("""
            CREATE TABLE IF NOT EXISTS material_rates (
                id INTEGER PRIMARY KEY,
                cement_per_bag REAL DEFAULT 400,
                sand_per_m3 REAL DEFAULT 1500,
                aggregate_per_m3 REAL DEFAULT 1200,
                labor_per_m3 REAL DEFAULT 300,
                last_updated TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Get latest rates
        row = conn.execute("""
            SELECT cement_per_bag, sand_per_m3, aggregate_per_m3, labor_per_m3 
            FROM material_rates 
            ORDER BY id DESC 
            LIMIT 1
        """).fetchone()
        
        if row is None:
            # Insert default rates if none exist
            conn.execute("""
                INSERT INTO material_rates (cement_per_bag, sand_per_m3, aggregate_per_m3, labor_per_m3)
                VALUES (400, 1500, 1200, 300)
            """)
            conn.commit()
            return {"cement": 400, "sand": 1500, "aggregate": 1200, "labor": 300}
        
        return {
            "cement": float(row["cement_per_bag"]),
            "sand": float(row["sand_per_m3"]),
            "aggregate": float(row["aggregate_per_m3"]),
            "labor": float(row["labor_per_m3"])
        }
    finally:
        conn.close()


def update_rates(cement: float, sand: float, aggregate: float, labor: float) -> bool:
    """Update material rates in database"""
    init_db()
    conn = get_connection()
    try:
        conn.execute("""
            INSERT INTO material_rates (cement_per_bag, sand_per_m3, aggregate_per_m3, labor_per_m3)
            VALUES (?, ?, ?, ?)
        """, (cement, sand, aggregate, labor))
        conn.commit()
        return True
    except Exception as e:
        print(f"Error updating rates: {e}")
        return False
    finally:
        conn.close()


def calculate_cost(area_m2: float, depth: float) -> dict:
    """Calculate repair cost for a pothole (materials only - labor to be added by contractor)"""
    rates = get_rates()
    
    # Ensure positive inputs with realistic minimums
    area_m2 = max(0.01, abs(area_m2))  # Minimum 0.01m² (10cm x 10cm)
    depth = max(0.02, abs(depth))       # Minimum 2cm depth
    
    # Calculate volume (area * depth) - ensure positive
    volume = area_m2 * depth
    
    # Ensure minimum volume for realistic material quantities
    volume = max(0.002, volume)  # Minimum 0.002m³ (2 liters)
    
    # Material quantities (standard road repair ratios)
    cement_bags = volume * 6.5  # 6.5 bags per m³
    sand_m3 = volume * 0.45     # 0.45 m³ sand per m³
    aggregate_m3 = volume * 0.9 # 0.9 m³ aggregate per m³
    
    # Ensure minimum material quantities for realistic repairs
    cement_bags = max(0.5, cement_bags)  # At least 0.5 bags
    sand_m3 = max(0.01, sand_m3)        # At least 0.01 m³
    aggregate_m3 = max(0.02, aggregate_m3)  # At least 0.02 m³
    
    # Material costs only - labor to be added separately by contractor
    cement_cost = max(0, cement_bags * rates["cement"])
    sand_cost = max(0, sand_m3 * rates["sand"])
    aggregate_cost = max(0, aggregate_m3 * rates["aggregate"])
    
    # Materials cost only (no labor)
    materials_total = cement_cost + sand_cost + aggregate_cost
    
    # Add 10% contingency for materials only
    final_materials_cost = max(50, materials_total * 1.1)  # Minimum ₹50 cost
    
    return {
        "volume_m3": round(volume, 4),
        "cement_bags": round(cement_bags, 2),
        "sand_m3": round(sand_m3, 3),
        "aggregate_m3": round(aggregate_m3, 3),
        "material_costs": {
            "cement": round(cement_cost, 2),
            "sand": round(sand_cost, 2),
            "aggregate": round(aggregate_cost, 2),
            "labor": 0  # Labor to be added by contractor
        },
        "materials_cost_only": round(final_materials_cost, 2),
        "total_cost": round(final_materials_cost, 2),  # Materials only for now
        "rates_used": rates
    }
