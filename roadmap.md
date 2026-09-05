# TaskFlow Sentinel — roadmap

- [x] Frontend UI (Claymorphism) — all pages
- [x] Python FastAPI backend (models, services, scheduler, fault tolerance, websocket, API)
- [x] Alembic migrations + seed script + demo worker runtime
- [x] Docker Compose (frontend, backend, postgres, redis, 4 worker containers)
- [x] pytest suite incl. worker-failure → recovery integration test
- [x] Frontend: real API + WebSocket integration (VITE_API_URL / VITE_WS_URL)
- [x] Remove the static frontend simulation entirely (backend is the only source of truth)
- [x] PWA: manifest + service worker so the app can be installed
