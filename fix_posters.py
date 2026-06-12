import os
import json
import psycopg2

AAA = 'E:/vibemovie_project/_film_data'  # тут путь до папки _film_data

conn = psycopg2.connect(
    dbname="vibemovie",
    user="postgres",
    password="postgres",
    host="localhost",
    port=5432
)

cur = conn.cursor(name="stream_cursor")
cur.execute("SELECT kinopoisk_id FROM movies")
update_cur = conn.cursor()

def load_json(p: str):
    if os.path.exists(p):
        with open(p, "r", encoding="utf-8") as f:
                return json.load(f)
    return {}

for kp_id in cur:
    # твоя логика
    path = f"{AAA}/kp_films/entity_{kp_id[0]}.json"
    data = load_json(path)

    new_value = data.get("coverUrl") or data.get("logoUrl") or data.get("posterUrl") or ""

    update_cur.execute(
        "UPDATE movies SET horizontal_poster_url = %s WHERE kinopoisk_id = %s",
        (new_value, kp_id[0])
    )

conn.commit()

#cur.close()
update_cur.close()
conn.close()
