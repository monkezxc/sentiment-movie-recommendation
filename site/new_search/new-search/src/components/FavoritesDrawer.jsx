import { useCallback, useEffect, useState } from 'react'
import {
    clearDislikes,
    clearLikes,
    getAvgEmotionRatingsByIds,
    getDislikedMovies,
    getLikedMovies,
    getMoviesByIds,
    removeDislike,
    removeLike,
} from '../api.js'
import { getEmotionContainerStyle, getTopEmotionKey, getTopEmotions } from '../emotions.js'

function CloseIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    )
}

export default function FavoritesDrawer({
    open,
    onClose,
    userId,
    onOpenMovie,
    onVotesChange,
}) {
    const [tab, setTab] = useState('liked')
    const [movies, setMovies] = useState([])
    const [ratingsMap, setRatingsMap] = useState({})
    const [loading, setLoading] = useState(false)
    const [removingId, setRemovingId] = useState(null)
    const [clearingAll, setClearingAll] = useState(false)

    const loadMovies = useCallback(async () => {
        if (!userId) return
        setLoading(true)
        try {
            const ids = tab === 'liked'
                ? await getLikedMovies({ userId })
                : await getDislikedMovies({ userId })
            const loadedMovies = await getMoviesByIds({ movieIds: ids })
            setMovies(loadedMovies)
            setRatingsMap(await getAvgEmotionRatingsByIds({
                movieIds: loadedMovies.map((movie) => movie.id),
            }))
        } catch (e) {
            console.error('Не удалось загрузить оценки:', e)
            setMovies([])
            setRatingsMap({})
        } finally {
            setLoading(false)
        }
    }, [tab, userId])

    useEffect(() => {
        if (!open) return undefined
        loadMovies()
        const onKeyDown = (event) => {
            if (event.key === 'Escape') onClose?.()
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [open, loadMovies, onClose])

    const handleRemove = async (movieId) => {
        setRemovingId(movieId)
        try {
            if (tab === 'liked') await removeLike({ userId, movieId })
            else await removeDislike({ userId, movieId })
            await onVotesChange?.()
            await loadMovies()
        } catch (e) {
            console.error('Не удалось убрать оценку:', e)
        } finally {
            setRemovingId(null)
        }
    }

    const handleClearAll = async () => {
        if (movies.length === 0 || clearingAll) return
        setClearingAll(true)
        try {
            if (tab === 'liked') await clearLikes({ userId })
            else await clearDislikes({ userId })
            await onVotesChange?.()
            await loadMovies()
        } catch (e) {
            console.error('Не удалось очистить оценки:', e)
        } finally {
            setClearingAll(false)
        }
    }

    const handleOpenMovie = (movie, origin) => {
        onClose?.()
        onOpenMovie?.(movie, origin)
    }

    if (!open) return null

    const emptyText = tab === 'liked' ? 'Нет понравившихся фильмов' : 'Нет непонравившихся фильмов'
    const clearAllLabel = tab === 'liked' ? 'Удалить все лайки' : 'Удалить все дизлайки'

    return (
        <div className="favorites_drawer_root" role="presentation">
            <button type="button" className="favorites_drawer_backdrop" aria-label="Закрыть список" onClick={onClose} />
            <aside className="favorites_drawer" aria-label="Мои оценки" role="dialog" aria-modal="true">
                <header className="favorites_drawer__header">
                    <h2 className="favorites_drawer__title">Мои оценки</h2>
                    <button type="button" className="favorites_drawer__close" aria-label="Закрыть" onClick={onClose}>
                        <CloseIcon />
                    </button>
                </header>

                <div className="favorites_drawer__tabs" role="tablist">
                    <button
                        type="button"
                        role="tab"
                        aria-selected={tab === 'liked'}
                        className={`favorites_drawer__tab${tab === 'liked' ? ' is_active' : ''}`}
                        onClick={() => setTab('liked')}
                    >
                        Лайки
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={tab === 'disliked'}
                        className={`favorites_drawer__tab favorites_drawer__tab--dislike${tab === 'disliked' ? ' is_active' : ''}`}
                        onClick={() => setTab('disliked')}
                    >
                        Дизлайки
                    </button>
                </div>

                <div className="favorites_drawer__content">
                    {!loading && movies.length > 0 && (
                        <button
                            type="button"
                            className={`favorites_drawer__clear_all${tab === 'disliked' ? ' favorites_drawer__clear_all--dislike' : ''}`}
                            disabled={clearingAll}
                            onClick={handleClearAll}
                        >
                            {clearingAll ? 'Удаление...' : clearAllLabel}
                        </button>
                    )}
                    {loading && <p className="favorites_drawer__status">Загрузка...</p>}
                    {!loading && movies.length === 0 && <p className="favorites_drawer__empty">{emptyText}</p>}
                    {!loading && movies.length > 0 && (
                        <ul className="favorites_drawer__list">
                            {movies.map((movie) => {
                                const ratings = ratingsMap[movie.id]
                                const topEmotions = getTopEmotions(ratings, 3)
                                const topEmotionKey = getTopEmotionKey(ratings)
                                const ratingContainerStyle = getEmotionContainerStyle(topEmotionKey)

                                return (
                                    <li key={movie.id} className="favorites_drawer__item">
                                        <button
                                            type="button"
                                            className="favorites_drawer__item_main"
                                            onClick={(event) => {
                                                const target = event.currentTarget
                                                handleOpenMovie(movie, {
                                                    rect: target.getBoundingClientRect(),
                                                    borderRadius: getComputedStyle(target).borderRadius,
                                                })
                                            }}
                                        >
                                            <span className="favorites_drawer__item_title">{movie.title || '—'}</span>
                                            <span className="favorites_drawer__item_meta">
                                                {movie.release_year || '—'}
                                                {movie.director ? ` · ${movie.director}` : ''}
                                            </span>
                                            {topEmotions.length > 0 && (
                                                <div className="favorites_drawer__item_ratings rating_container" style={ratingContainerStyle || undefined}>
                                                    <ul className="rating_list favorites_drawer__rating_list">
                                                        {topEmotions.map((emotion, index) => (
                                                            <li key={emotion.key || `empty-${index}`} className="emotion_rating">
                                                                {emotion.emoji}{' '}
                                                                {typeof emotion.rating === 'number' ? emotion.rating.toFixed(1) : '—'}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </button>
                                        <button
                                            type="button"
                                            className={`favorites_drawer__remove${tab === 'disliked' ? ' favorites_drawer__remove--dislike' : ''}`}
                                            aria-label={tab === 'liked' ? 'Убрать лайк' : 'Убрать дизлайк'}
                                            disabled={removingId === movie.id}
                                            onClick={() => handleRemove(movie.id)}
                                        >
                                            <CloseIcon />
                                        </button>
                                    </li>
                                )
                            })}
                        </ul>
                    )}
                </div>
            </aside>
        </div>
    )
}
