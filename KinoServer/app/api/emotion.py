deltas = [
    [(+2, -6), (+8, -2), (+5, +8), (+3, -3)],
    [(-3, -7), (+7, +7), (+6, -5), (+4, +5)],
    [(0,  -4), (+5, +4), (+6, -1), (-4, -5)],
    [(+9, -3), (-6, -4), (+6, +9), (-2, -2)],
    [(-1, -8), (+5, +8), (+6, -4), (+2, +3)],
    [(+4, -5), (+3, +9), (-4, +4), (+5, +2)]
]

recommendations = [
    # ( V limit, E limit, [Genres, ...], [Emotions, ...] )
    # ['sadness', 'fear', 'optimism', 'anger', 'neutral', 'worry', 'love', 'fun', 'boredom', 'embarrassment']

    # Критическое истощение
    (lambda v: True, lambda e: e <= -6,
     ["documentary", "history", "music"],
     ["neutral", "boredom"]),

    # Романтическое созерцание
    (lambda v: v > 0, lambda e: -6 < e < -2,
     ["melodrama", "drama", "biography"],
     ["sadness", "anger", "fear", "embarrassment"]),

    # Меланхолия / Грусть
    (lambda v: v <= 0, lambda e: -6 < e <= 0,
     ["drama", "sci_fi"],
     ["optimism", "fun", "embarrassment"]),

    # Спокойствие / Уют
    (lambda v: v > 0, lambda e: -2 <= e <= 3,
     ["comedy", "family", "cartoon"],
     ["neutral", "love"]),

    # Тревога / Поиск контроля
    (lambda v: v <= 0, lambda e: 0 < e <= 6,
     ["detective", "thriller", "criminal"],
     ["love", "sadness"]),

    # Драйв / Азарт
    (lambda v: v > 0, lambda e: e > 3,
     ["action", "adventures", "comedy", "fantasy"],
     ["worry", "fear"]),

    # Катарсис / Выплеск
    (lambda v: v <= 0, lambda e: e > 6,
     ["horror", "thriller", "drama"],
     ["sadness", "neutral", "boredom"]),
]

def get_cords(answers: list[int]):
    valency, energy = 0, 0
    total = len(answers)

    for answer, delta in zip(answers, deltas):
        dv, de = delta[answer]
        valency += dv
        energy += de

    return valency / total, energy / total

async def get_emotion_genres(answers: list[int]) -> dict[str, list[str]]:
    final_genres = set()
    final_emotions = set()
    v, e = get_cords(answers)

    for v_check, e_check, genres, emotions in recommendations:
        if v_check(v) and e_check(e):
            for genre in genres:
                final_genres.add(f"genre_{genre}")
            for emotion in emotions:
                final_emotions.add(emotion)

    return {
        "genres": list(final_genres),
        "emotions": list(final_emotions)
    }


async def test():
    answers = [0, 1, 3, 0, 1, 0]
    result = await get_emotion_genres(answers)
    print(result)

if __name__ == "__main__":
    import asyncio
    asyncio.run(test())
