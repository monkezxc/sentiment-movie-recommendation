import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from app.api import routers
from app.models import init_all_databases
from app.config.config_reader import config

app = FastAPI()

def _read_cors_origins() -> list[str]:
    """Список origin'ов для CORS: из env + локальные дефолты (без дублей)."""
    raw = (os.getenv("CORS_ALLOW_ORIGINS") or "").strip()
    from_env = [o.strip() for o in raw.split(",") if o.strip()] if raw else []

    # Локальная разработка (Live Server, Vite, и т.д.).
    defaults = [
        "http://localhost",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5500",
        "https://localhost",
        "https://localhost:5173",
        "https://localhost:5174",
        "http://127.0.0.1",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5500",
        "http://127.0.0.1:8080",
        "https://127.0.0.1",
        "https://127.0.0.1:5173",
        "https://127.0.0.1:5174",
        "https://127.0.0.1:8080",
    ]

    seen: set[str] = set()
    out: list[str] = []
    for origin in from_env + defaults:
        if origin not in seen:
            seen.add(origin)
            out.append(origin)
    return out


# Любой порт на localhost/127.0.0.1 — Vite часто занимает 5174, 5175 и т.д.
_LOCAL_ORIGIN_REGEX = r"https?://(localhost|127\.0\.0\.1)(:\d+)?"

app.add_middleware(
    CORSMiddleware,
    allow_origins=_read_cors_origins(),
    allow_origin_regex=_LOCAL_ORIGIN_REGEX,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup() -> None:
    await init_all_databases()

for router in routers:
    app.include_router(router)

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=config.APP_PORT, log_level="info")
