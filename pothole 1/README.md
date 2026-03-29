# Pothole Detection + Depth Estimation (FastAPI)

This project detects potholes from road images using **YOLOv8 segmentation**, estimates **relative pothole depth** using **MiDaS**, and returns results as **JSON**. It also saves output artifacts to disk and stores runs in an **SQLite** database.

---

## Requirements

- Windows (you are currently using Windows)
- Python 3.10+ recommended
- A trained YOLO segmentation model file: **`best.pt`**

> Note on MiDaS: the first run may download MiDaS weights via `torch.hub` (requires internet). After caching, it can work offline.

---

## Project Structure (important files)

- `api/app.py`
  - FastAPI server
  - `POST /upload` for single image upload
  - `GET /records` to view DB pothole rows
  - `DELETE /records` to clear DB pothole rows
- `services/pipeline.py`
  - Main pipeline orchestration (detect → postprocess → depth → outputs)
  - Saves output image + JSON to `output/`
  - Inserts rows into SQLite tables
- `services/detection.py`
  - YOLO service and output rendering (green overlay)
- `services/depth.py`
  - MiDaS depth map generation and pothole depth-difference computation
- `services/postprocess.py`
  - Filtering + mask merge logic (reduces false positives and merges split detections)
- `database/db.py`
  - SQLite schema and DB utilities
- `config.py`
  - Global thresholds and constants (including `METERS_PER_PIXEL`)

---

## 1) Setup (from scratch)

### A) Create a virtual environment

From the project root (`pothole/`):

```powershell
python -m venv .venv
```

### B) Activate the virtual environment

```powershell
.\.venv\Scripts\Activate.ps1
```

### C) Install dependencies

```powershell
pip install -r requirements\base.txt
```

---

## 2) Model Setup (`best.pt`)

Place your trained model file in one of these locations:

- `./best.pt`  (recommended)
- `./models/best.pt`

The code will automatically search these paths.

---

## 3) Run the API Server

From the project root:

```powershell
.\.venv\Scripts\python -m uvicorn api.app:app --host 0.0.0.0 --port 8000
```

Open:

- Swagger UI: `http://127.0.0.1:8000/docs`

---

## 4) Upload an Image (End-to-End)

### Option A: Swagger UI

1. Open `http://127.0.0.1:8000/docs`
2. Expand `POST /upload`
3. Click **Try it out**
4. Choose an image file
5. Click **Execute**

You will receive a JSON response like:

```json
[
  {
    "image_id": "IMG_...",
    "id": 1,
    "pothole_global_id": null,
    "area_pixels": 5234,
    "area_m2": 0.1309,
    "depth": 0.12,
    "confidence": 0.87
  }
]
```

### Option B: curl (PowerShell)

Use a real image path:

```powershell
curl.exe -F "file=@C:\path\to\image.jpg" http://127.0.0.1:8000/upload
```

---

## 5) Output Files (saved to disk)

When an image is uploaded, the pipeline saves artifacts:

- Input image is saved to: `input/<filename>`
- Output overlay image is saved to: `output/<stem>_out.jpg`
- Output JSON is saved to: `output/<stem>_out.json`

The JSON file saved on disk has this format:

```json
{
  "image_id": "IMG_...",
  "filename": "<original_filename>",
  "potholes": [
    {
      "image_id": "IMG_...",
      "id": 1,
      "pothole_global_id": null,
      "area_pixels": 128490.0,
      "area_m2": 3.2123,
      "depth": -0.0615,
      "confidence": 0.6839
    }
  ]
}
```

---

## 6) Database Storage (SQLite)

The SQLite database file is located at:

- `database/potholes.db`

### What is stored

- Table `image_runs`
  - `image_id` (unique)
  - input image bytes (BLOB)
  - output image bytes (BLOB)
  - output JSON (TEXT)
  - filename, created_at, optional lat/lon

- Table `potholes`
  - each detected pothole row linked by `image_id`

- Table `global_potholes`
  - used for duplicate association across uploads (GPS + similarity)

### View stored pothole rows

```powershell
curl.exe http://127.0.0.1:8000/records
```

### Clear pothole rows

```powershell
curl.exe -X DELETE http://127.0.0.1:8000/records
```

> Note: `DELETE /records` clears only the `potholes` rows, not `image_runs`. If you want a full wipe endpoint, ask to add it.

---

## 7) Testing / Evaluation Scripts (optional)

### A) Evaluate detection quality against dataset labels

```powershell
.\.venv\Scripts\python run_local_test.py --dataset "PUBLIC POTHOLE DATASET" --limit 10
```

Enable verbose debug output:

```powershell
.\.venv\Scripts\python run_local_test.py --dataset "PUBLIC POTHOLE DATASET" --limit 10 --debug
```

### B) Verify depth values against dataset depth maps

```powershell
.\.venv\Scripts\python verify_dataset_values.py --dataset "PUBLIC POTHOLE DATASET" --limit 10
```

Enable debug + MiDaS comparison:

```powershell
.\.venv\Scripts\python verify_dataset_values.py --dataset "PUBLIC POTHOLE DATASET" --limit 10 --debug --include-midas
```

---

## 8) Deployment Notes

### Recommended deployment style

- Run FastAPI with Uvicorn on a VM/server (CPU or GPU)
- Ensure:
  - `best.pt` is deployed with the code
  - MiDaS is cached or internet is available on first run

Production run (typical):

```bash
uvicorn api.app:app --host 0.0.0.0 --port 8000
```

---

## Troubleshooting

### 1) MiDaS fails to download (first run)

If you see errors related to `torch.hub.load("intel-isl/MiDaS", ...)`:

- Ensure internet access for the first run
- Run one successful inference locally to populate the cache

### 2) Ultralytics prints spam

Some scripts include a `--debug` flag to control verbosity. The API currently runs in normal mode.

---

## End-to-End Summary

1. Create venv + install requirements
2. Put `best.pt` into project root
3. Start server with uvicorn
4. Upload an image via `/docs` or curl
5. Get JSON response + outputs written to `output/`
6. Check DB records via `/records`
