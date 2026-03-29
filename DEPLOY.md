# SmartRoad Deployment Guide

## Architecture
- **Frontend**: Vercel (Vite + React)
- **Backend**: Render (Docker + FastAPI)

---

## Backend Deployment (Render)

### Prerequisites
1. Your code must be in a GitHub/GitLab repo
2. `best.pt` model file must be committed (or in repo)
3. Docker Desktop installed locally for testing

### Local Testing

```powershell
# From repo root
docker compose up --build

# Test health endpoint
curl http://localhost:8000/health

# Test upload via Swagger UI
# Open: http://localhost:8000/docs
```

### Render Deployment Steps

1. **Push to GitHub**
   ```powershell
   git add .
   git commit -m "Add Render deployment config"
   git push origin main
   ```

2. **Create Web Service on Render**
   - Go to [render.com](https://render.com)
   - New → Web Service
   - Connect your GitHub repo
   - Select "Docker" runtime
   - Root Directory: `pothole 1`
   - Render will use the `Dockerfile`

3. **Required Settings**
   | Setting | Value |
   |---------|-------|
   | Health Check Path | `/health` |
   | Port | `8000` (or use $PORT env var) |
   | Environment | `DB_PATH=/data/potholes.db` |

4. **Add Disk (For SQLite Persistence)**
   - Render Dashboard → Your Service → Disks
   - Add Disk:
     - Name: `data`
     - Mount Path: `/data`
     - Size: 1 GB (enough for SQLite)

5. **Environment Variables** (in Render Dashboard)
   ```
   DB_PATH=/data/potholes.db
   ```

6. **Deploy**
   - Render auto-deploys on git push
   - Or click "Manual Deploy" → "Clear build cache & deploy"

### Troubleshooting Render

| Issue | Solution |
|-------|----------|
| "best.pt not found" | Ensure `best.pt` is committed to git, not ignored |
| First request timeout | MiDaS downloading weights; wait or upgrade plan |
| SQLite data lost | Ensure `DB_PATH=/data/potholes.db` and disk mounted |
| CORS errors | Frontend must use correct `VITE_API_URL` |
| 500 on upload | Check Render logs for MiDaS/YOLO errors |

---

## Frontend Deployment (Vercel)

### Environment Variables
In Vercel Dashboard → Project Settings → Environment Variables:

```
VITE_API_BASE_URL=https://your-backend.onrender.com
```

### Vercel Config (vercel.json)
Create `frontend/vercel.json`:

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

### Deploy to Vercel
```powershell
cd frontend
vercel --prod
```

---

## Post-Deployment Checklist

- [ ] Backend `/health` returns `{"status": "healthy"}`
- [ ] Frontend can reach backend (CORS working)
- [ ] Upload test image → gets processed
- [ ] Database records persist after redeploy
- [ ] Frontend displays processed image correctly

---

## Files Changed for Render

1. `pothole 1/Dockerfile` - Added MiDaS warm-up, best.pt check
2. `pothole 1/api/app.py` - Added health endpoint, lifespan manager
3. `pothole 1/models/midas/run.py` - Fixed trust_repo=True
4. `pothole 1/warmup.py` - Model warm-up script
5. `render.yaml` - Render deployment config
6. `pothole 1/.dockerignore` - Exclude unnecessary files
