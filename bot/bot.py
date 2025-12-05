import asyncio
import os
import logging
from contextlib import asynccontextmanager

import asyncpg
from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()


class Database:
    def __init__(self):
        self.pool = None

    async def init(self):
        max_retries = 3
        for attempt in range(max_retries):
            try:
                self.pool = await asyncpg.create_pool(
                    host=os.getenv('DB_HOST', 'localhost'),
                    port=os.getenv('DB_PORT', '5432'),
                    database=os.getenv('DB_NAME'),
                    user=os.getenv('DB_USER'),
                    password=os.getenv('DB_PASSWORD'),
                    min_size=1,
                    max_size=10
                )

                async with self.pool.acquire() as conn:
                    await conn.execute('''
                        CREATE TABLE IF NOT EXISTS users (
                            user_id BIGINT PRIMARY KEY,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        )
                    ''')
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

    async def user_exists(self, user_id: int) -> bool:
        try:
            async with self.pool.acquire() as conn:
                return await conn.fetchval(
                    'SELECT 1 FROM users WHERE user_id = $1', user_id
                ) is not None
        except Exception as e:
            logger.error(f"Error checking user existence: {e}")
            return False

    async def add_user(self, user_id: int):
        try:
            async with self.transaction() as conn:
                await conn.execute(
                    'INSERT INTO users (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING',
                    user_id
                )
        except Exception as e:
            logger.error(f"Error adding user: {e}")


db = Database()
bot = Bot(token=os.getenv('BOT_TOKEN'))
dp = Dispatcher()


@dp.message(Command('start'))
async def start_handler(message: types.Message):
    try:
        if await db.user_exists(message.from_user.id):
            return

        await db.add_user(message.from_user.id)
        await message.answer('Спасибо, что воспользовались нашим ботом')
    except Exception as e:
        logger.error(f"Error in start handler: {e}")


async def main():
    try:
        await db.init()
        await dp.start_polling(bot)
    except Exception as e:
        logger.error(f"Fatal error: {e}")
    finally:
        if db.pool:
            await db.pool.close()


if __name__ == '__main__':
    asyncio.run(main())