#!/usr/bin/env python3
"""
Полная загрузка movie_data из _film_data в PostgreSQL.

Источник записей (как в parser.py):
  - файл ../_film_data/compiled.json, если есть;
  - иначе сборка из kp_films / kp_staff / kp_reviews через OfflineFilmData.

Запуск из корня репозитория:
  python parser/load_all_movie_data.py

Или из папки parser:
  python load_all_movie_data.py

Переменные окружения (см. .env):
  BOT_DATABASE_URL или DB_* — подключение к Postgres;
  API_URL — нужен, если не передан --no-api (эмоции отзывов + эмбеддинг через KinoServer);
  EMBEDDING_REVIEWS_MAX — сколько отзывов анализировать (по умолчанию 30);
  FILM_DATA_DIR — необязательно: абсолютный путь к каталогу с kp_films / kp_staff / kp_reviews
                  (по умолчанию <корень_репо>/_film_data).
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent

if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

load_dotenv(ROOT / ".env")
load_dotenv(SCRIPT_DIR / ".env")

from database import Database  # noqa: E402
from deep_translator import GoogleTranslator  # noqa: E402
from offline_parser import (  # noqa: E402
    BASE_PATH,
    OfflineFilmData,
    ensure_reviews_attached,
    sort_film_data,
)


def _load_pipeline_module():
    """Подгружает parser/parser.py как модуль (функции эмбеддинга и анализа отзывов)."""
    path = SCRIPT_DIR / "parser.py"
    spec = importlib.util.spec_from_file_location("vibemovie_offline_pipeline", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Не удалось загрузить модуль: {path}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _load_film_list(compiled_path: Path) -> list[dict]:
    if compiled_path.is_file() and compiled_path.stat().st_size > 0:
        try:
            with open(compiled_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except json.JSONDecodeError as exc:
            print(
                f"[WARN] {compiled_path} — невалидный JSON ({exc}). "
                "Соберём список из kp_films / kp_staff / kp_reviews."
            )
        else:
            if not isinstance(data, list):
                raise ValueError(f"{compiled_path} должен содержать JSON-массив фильмов")
            if data:
                return data
            print(f"[WARN] {compiled_path} содержит пустой массив — соберём список из kp_*.")
    elif compiled_path.is_file():
        print(f"[WARN] {compiled_path} пустой — соберём список из kp_films / kp_staff / kp_reviews.")

    kp_films = Path(BASE_PATH) / "kp_films"
    if not kp_films.is_dir():
        raise FileNotFoundError(
            f"Нет источника данных:\n"
            f"  • JSON: {compiled_path.resolve()} (файл не найден)\n"
            f"  • каталог: {kp_films}\n"
            f"Положите сырые данные в _film_data (kp_films, kp_staff, kp_reviews), "
            f"соберите compiled.json или задайте переменную FILM_DATA_DIR на каталог с этими папками."
        )
    return OfflineFilmData().get_all_films()


def _synthetic_reviews_emotions(reviews: list[str], max_reviews: int) -> list[dict]:
    """Без KinoServer: кладём отзывы в reviews с нейтральной эмоцией (ветка precomputed в insert_movie)."""
    out: list[dict] = []
    for text in reviews[:max_reviews]:
        t = (text or "").strip()
        if not t:
            continue
        out.append({"text": t, "emotion": "neutral", "confidence": 0.5})
    return out


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Загрузить все фильмы из _film_data в БД (структура movie_data)."
    )
    parser.add_argument(
        "--compiled",
        type=Path,
        default=ROOT / "_film_data" / "compiled.json",
        help="Путь к compiled.json (если файла нет — соберём список из папок kp_*)",
    )
    parser.add_argument(
        "--no-skip-existing",
        action="store_true",
        help="Не пропускать фильмы, уже есть в БД (вставка упадёт по UNIQUE kinopoisk_id)",
    )
    parser.add_argument(
        "--no-translate",
        action="store_true",
        help="Не переводить title через Google при title_foreign",
    )
    parser.add_argument(
        "--no-api",
        action="store_true",
        help="Не обращаться к KinoServer: без эмбеддинга; эмоции отзывов — заглушка neutral",
    )
    args = parser.parse_args()

    film_data = _load_film_list(Path(args.compiled).expanduser())
    sort_film_data(film_data)

    pipeline = None if args.no_api else _load_pipeline_module()

    db = Database()
    translator = None if args.no_translate else GoogleTranslator(source="auto", target="ru")

    max_rev = int(os.getenv("EMBEDDING_REVIEWS_MAX", "30"))
    added = 0
    skipped_existing = 0
    failed = 0

    for parsed_data in film_data:
        kid = parsed_data.get("kinopoisk_id")
        if kid is None:
            print(f"[пропуск] нет kinopoisk_id: {parsed_data.get('title')!r}")
            failed += 1
            continue

        if not args.no_skip_existing and db.movie_exists(kid):
            skipped_existing += 1
            continue

        title = parsed_data.get("title", "")
        print(f"\n→ {title} (kinopoisk_id={kid})")

        if translator and parsed_data.get("title_foreign"):
            try:
                parsed_data["title"] = translator.translate(parsed_data["title"])
            except Exception:
                pass
            parsed_data["title_foreign"] = False

        ensure_reviews_attached(parsed_data)
        rev_list = parsed_data.get("reviews") or []

        if args.no_api:
            parsed_data["reviews_emotions"] = _synthetic_reviews_emotions(rev_list, max_rev)
            parsed_data["embedding"] = None
        else:
            assert pipeline is not None
            analyzed = pipeline.analyze_reviews_emotions(
                parsed_data.get("reviews", []),
                api_url="",
                max_reviews=max_rev,
            )
            parsed_data["reviews_emotions"] = analyzed
            pipeline.MovieParser._add_embedding(parsed_data, analyzed)

        if db.insert_movie(parsed_data):
            added += 1
            print(f"  добавлено (всего новых: {added})")
        else:
            failed += 1
            print("  ошибка вставки (см. сообщение [DB] выше)")

    db.close()
    print(
        f"\nИтого: добавлено={added}, пропущено (уже в БД)={skipped_existing}, "
        f"ошибок/пропусков={failed}, записей в источнике={len(film_data)}"
    )


if __name__ == "__main__":
    main()
