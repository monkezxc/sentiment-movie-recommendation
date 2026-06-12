"""Эмоции, которые хранятся в БД, но не участвуют в выдаче и рекомендациях."""

EXCLUDED_OUTPUT_EMOTIONS: frozenset[str] = frozenset({"neutral"})


def is_output_emotion(emotion: str | None) -> bool:
    return bool(emotion and emotion.strip() and emotion not in EXCLUDED_OUTPUT_EMOTIONS)


def strip_excluded_emotions(ratings: dict[str, float]) -> dict[str, float]:
    return {
        key: value
        for key, value in ratings.items()
        if key not in EXCLUDED_OUTPUT_EMOTIONS
    }


def filter_output_emotions(emotions: list[str]) -> list[str]:
    return [emotion for emotion in emotions if is_output_emotion(emotion)]
