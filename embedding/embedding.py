"""Эмбеддинги фильмов и поисковых запросов.

После перехода на pgvector сортировка/выборка по косинусной близости делается
прямо в Postgres (см. KinoServer/app/crud/crud.py::search_movies_by_embedding
и KinoServer/app/services/recommendations.py). Поэтому модуль содержит только
то, что нельзя выполнить в БД: получение эмбеддинга для произвольного текста.
"""

import os

from sentence_transformers import SentenceTransformer

try:
    from huggingface_hub import login

    hf_token = os.getenv("HF_TOKEN")
    if hf_token:
        login(hf_token)
except Exception:
    pass

print("Загрузка модели Qwen3-Embedding-0.6B... (это может занять несколько минут)")
model = SentenceTransformer("Qwen/Qwen3-Embedding-0.6B")
print("Модель загружена!")


def to_embedding(query):
    """Возвращает эмбеддинг текста как numpy array.

    pgvector корректно принимает numpy.ndarray в роли параметра запроса
    (через зарегистрированный тип), поэтому `.tolist()` нужен только если
    эмбеддинг отдаётся наружу как JSON в ответе FastAPI.
    """
    return model.encode(query, prompt_name="query")
