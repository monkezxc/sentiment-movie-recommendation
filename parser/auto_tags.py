genre_tans = {
    "аниме": "anime",
    "биография": "biography",
    "боевик": "action",
    "вестерн": "western",
    "военный": "war",
    "детектив": "detective",
    "детский": "kids",
    "документальный": "documentary",
    "драма": "drama",
    "игра": "game",
    "история": "history",
    "комедия": "comedy",
    "концерт": "concert",
    "короткометражка": "short",
    "криминал": "criminal",
    "мелодрама": "melodrama",
    "музыка": "music",
    "мультфильм": "cartoon",
    "мюзикл": "musical",
    "новости": "news",
    "приключения": "adventures",
    "реальное ТВ": "real_tv",
    "семейный": "family",
    "спорт": "sport",
    "ток-шоу": "talk_show",
    "триллер": "thriller",
    "ужасы": "horror",
    "фантастика": "sci_fi",
    "фильм-нуар": "noir",
    "фэнтези": "fantasy",
    "церемония": "ceremony",
}

country_trans = {  # Не все страны. Только те, которые попались
        "Австралия": "australia",
        "Австрия": "austria",
        "Аргентина": "argentina",
        "Барбадос": "barbados",
        "Беларусь": "belarus",
        "Бельгия": "belgium",
        "Болгария": "bulgaria",
        "Босния и Герцеговина": "bosnia",
        "Бразилия": "brazil",
        "Великобритания": "england",
        "Венгрия": "hungary",
        "Вьетнам": "vietnam",
        "Гамбия": "gambia",
        "Гана": "ghana",
        "Германия": "germany",
        "Германия (ФРГ)": "germany",
        "Гонконг": "hong_kong",
        "Греция": "greece",
        "Дания": "denmark",
        "Доминикана": "dominican_rep",
        "Египет": "egypt",
        "Израиль": "israel",
        "Индия": "india",
        "Индонезия": "indonesia",
        "Иордания": "jordan",
        "Ирак": "iraq",
        "Иран": "iran",
        "Ирландия": "ireland",
        "Исландия": "iceland",
        "Испания": "spain",
        "Италия": "italy",
        "Казахстан": "kazakhstan",
        "Канада": "canada",
        "Катар": "qatar",
        "Кения": "kenya",
        "Кипр": "cyprus",
        "Китай": "china",
        "Колумбия": "colombia",
        "Корея Южная": "korea",
        "Латвия": "latvia",
        "Лихтенштейн": "liechtenstein",
        "Люксембург": "luxembourg",
        "Малайзия": "malaysia",
        "Мальта": "malta",
        "Марокко": "morocco",
        "Мексика": "mexico",
        "Нидерланды": "netherlands",
        "Новая Зеландия": "new_zealand",
        "Норвегия": "norway",
        "ОАЭ": "uae",
        "Остров Мэн": "man_isle",
        "Перу": "peru",
        "Польша": "poland",
        "Португалия": "portugal",
        "Россия": "russia",
        "Румыния": "romania",
        "СССР": "ussr",
        "США": "usa",
        "Саудовская Аравия": "saudi_arabia",
        "Сербия": "serbia",
        "Сингапур": "singapore",
        "Словакия": "slovakia",
        "Словения": "slovenia",
        "Таиланд": "thailand",
        "Тайвань": "taiwan",
        "Тунис": "tunisia",
        "Турция": "turkey",
        "Украина": "ukraine",
        "Филиппины": "philippines",
        "Финляндия": "finland",
        "Франция": "france",
        "Хорватия": "croatia",
        "Чехия": "czechia",
        "Чили": "chile",
        "Швейцария": "switzerland",
        "Швеция": "sweden",
        "Эстония": "estonia",
        "ЮАР": "south_africa",
        "Югославия": "yugoslavia",
        "Япония": "japan",
    }

def tag_year(data):
    year = data.get("year")

    if year is None:
        return None

    if year < 1900:
        return "years_pre_1900"

    decade = year // 10
    return f"years_{decade}0s"

def tag_duration(data):
    duration = data.get("filmLength")

    if duration is None:
        return None

    dur_h = duration // 60
    return f"duration_{dur_h}h"

def tags_general(data):
    return {
        tag_year(data),
        tag_duration(data),

        data.get("ratingAgeLimits") if data.get("ratingAgeLimits") else None,
        "age_mpaa_{}".format(data.get("ratingMpaa")) if data.get("ratingMpaa") else None,

        "has_3d" if data.get("has3D") else None,
        "has_imax" if data.get("hasImax") else None,
    }

def tags_country(data):
    result = set()

    for country in data.get("countries", []):
        if "country" in country:
            country_ru = country.get("country")
            country_en = country_trans.get(country_ru, "other")
            result.add("country_"+country_en)

    return result

def tags_genre(data):
    result = set()

    for genre in data.get("genres", []):
        if "genre" in genre:
            genre_ru = genre.get("genre")
            genre_en = genre_tans.get(genre_ru)
            if genre_en is not None:
                result.add("genre_"+genre_en)

    return result

def create_tags(data: dict):
    tags = set()

    tags |= tags_general(data)
    tags |= tags_country(data)
    tags |= tags_genre(data)

    return sorted(tag for tag in tags if tag is not None)
