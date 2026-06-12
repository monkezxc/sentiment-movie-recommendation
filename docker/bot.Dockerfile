FROM python:3.13-slim-bookworm

WORKDIR /app

COPY docker/requirements-bot.txt .
RUN pip install --no-cache-dir -r requirements-bot.txt

COPY bot/ ./bot/

ENV PYTHONUNBUFFERED=1

CMD ["python", "bot/bot.py"]
