import os
import json
from typing import Any, Optional
from auto_tags import create_tags

BASE_PATH = "_film_data"


def load_json(path: str):
    with open(path, "r", encoding="utf-8") as f:
            return json.load(f)


def get_offline_reviews(kp_id: int):
    f_path = os.path.join(BASE_PATH, f"kp_reviews/reviews_{kp_id}.json")

    data = load_json(f_path)
    if data is None:
        return []

    reviews = []

    for r_data in data.get("items"):
        text = r_data.get("description")
        if text is not None:
            reviews.append(text)

    return reviews


class OfflineFilmData:
    def __init__(self):
        self.str_na = "Н/Д"
        self.str_error = "[ОШИБКА!]"
        self.str_not_specified = "Не указан(ы)"
        self.str_and_others = "и др."

    def _get_m_title(self, data) -> (str, bool):
        title = data.get("nameRu")
        foreign = False

        if title is None:
            title =  data.get("nameOriginal") or data.get("nameEn")
            foreign = True

        if title is None:
            title = self.str_error
            foreign = False

        return title, foreign

    def _get_m_names(self, data, key1, key2, capitalize=False) -> str:
        sub_data = data.get(key1, [])

        genres = [g[key2].capitalize() if capitalize else g[key2]
                  for g in sub_data if key2 in g]

        if genres:
            return ", ".join(genres)
        else:
            return self.str_not_specified

    def _get_m_personnel(self, data, job: str, limit: int=0) -> str:
        personnel = [person.get("nameRu") or person.get("nameEn")
                     for person in data if person.get("professionKey") == job]

        if 0 < limit < len(personnel):
            personnel = personnel[:limit]
            personnel.append(self.str_and_others)

        if personnel:
            return ", ".join(personnel)
        else:
            return self.str_not_specified

    @staticmethod
    def _get_movie_rating(data, score, count, scale):
        v_score = data.get(score)
        v_count = data.get(count)

        if v_score is None or v_count is None or v_count == 0:
            return 0, 0

        return v_score / scale * v_count, v_count

    def _get_m_average_rating(self, data) -> float:
        total_score = 0
        total_count = 0

        # 1. Good review
        for src_score, src_count, scale in (
            ("ratingGoodReview", "ratingGoodReviewVoteCount", 100),
            ("ratingKinopoisk", "ratingKinopoiskVoteCount", 10),
            ("ratingImdb", "ratingImdbVoteCount", 10),
            ("ratingFilmCritics", "ratingFilmCriticsVoteCount", 10),
            ("ratingRfCritics", "ratingRfCriticsVoteCount", 100),
        ):
            ts_score, ts_count = self._get_movie_rating(data, src_score, src_count, scale)
            total_score += ts_score
            total_count += ts_count

        if total_count == 0:
            return 0.0
        return total_score / total_count * 10

    def _get_film(self, kp_id: int) -> Optional[dict[str, Any]]:
        data = load_json(os.path.join(BASE_PATH, "kp_films", f"entity_{kp_id}.json"))
        data_staff = load_json(os.path.join(BASE_PATH, "kp_staff", f"staff_{kp_id}.json"))

        film_title, foreign_title = self._get_m_title(data)

        if data.get("type") != "FILM":
            # print(film_title, "- не фильм!")
            return None

        result = {
            "kinopoisk_id": kp_id,

            "title": film_title,
            "title_foreign": foreign_title,
            "release_year": data.get("year") or 0,
            "duration": data.get("filmLength") or 0,
            "genre": self._get_m_names(data, "genres", "genre", capitalize=True),

            "director": self._get_m_personnel(data_staff, "DIRECTOR", 3),
            "screenwriter": self._get_m_personnel(data_staff, "WRITER", 3),
            "actors": self._get_m_personnel(data_staff, "ACTOR", 10),

            "description": data.get("description") or data.get("shortDescription") or self.str_na,
            "horizontal_poster_url": data.get("logoUrl") or data.get("coverUrl") or "",
            "vertical_poster_url": data.get("posterUrl") or "",
            "country": self._get_m_names(data, "countries", "country"),
            "rating": self._get_m_average_rating(data),

            "tags": create_tags(data)
        }

        return result

    def get_all_films(self) -> list[dict[str, Any]]:
        work_dir = os.path.join(BASE_PATH, "kp_films")
        result = []

        for film_file in os.listdir(work_dir):
            if not film_file.lower().endswith(".json"): continue

            kp_id = int(film_file.replace("entity_", "").replace(".json", ""))
            film_data = self._get_film(kp_id)
            if film_data is not None:
                result.append(film_data)

        result.sort(key=lambda f: f["kinopoisk_id"])
        print("Загрузил", len(result), "фильмов!")
        return result


if __name__ == "__main__":
    with open(f"{BASE_PATH}/demo.json", "w", encoding="utf-8") as f0:
        dat = OfflineFilmData().get_all_films()
        json.dump(dat, f0, indent=4, ensure_ascii=False)
