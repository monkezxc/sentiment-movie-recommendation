FROM python:3.13-slim-bookworm

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r requirements.txt asyncpg

COPY KinoServer/ ./KinoServer/
COPY embedding/ ./embedding/
COPY face_recognition/ ./face_recognition/

ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1
ENV HF_HOME=/app/.cache/huggingface
ENV APP_PORT=8000

# Предзагрузка ML-модели при сборке (долго, но быстрый старт контейнера).
ARG PRELOAD_MODEL=true
RUN if [ "$PRELOAD_MODEL" = "true" ]; then \
      python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('Qwen/Qwen3-Embedding-0.6B')"; \
    fi

WORKDIR /app/KinoServer
EXPOSE 8000

CMD ["uvicorn", "app.__main__:app", "--host", "0.0.0.0", "--port", "8000"]
