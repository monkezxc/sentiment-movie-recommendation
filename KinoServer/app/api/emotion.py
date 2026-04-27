deltas = [
    [(+5, -6), (+7, +6), (-3, -5), (+3, +8)],
    [(-2, -3), (+6, -4), (-4, -7), (+4, -2)],
    [(-4, -5), (+5, +3), (+4, +7), (+6, +5)],
    [(+3, -5), (+4, +4), (+8, -6), (-2, -9)],
    [(-5, -4), (-3, +6), (+0, +0), (+5, +5)],
    [(+2, -3), (+7, -6), (+4, +8), (-6, 10)]
]

recommendations = [
    # ( V limit, E limit, [Genres, ...] )

    # Критическое истощение
    (lambda v: True, lambda e: e <= -6,
     ["documentary", "history", "music"]),

    # Романтическое созерцание
    (lambda v: v > 0, lambda e: -6 < e < -2,
     ["melodrama", "drama", "biography"]),

    # Меланхолия / Грусть
    (lambda v: v <= 0, lambda e: -6 < e <= 0,
     ["drama", "sci_fi"]),

    # Спокойствие / Уют
    (lambda v: v > 0, lambda e: -2 <= e <= 3,
     ["comedy", "family", "cartoon"]),

    # Тревога / Поиск контроля
    (lambda v: v <= 0, lambda e: 0 < e <= 6,
     ["detective", "thriller", "criminal"]),

    # Драйв / Азарт
    (lambda v: v > 0, lambda e: e > 3,
     ["action", "adventures", "comedy", "fantasy"]),

    # Катарсис / Выплеск
    (lambda v: v <= 0, lambda e: e > 6,
     ["horror", "thriller", "drama"]),
]

def get_cords(answers: list[int]):
    valency, energy = 0, 0
    total = len(answers)

    for answer, delta in zip(answers, deltas):
        dv, de = delta[answer]
        valency += dv
        energy += de

    return valency / total, energy / total

async def get_emotion_genres(answers: list[int]) -> list[str]:
    final_set = set()
    v, e = get_cords(answers)

    for v_check, e_check, genres in recommendations:
        if v_check(v) and e_check(e):
            for genre in genres:
                final_set.add(f"genre_{genre}")

    return list(final_set)


async def test():
    answers = [0, 1, 3, 0, 1, 0]
    result = await get_emotion_genres(answers)
    print(result)

if __name__ == "__main__":
    import asyncio
    asyncio.run(test())
