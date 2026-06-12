from app.emotions import is_output_emotion

deltas = [
    [(+0.2, -0.6), (+0.8, -0.2), (+0.5, +0.8), (+0.3, -0.3)],
    [(-0.3, -0.7), (+0.7, +0.7), (+0.6, -0.5), (+0.4, +0.5)],
    [(0.0, -0.4), (+0.5, +0.4), (+0.6, -0.1), (-0.4, -0.5)],
    [(+0.9, -0.3), (-0.6, -0.4), (+0.6, +0.9), (-0.2, -0.2)],
    [(-0.1, -0.8), (+0.5, +0.8), (+0.6, -0.4), (+0.2, +0.3)],
    [(+0.4, -0.5), (+0.3, +0.9), (-0.4, +0.4), (+0.5, +0.2)],
]

recommendations = [
    # ( V limit, E limit, [Genres, ...], [Emotions, ...] )

    # Критическое истощение
    (lambda v: True, lambda e: e <= -0.6,
     ["documentary", "history", "music"],
     ["neutral", "boredom"]),

    # Романтическое созерцание
    (lambda v: v > 0, lambda e: -0.6 < e < -0.2,
     ["melodrama", "drama", "biography"],
     ["sadness", "anger", "fear", "embarrassment"]),

    # Меланхолия / Грусть
    (lambda v: v <= 0, lambda e: -0.6 < e <= 0,
     ["drama", "sci_fi"],
     ["optimism", "fun", "embarrassment"]),

    # Спокойствие / Уют
    (lambda v: v > 0, lambda e: -0.2 <= e <= 0.3,
     ["comedy", "family", "cartoon"],
     ["neutral", "love"]),

    # Тревога / Поиск контроля
    (lambda v: v <= 0, lambda e: 0 < e <= 0.6,
     ["detective", "thriller", "criminal"],
     ["love", "sadness"]),

    # Драйв / Азарт
    (lambda v: v > 0, lambda e: e > 0.3,
     ["action", "adventures", "comedy", "fantasy"],
     ["worry", "fear"]),

    # Катарсис / Выплеск
    (lambda v: v <= 0, lambda e: e > 0.6,
     ["horror", "thriller", "drama"],
     ["sadness", "neutral", "boredom"]),
]


def get_cords(answers: list[int]):
    valency, energy = 0.0, 0.0
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
                if is_output_emotion(emotion):
                    final_emotions.add(emotion)

    return {
        "genres": sorted(final_genres),
        "emotions": sorted(final_emotions),
        "valency": round(v, 4),
        "energy": round(e, 4),
    }


async def test():
    answers = [0, 1, 3, 0, 1, 0]
    result = await get_emotion_genres(answers)
    print(result)


if __name__ == "__main__":
    import asyncio
    asyncio.run(test())
