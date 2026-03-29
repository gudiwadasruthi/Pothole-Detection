FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    TORCH_HOME=/app/.cache/torch

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
  && rm -rf /var/lib/apt/lists/*

COPY requirements/ ./requirements/
RUN pip install --no-cache-dir -r requirements/cpu.txt

COPY . .

# Pre-download and cache MiDaS model during build (avoids timeout on first request)
RUN python << 'EOF'
import torch
print("Pre-caching MiDaS model...")
try:
    torch.hub.load('intel-isl/MiDaS', 'DPT_Large', trust_repo=True)
    print('MiDaS cached successfully')
except Exception as e:
    print(f'MiDaS cache warning: {e}')
    print('Will download on first run (may timeout)')
EOF

# Verify best.pt exists (fail build if missing)
RUN if [ ! -f "best.pt" ] && [ ! -f "models/best.pt" ]; then \
    echo "ERROR: best.pt not found! Include it in your repo." && exit 1; \
    else echo "best.pt found"; fi

EXPOSE 8000

CMD ["sh", "-c", "uvicorn api.app:app --host 0.0.0.0 --port ${PORT:-8000}"]
