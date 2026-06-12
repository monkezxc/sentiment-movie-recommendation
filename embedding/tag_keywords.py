"""Маппинг тегов фильма (parser/auto_tags.py) в ключевые слова для эмбеддинга."""

from __future__ import annotations

import importlib.util
import re
import sys
from pathlib import Path

_PROJECT_ROOT = Path(__file__).resolve().parent.parent


def _load_auto_tags_module():
    """Загружает parser/auto_tags.py по пути, без `from parser.*`.

    Когда папка parser/ в sys.path (load_all_movie_data.py), имя модуля `parser`
    указывает на parser/parser.py и ломает импорт пакета — отсюда циклический import.
    """
    path = _PROJECT_ROOT / "parser" / "auto_tags.py"
    spec = importlib.util.spec_from_file_location("vibemovie_auto_tags", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Не удалось загрузить auto_tags: {path}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


_auto_tags = _load_auto_tags_module()
genre_trans = _auto_tags.genre_trans
country_trans = _auto_tags.country_trans

# slug жанра -> русское название (из genre_trans)
_GENRE_BY_SLUG = {slug: ru for ru, slug in genre_trans.items()}

# slug страны -> одно русское название (первое встреченное в country_trans)
_COUNTRY_BY_SLUG: dict[str, str] = {}
for _ru_name, _slug in country_trans.items():
    _COUNTRY_BY_SLUG.setdefault(_slug, _ru_name)

_MPAA_LABELS = {
    "g": "рейтинг MPAA G",
    "pg": "рейтинг MPAA PG",
    "pg13": "рейтинг MPAA PG-13",
    "r": "рейтинг MPAA R",
    "nc17": "рейтинг MPAA NC-17",
    "nc-17": "рейтинг MPAA NC-17",
}

_KINOPOISK_AGE_LABELS = {
    "age0": "возрастной рейтинг 0+",
    "age6": "возрастной рейтинг 6+",
    "age12": "возрастной рейтинг 12+",
    "age16": "возрастной рейтинг 16+",
    "age18": "возрастной рейтинг 18+",
}

_EMOTION_LABELS = {
    "sadness": "грусть",
    "optimism": "оптимизм",
    "fear": "страх",
    "anger": "злость",
    "neutral": "нейтральность",
    "worry": "тревога",
    "love": "любовь",
    "fun": "веселье",
    "boredom": "скука",
    "embarrassment": "смущение",
}

_TAG_GROUPS_ORDER = ("genre", "country", "years", "duration", "age", "format", "other")


def _keyword_genre(slug: str) -> str:
    if slug == "other":
        return "другой жанр"
    return _GENRE_BY_SLUG.get(slug, slug.replace("_", " "))


def _keyword_country(slug: str) -> str:
    if slug == "other":
        return "другая страна"
    return _COUNTRY_BY_SLUG.get(slug, slug.replace("_", " "))


def _keyword_years(tag: str) -> str:
    if tag == "years_pre_1900":
        return "выпущен до 1900 года"
    match = re.fullmatch(r"years_(\d{3})0s", tag)
    if match:
        decade = match.group(1)
        return f"{decade}0-е годы"
    return tag.replace("_", " ")


def _keyword_duration(tag: str) -> str:
    match = re.fullmatch(r"duration_(\d+)h", tag)
    if not match:
        return tag.replace("_", " ")
    hours = int(match.group(1))
    if hours == 0:
        return "длительность менее часа"
    if hours == 1:
        return "длительность около 1 часа"
    return f"длительность около {hours} часов"


def _keyword_age(tag: str) -> str:
    if tag in _KINOPOISK_AGE_LABELS:
        return _KINOPOISK_AGE_LABELS[tag]

    if tag.startswith("age_mpaa_"):
        mpaa = tag.removeprefix("age_mpaa_").lower().replace("-", "")
        return _MPAA_LABELS.get(mpaa, f"рейтинг MPAA {mpaa.upper()}")

    digits = re.search(r"\d+", tag)
    if digits:
        return f"возрастной рейтинг {digits.group()}+"

    return tag.replace("_", " ")


def _keyword_format(tag: str) -> str:
    if tag == "has_3d":
        return "доступен в 3D"
    if tag == "has_imax":
        return "доступен в IMAX"
    return tag.replace("_", " ")


def tag_to_keyword(tag: str) -> str | None:
    """Преобразует один тег в читаемое ключевое слово для эмбеддинга."""
    tag = (tag or "").strip()
    if not tag:
        return None

    if tag.startswith("genre_"):
        return _keyword_genre(tag.removeprefix("genre_"))
    if tag.startswith("country_"):
        return _keyword_country(tag.removeprefix("country_"))
    if tag.startswith("years_"):
        return _keyword_years(tag)
    if tag.startswith("duration_"):
        return _keyword_duration(tag)
    if tag.startswith("age"):
        return _keyword_age(tag)
    if tag in {"has_3d", "has_imax"}:
        return _keyword_format(tag)

    return tag.replace("_", " ")


def _tag_group(tag: str) -> str:
    if tag.startswith("genre_"):
        return "genre"
    if tag.startswith("country_"):
        return "country"
    if tag.startswith("years_"):
        return "years"
    if tag.startswith("duration_"):
        return "duration"
    if tag.startswith("age"):
        return "age"
    if tag in {"has_3d", "has_imax"}:
        return "format"
    return "other"


def tags_to_keywords(tags: list[str] | None) -> list[str]:
    """Маппит список тегов в ключевые слова без дубликатов, с сохранением порядка групп."""
    if not tags:
        return []

    grouped: dict[str, list[str]] = {group: [] for group in _TAG_GROUPS_ORDER}
    seen: set[str] = set()

    for tag in tags:
        keyword = tag_to_keyword(tag)
        if not keyword or keyword in seen:
            continue
        seen.add(keyword)
        grouped[_tag_group(tag)].append(keyword)

    result: list[str] = []
    for group in _TAG_GROUPS_ORDER:
        result.extend(grouped[group])
    return result


def tags_to_embedding_block(tags: list[str] | None) -> str:
    """Одна строка с ключевыми словами из тегов для вставки в текст эмбеддинга."""
    keywords = tags_to_keywords(tags)
    if not keywords:
        return ""
    return "Теги фильма: " + ", ".join(keywords)


def emotion_to_keyword(emotion: str) -> str:
    key = (emotion or "").strip().lower()
    return _EMOTION_LABELS.get(key, emotion)


def build_movie_embedding_text(
    parsed_data: dict,
    top_emotions: list[str] | None = None,
) -> str:
    """Собирает полный текст для генерации эмбеддинга фильма."""
    writers = parsed_data.get("writers") or parsed_data.get("screenwriter") or ""
    release_year = parsed_data.get("release_year") or parsed_data.get("year") or ""

    parts = [
        (parsed_data.get("description") or "").strip(),
        (parsed_data.get("genre") or "").strip(),
        (parsed_data.get("director") or "").strip(),
        str(writers).strip(),
        (parsed_data.get("actors") or "").strip(),
    ]

    if release_year:
        parts.append(f"год выпуска {release_year}")

    tag_block = tags_to_embedding_block(parsed_data.get("tags"))
    if tag_block:
        parts.append(tag_block)

    if top_emotions:
        labeled = [emotion_to_keyword(e) for e in top_emotions if e]
        if labeled:
            parts.append("Эмоции в отзывах (топ-3): " + ", ".join(labeled))

    return "\n".join(part for part in parts if part)


def main() -> None:
    """CLI: python -m embedding.tag_keywords genre_action country_russia years_1990s"""
    if len(sys.argv) < 2:
        print("Использование: python -m embedding.tag_keywords <tag> [<tag> ...]")
        print("Пример: python -m embedding.tag_keywords genre_action country_russia years_1990s")
        raise SystemExit(1)

    for tag in sys.argv[1:]:
        print(f"{tag} -> {tag_to_keyword(tag)}")

    print()
    print(tags_to_embedding_block(sys.argv[1:]))


if __name__ == "__main__":
    main()
