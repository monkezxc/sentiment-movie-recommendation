import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from app.api import routers
from app.models import init_all_databases
from app.config.config_reader import config

app = FastAPI()

def _read_cors_origins() -> list[str]:
    """Читаем список origin'ов из env (CORS_ALLOW_ORIGINS="https://a,https://b")."""
    raw = (os.getenv("CORS_ALLOW_ORIGINS") or "").strip()
    if raw:
        return [o.strip() for o in raw.split(",") if o.strip()]

    # Дефолт: локальная разработка.
    return [
        "http://localhost",
        "http://localhost:5173",
        "https://localhost",
        "https://localhost:5173",
        "http://127.0.0.1",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8080",
        "https://127.0.0.1",
        "https://127.0.0.1:5173",
        "https://127.0.0.1:8080",
    ]


app.add_middleware(
    CORSMiddleware,
    allow_origins=_read_cors_origins(),
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
    uvicorn.run(app, host="0.0.0.0", port=config.APP_PORT, log_level="info")
