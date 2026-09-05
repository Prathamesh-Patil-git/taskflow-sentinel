#!/usr/bin/env bash
# Backend container entrypoint: wait for Postgres, run migrations, optionally
# seed *historical* demo data (never fake live worker state), then serve.
set -euo pipefail

echo "[entrypoint] waiting for database..."
python - <<'PY'
import asyncio, os, sys
from sqlalchemy.ext.asyncio import create_async_engine

url = os.environ.get("DATABASE_URL", "postgresql+asyncpg://taskflow:taskflow@postgres:5432/taskflow")

async def wait():
    for attempt in range(60):
        try:
            engine = create_async_engine(url)
            async with engine.connect():
                pass
            await engine.dispose()
            print("[entrypoint] database is ready")
            return
        except Exception as exc:
            print(f"[entrypoint] db not ready ({exc.__class__.__name__}), retrying...")
            await asyncio.sleep(2)
    sys.exit("[entrypoint] database never became available")

asyncio.run(wait())
PY

echo "[entrypoint] running alembic migrations..."
alembic upgrade head

if [ "${SEED_HISTORY:-false}" = "true" ]; then
  echo "[entrypoint] seeding historical demo data (live state still comes from real workers)..."
  python -m app.seed --history-only || echo "[entrypoint] seed skipped"
fi

echo "[entrypoint] starting API on ${API_HOST:-0.0.0.0}:${API_PORT:-8000}"
exec uvicorn app.main:app --host "${API_HOST:-0.0.0.0}" --port "${API_PORT:-8000}"
