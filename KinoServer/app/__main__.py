import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware # Импорт Middleware

from app.api import routers
from app.models import init_all_databases
from app.config.config_reader import config

app = FastAPI()

# Добавляем настройки CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Разрешает запросы с любых доменов. Для продакшена лучше указать конкретный url фронтенда
    allow_credentials=True,
    allow_methods=["*"],  # Разрешает все методы (GET, POST и т.д.)
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup() -> None:
    await init_all_databases()

for router in routers:
    app.include_router(router)

if __name__ == "__main__":
    uvicorn.run("__main__:app", port=config.APP_PORT, log_level="info")
