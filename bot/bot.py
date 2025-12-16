import asyncio
import os
import logging
import hashlib
from random import choice as rc
from contextlib import asynccontextmanager

import asyncpg
from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command
from aiogram.fsm.storage.memory import MemoryStorage
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()


def hash_user_id(user_id: int) -> str:
    random_words = os.getenv("RANDOM_WORDS").split(',')
    hashed = hashlib.sha256(str(user_id).encode("utf-8")).hexdigest()
    hashed_final = hashed + str(rc(random_words)) + str(rc(random_words)) + str(rc(random_words))
    return hashed_final


class Database:
    def __init__(self):
        self.pool = None

    async def init(self):
        max_retries = 3
        for attempt in range(max_retries):
            try:
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
                            user_id TEXT UNIQUE NOT NULL,
                            liked_movies JSONB NOT NULL DEFAULT '[]'::jsonb,
                            disliked_movies JSONB NOT NULL DEFAULT '[]'::jsonb,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

    async def add_user(self, telegram_id: int, user_id: str, link: str):
        try:
            async with self.transaction() as conn:
                await conn.execute(
                    """
                    INSERT INTO favorite (telegram_id, user_id, link, liked_movies, disliked_movies)
                    VALUES ($1, $2, $3, '[]'::jsonb, '[]'::jsonb)
                    ON CONFLICT (telegram_id) DO NOTHING
                    """,
                    telegram_id,
                    user_id,
                    link,
                )
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
        # Проверяем по telegram_id, так как хэш теперь случайный при каждой генерации
        if await db.user_exists(message.from_user.id):
            user_link = await db.get_user_link(message.from_user.id)
            await message.answer(f"Добро пожаловать обратно!\nВаша ссылка: {user_link}")
            return

        hashed_user_id = hash_user_id(message.from_user.id)
        user_link = f"http://127.0.0.1:5500/site/index.html?user={hashed_user_id}"

        await db.add_user(message.from_user.id, hashed_user_id, user_link)
        await message.answer(
            "Спасибо, что воспользовались нашим ботом\n"
            f"Ссылка для захода в ваш аккаунт: {user_link}"
        )
    except Exception as e:
        logger.error(f"Error in start handler: {e}")
        await message.answer("Произошла ошибка, попробуйте позже.")


@dp.message(Command("link"))
async def link_handler(message: types.Message):
    try:
        user_link = await db.get_user_link(message.from_user.id)
        if user_link:
            await message.answer(f"Ваша ссылка: {user_link}")
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