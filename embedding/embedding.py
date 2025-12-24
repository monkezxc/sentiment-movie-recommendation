from sentence_transformers import SentenceTransformer, util
import os

try:
    from huggingface_hub import login
    hf_token = os.getenv("HF_TOKEN")
    if hf_token:
        login(hf_token)
except Exception:
    pass

print("Загрузка модели Qwen3-Embedding-0.6B... (это может занять несколько минут)")
model = SentenceTransformer("Qwen/Qwen3-Embedding-0.6B")
print("Модель загружена!")

def to_embedding(query):
    # Возвращаем numpy array (так удобно делать .tolist() в API)
    return model.encode(query, prompt_name="query")

def sort_embeddings(query, data):
    """
    Сортирует фильмы по косинусной близости к запросу
    c фильтрацией некорректных записей, чтобы не падать.
    """
    try:
        expected_dim = len(query)
    except Exception:
        expected_dim = None

    valid_ids: list[int] = []
    valid_embeddings: list[list[float]] = []

    for movie in data:
        movie_id = movie.get("id")
        emb = movie.get("embedding")

        if movie_id is None:
            continue
        if not isinstance(emb, list) or not emb:
            continue
        if expected_dim is not None and len(emb) != expected_dim:
            continue

        # Приводим всё к float (на случай, если в JSON пришли int)
        try:
            emb_floats = [float(x) for x in emb]
        except (TypeError, ValueError):
            continue

        valid_ids.append(int(movie_id))
        valid_embeddings.append(emb_floats)

    if not valid_ids:
        return []

    # util.cos_sim возвращает матрицу (1, N); берём первую строку как 1D scores
    scores = util.cos_sim(query, valid_embeddings)[0]
    scores_list = [float(x) for x in scores]

    sorted_pairs = sorted(
        zip(valid_ids, scores_list),
        key=lambda pair: pair[1],
        reverse=True,
    )
    return [movie_id for movie_id, _score in sorted_pairs]


def handle_query(query, movies):
    query_embedding = to_embedding(query)

    sorted_ids = sort_embeddings(query_embedding, movies)

    return sorted_ids