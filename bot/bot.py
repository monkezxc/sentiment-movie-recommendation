import asyncio
import os
import logging
import hashlib
from random import choice as rc
from contextlib import asynccontextmanager
from urllib.parse import quote

import asyncpg
from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
from aiogram.utils.keyboard import InlineKeyboardBuilder
from dotenv import load_dotenv


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

def _get_database_url() -> str | None:
    return os.getenv("BOT_DATABASE_URL")


def _get_webapp_base_url() -> str:
    """Базовый URL фронтенда."""
    return os.getenv("WEBAPP_URL") or "https://vibemovie.ru"


def ease_link_kb(user_link: str):
    inline_kb_list = [
        [InlineKeyboardButton(text="Войти в VibeMovie", web_app=WebAppInfo(url=user_link))],
    ]
    return InlineKeyboardMarkup(inline_keyboard=inline_kb_list)

def hash_user_id(user_id: int) -> str:
    random_words = os.getenv("RANDOM_WORDS").split(',')
    hashed = hashlib.sha256(str(user_id).encode("utf-8")).hexdigest()
    hashed_final = hashed + str(rc(random_words)) + str(rc(random_words)) + str(rc(random_words))
    return hashed_final

async def get_username(user_id: int):  
    try:  
        user = await bot.get_chat(user_id)  
        return user.username  
    except Exception as e:  
        logger.exception("Не удалось получить username (user_id=%s)", user_id)
        return None  


class Database:
    def __init__(self):
        self.pool = None

    async def init(self):
        max_retries = 3
        for attempt in range(max_retries):
            try:
                db_url = _get_database_url()
                if db_url:
                    self.pool = await asyncpg.create_pool(dsn=db_url, min_size=1, max_size=10)
                else:
                    # Fallback для старых переменных.
                    self.pool = await asyncpg.create_pool(
                        host=os.getenv("DB_HOST", "localhost"),
                        port=os.getenv("DB_PORT", "5432"),
                        database=os.getenv("DB_NAME"),
                        user=os.getenv("DB_USER"),
                        password=os.getenv("DB_PASSWORD"),
                        min_size=1,
                        max_size=10,
                    )
                async with self.pool.acquire() as conn:
                    await conn.execute(
                        """
                        CREATE TABLE IF NOT EXISTS favorite (
                            id SERIAL PRIMARY KEY,
                            telegram_id BIGINT UNIQUE NOT NULL,
                            user_id TEXT UNIQUE NOT NULL,
                            link TEXT UNIQUE NOT NULL,
                            liked_movies JSONB NOT NULL DEFAULT '[]'::jsonb,
                            disliked_movies JSONB NOT NULL DEFAULT '[]'::jsonb,
                            username TEXT NOT NULL
                        )
                        """
                    )
                logger.info("Database initialized successfully")
                return
            except Exception as e:
                logger.error(f"Database connection attempt {attempt + 1} failed: {e}")
                if attempt == max_retries - 1:
                    raise
                await asyncio.sleep(2)

    @asynccontextmanager
    async def transaction(self):
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                yield conn

    async def user_exists(self, telegram_id: int) -> bool:
        try:
            async with self.pool.acquire() as conn:
                return (
                    await conn.fetchval(
                        "SELECT 1 FROM favorite WHERE telegram_id = $1", telegram_id
                    )
                    is not None
                )
        except Exception as e:
            logger.error(f"Error checking user existence: {e}")
            return False

    async def add_user(self, telegram_id: int, user_id: str, link: str, username: str):
        try:
            async with self.transaction() as conn:
                result = await conn.execute(
                    """
                    INSERT INTO favorite (telegram_id, user_id, link, liked_movies, disliked_movies, username)
                    VALUES ($1, $2, $3, '[]'::jsonb, '[]'::jsonb, $4)
                    ON CONFLICT (telegram_id) DO NOTHING
                    """,
                    telegram_id,
                    user_id,
                    link,
                    username,
                )
                logger.info("add_user: %s (telegram_id=%s)", result, telegram_id)
        except Exception as e:
            logger.error(f"Error adding user: {e}")

    async def get_user_link(self, telegram_id: int) -> str | None:
        try:
            async with self.pool.acquire() as conn:
                return await conn.fetchval(
                    "SELECT link FROM favorite WHERE telegram_id = $1", telegram_id
                )
        except Exception as e:
            logger.error(f"Error getting user link: {e}")
            return None


db = Database()
bot = Bot(token=os.getenv("BOT_TOKEN"))
dp = Dispatcher(storage=MemoryStorage())


@dp.message(Command("start"))
async def start_handler(message: types.Message):
    try:
        if await db.user_exists(message.from_user.id):
            user_link = await db.get_user_link(message.from_user.id)
            await message.answer(f"Добро пожаловать обратно!\nНажмите на ссылку или кнопку ниже, чтобы войти в свой аккаунт.\n{user_link}",
            reply_markup=ease_link_kb(user_link))
            return

        hashed_user_id = hash_user_id(message.from_user.id)
        username = message.from_user.username or message.from_user.full_name
        safe_username = quote(username or "")

        user_link = f"{_get_webapp_base_url().rstrip('/')}/?user={hashed_user_id}&username={safe_username}"
        await db.add_user(message.from_user.id, hashed_user_id, user_link, username)
        await message.answer(
            f"Добро пожаловать, {username}!\nНажмите ссылку или кнопку ниже, чтобы войти в свой аккаунт.\n{user_link}",
            reply_markup=ease_link_kb(user_link),
        )
    except Exception as e:
        logger.error(f"Error in start handler: {e}")
        await message.answer("Произошла ошибка, попробуйте позже.")


@dp.message(Command("link"))
async def link_handler(message: types.Message):
    try:
        user_link = await db.get_user_link(message.from_user.id)
        if user_link:
            await message.answer(
            f"Нажмите на ссылку или кнопку ниже, чтобы войти в свой аккаунт.\n{user_link}",
            reply_markup=ease_link_kb(user_link),
            )
        else:
            await message.answer("Вы еще не зарегистрированы. Нажмите /start")
    except Exception as e:
        logger.error(f"Error in link handler: {e}")
        await message.answer("Произошла ошибка, попробуйте позже.")


async def main():
    try:
        await db.init()
        await dp.start_polling(bot)
    except Exception as e:
        logger.error(f"Fatal error: {e}")
    finally:
        if db.pool:
            await db.pool.close()


if __name__ == "__main__":
    asyncio.run(main())