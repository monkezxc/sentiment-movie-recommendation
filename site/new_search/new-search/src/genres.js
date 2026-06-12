// parser/genres.json
import genresData from '../../../../parser/genres.json'

export const GENRE_OPTIONS = genresData

export function filterGenresByQuery(options, query) {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return options

    return options.filter((option) => option.label.toLowerCase().includes(normalized))
}
