import asyncio
import os
import time
import hashlib
from pathlib import Path
from typing import Final
from urllib.parse import urljoin
from urllib.request import Request as UrlRequest, urlopen
from urllib.error import HTTPError, URLError

from fastapi import APIRouter, HTTPException
from starlette.responses import FileResponse
from anyio import to_thread

from app.config.config_reader import config


router = APIRouter(prefix="/images", tags=["Images"])

# Разрешённые размеры TMDB.
ALLOWED_SIZES: Final[set[str]] = {
    "w92",
    "w154",
    "w185",
    "w342",
    "w500",
    "w780",
    "original",
}

_LOCKS: dict[str, asyncio.Lock] = {}


def _get_lock(key: str) -> asyncio.Lock:
    """Лок на ключ картинки (чтобы не качать один файл параллельно)."""
    lock = _LOCKS.get(key)
    if lock is None:
        lock = asyncio.Lock()
        _LOCKS[key] = lock
    return lock


def _media_type_from_suffix(suffix: str) -> str:
    suffix = (suffix or "").lower()
    if suffix in {".jpg", ".jpeg"}:
        return "image/jpeg"
    if suffix == ".png":
        return "image/png"
    if suffix == ".webp":
        return "image/webp"
    if suffix == ".gif":
        return "image/gif"
    return "application/octet-stream"


def _safe_cache_path(size: str, file_path: str, cache_root: Path) -> Path:
    """Безопасное имя файла в кэше (sha256 от size+file_path)."""
    ext = Path(file_path).suffix or ".jpg"
    key = f"{size}/{file_path}".encode("utf-8", errors="ignore")
    digest = hashlib.sha256(key).hexdigest()
    return cache_root / f"{digest}{ext}"


def _cleanup_cache_if_needed(cache_root: Path) -> None:
    """Чистим кэш по TTL и лимиту размера (простая LRU по mtime)."""
    cache_root.mkdir(parents=True, exist_ok=True)

    max_bytes = int(config.TMDB_IMAGE_CACHE_MAX_BYTES)
    max_age_days = int(config.TMDB_IMAGE_CACHE_MAX_AGE_DAYS)
    max_age_seconds = max_age_days * 86400 if max_age_days > 0 else 0
    now = time.time()

    files: list[tuple[Path, int, float]] = []
    total = 0

    for p in cache_root.glob("*"):
        if not p.is_file():
            continue
        try:
            st = p.stat()
        except OSError:
            continue

        size_bytes = int(st.st_size)
        mtime = float(st.st_mtime)

        if max_age_seconds and (now - mtime) > max_age_seconds:
            try:
                p.unlink(missing_ok=True)
            except OSError:
                pass
            continue

        files.append((p, size_bytes, mtime))
        total += size_bytes

    if total <= max_bytes:
        return

    files.sort(key=lambda x: x[2])  # старые -> новые
    for p, size_bytes, _mtime in files:
        if total <= max_bytes:
            break
        try:
            p.unlink(missing_ok=True)
            total -= size_bytes
        except OSError:
            # если не смогли удалить, идём дальше
            continue


def _download_to_file(remote_url: str, dest_path: Path) -> None:
    """
    Скачиваем картинку в temp-файл и затем атомарно переносим в dest_path.
    """
    cache_root = dest_path.parent
    cache_root.mkdir(parents=True, exist_ok=True)

    tmp_path = dest_path.with_suffix(dest_path.suffix + ".tmp")

    # User-Agent иногда помогает CDN/защитам, плюс полезно для логов на стороне TMDB.
    req = UrlRequest(
        remote_url,
        headers={
            "User-Agent": "KinoServer/1.0 (TMDB image cache proxy)",
            "Accept": "image/*,*/*;q=0.8",
        },
    )

    max_file_bytes = int(config.TMDB_IMAGE_CACHE_MAX_FILE_BYTES)
    downloaded = 0

    try:
        with urlopen(req, timeout=20) as resp:
            status = getattr(resp, "status", 200)
            if status >= 400:
                raise HTTPException(status_code=404, detail="Постер не найден в TMDB")

            with open(tmp_path, "wb") as f:
                while True:
                    chunk = resp.read(64 * 1024)
                    if not chunk:
                        break
                    downloaded += len(chunk)
                    if downloaded > max_file_bytes:
                        raise HTTPException(
                            status_code=413,
                            detail="Файл слишком большой для кэширования",
                        )
                    f.write(chunk)

        # Атомарная замена: если файл уже есть — перезапишем его безопасно.
        os.replace(tmp_path, dest_path)
    except HTTPError as e:
        # 404/403 и т.п.
        raise HTTPException(status_code=404, detail=f"TMDB вернул ошибку: {getattr(e, 'code', 'unknown')}") from e
    except URLError as e:
        raise HTTPException(status_code=502, detail="Не удалось скачать постер (ошибка сети)") from e
    finally:
        try:
            tmp_path.unlink(missing_ok=True)
        except OSError:
            pass


@router.get("/tmdb/{size}/{file_path:path}", name="tmdb_image")
async def tmdb_image(size: str, file_path: str):
    """
    Прокси для картинок TMDB с дисковым кэшем и ограничением по размеру.

    Пример: /images/tmdb/w780/abcd123.jpg
    """
    if size not in ALLOWED_SIZES:
        raise HTTPException(status_code=404, detail="Неизвестный размер картинки")

    # Простая защита от path traversal.
    normalized = (file_path or "").replace("\\", "/").lstrip("/")
    if not normalized or ".." in normalized.split("/"):
        raise HTTPException(status_code=400, detail="Некорректный путь к файлу")

    cache_root = Path(config.TMDB_IMAGE_CACHE_DIR)
    dest_path = _safe_cache_path(size=size, file_path=normalized, cache_root=cache_root)

    # Если уже есть в кэше — отдаём сразу и “трогаем” mtime (для LRU)
    if dest_path.exists():
        try:
            os.utime(dest_path, None)
        except OSError:
            pass
        return FileResponse(
            path=str(dest_path),
            media_type=_media_type_from_suffix(dest_path.suffix),
            headers={"Cache-Control": "public, max-age=86400"},
        )

    key = f"{size}/{normalized}"
    lock = _get_lock(key)

    async with lock:
        # Пока ждали лок, файл мог уже скачать другой запрос.
        if dest_path.exists():
            try:
                os.utime(dest_path, None)
            except OSError:
                pass
            return FileResponse(
                path=str(dest_path),
                media_type=_media_type_from_suffix(dest_path.suffix),
                headers={"Cache-Control": "public, max-age=86400"},
            )

        remote_url = urljoin(config.TMDB_IMAGE_BASE_URL.rstrip("/") + "/", f"{size}/{normalized}")

        # Скачивание делаем в thread, чтобы не блокировать event loop.
        await to_thread.run_sync(_download_to_file, remote_url, dest_path)

        # После скачивания — подчистим кэш, если он вышел за лимит.
        await to_thread.run_sync(_cleanup_cache_if_needed, cache_root)

        return FileResponse(
            path=str(dest_path),
            media_type=_media_type_from_suffix(dest_path.suffix),
            headers={"Cache-Control": "public, max-age=86400"},
        )

