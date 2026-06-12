"""Совместимый Vector-тип для SQLAlchemy + asyncpg.

ПРОБЛЕМА:
`pgvector.sqlalchemy.Vector.result_processor` всегда дёргает `Vector._from_db`,
который умеет парсить только строку вида '[0.1,0.2,...]'. Но SQLAlchemy-адаптер
asyncpg (используемый под капотом `postgresql+asyncpg://`) для типа `vector`
сам декодирует значение в `list[float]` ещё ДО того, как оно попадёт в
`result_processor`. На выходе получаем падение:

    AttributeError: 'list' object has no attribute 'split'

ОБЫЧНАЯ РЕКОМЕНДАЦИЯ ИЗ ДОКУМЕНТАЦИИ pgvector ("просто используйте Vector в
SQLAlchemy") рассчитана на драйверы, отдающие `vector` как строку (psycopg/
psycopg2). У asyncpg-адаптера SQLAlchemy поведение другое — отсюда патч.

РЕШЕНИЕ:
Подклассируем штатный Vector и в `result_processor` обрабатываем оба случая —
`list` (от asyncpg через SQLAlchemy) и `str` (если когда-нибудь сменим драйвер
на psycopg). Bind-сторона штатная: pgvector сериализует list/ndarray в '[...]',
asyncpg отправляет это в Postgres как текст → Postgres кастует в vector.
"""

import numpy as np
from pgvector.sqlalchemy import Vector as _BaseVector


class Vector(_BaseVector):
    """Vector-тип, толерантный к asyncpg-декодированию в list."""

    # Без явного cache_ok=True SQLAlchemy при первом использовании
    # подклассированного типа выдаёт SAWarning о деградации кэша запросов.
    # Состояние нашего подкласса не отличается от родителя (нет новых
    # инстанс-полей сверх _BaseVector), значит кэшировать SQL по этому типу
    # безопасно.
    cache_ok = True

    def result_processor(self, dialect, coltype):
        base_proc = super().result_processor(dialect, coltype)

        def process(value):
            if value is None:
                return None
            if isinstance(value, np.ndarray):
                return value
            if isinstance(value, list):
                # asyncpg-адаптер SQLAlchemy уже распарсил '[0.1,...]' в list.
                # Дальнейший pgvector-парсер сломается — отдадим ndarray сами.
                return np.asarray(value, dtype=np.float32)
            return base_proc(value)

        return process
