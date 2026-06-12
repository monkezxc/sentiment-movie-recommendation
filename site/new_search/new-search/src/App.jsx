import SearchBar from './components/SearchBar'
import EmotionFilterButton from './components/EmotionFilterButton'
import GenreFilterButton from './components/GenreFilterButton'
import TestFilterButton from './components/TestFilterButton'
import PhotoFilterButton from './components/PhotoFilterButton'
import QueryTypeToggle from './components/QueryTypeToggle'
import RandomMoviesButton from './components/RandomMoviesButton'
import ViewModeToggle from './components/ViewModeToggle'
import CardStackView from './components/CardStackView'
import { useCallback, useEffect, useRef, useState } from 'react'
import MovieCard from './components/MovieCard'
import MovieDetailOverlay from './components/MovieDetailOverlay'
import FavoritesDrawer from './components/FavoritesDrawer.jsx'
import FavoritesToggleButton from './components/FavoritesToggleButton.jsx'
import Blobs from './components/Blobs'
import {
    getAvgEmotionRatingsByIds,
    getDislikedMovies,
    getLikedMovies,
    postDislike,
    postLike,
    removeDislike,
    removeLike,
} from './api.js'
import { createListFeedContext, fetchListMoviesPage, resolveActiveEmotion } from './listFeed.js'
import { MOVIES_PAGE_SIZE, resolveUserId } from './config.js'
import { initUserContext } from '../../../js/user_gate.js'
import { initViewportHeightFix } from '../../../js/viewport_fix.js'

function setRandomGlowColor() {
    const colors = ['#FFCAB18C', '#69A2B08C', '#6591578C', '#A1C0848C', '#E052638C']
    const color = colors[Math.floor(Math.random() * colors.length)]
    document.documentElement.style.setProperty('--searchbarGlow', color)
}

async function loadRatingsForMovies(movies) {
    const movieIds = movies.map((movie) => movie.id)
    return await getAvgEmotionRatingsByIds({ movieIds })
}

const LIST_USER_ID = resolveUserId(initUserContext().userId)

export default function App() {
    const [isSearchFocused, setIsSearchFocused] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [isLoadingMore, setIsLoadingMore] = useState(false)
    const [isResultBeingShown, setIsResultBeingShown] = useState(false)
    const [viewMode, setViewMode] = useState('cards')
    const [queryType, setQueryType] = useState('title')
    const [searchQuery, setSearchQuery] = useState('')
    const [submittedQuery, setSubmittedQuery] = useState('')
    const [movies, setMovies] = useState([])
    const [emotionRatingsMap, setEmotionRatingsMap] = useState({})
    const [loadError, setLoadError] = useState(null)
    const [hasMore, setHasMore] = useState(false)
    const [listMovieDetail, setListMovieDetail] = useState(null)

    const openListMovieDetail = useCallback((movie, origin = null) => {
        setListMovieDetail({
            movie,
            originRect: origin?.rect ?? null,
            startBorderRadius: origin?.borderRadius ?? null,
        })
    }, [])
    const [likedMovieIds, setLikedMovieIds] = useState(() => new Set())
    const [dislikedMovieIds, setDislikedMovieIds] = useState(() => new Set())
    const [votingMovieId, setVotingMovieId] = useState(null)
    const [favoritesOpen, setFavoritesOpen] = useState(false)
    const [emotionFilter, setEmotionFilter] = useState(null)
    const [photoFilter, setPhotoFilter] = useState(null)
    const [genreFilter, setGenreFilter] = useState(null)
    const [surveyFilter, setSurveyFilter] = useState(null)
    const [activeEmotion, setActiveEmotion] = useState(null)

    const listFeedRef = useRef(null)
    const filtersContainerRef = useRef(null)
    const [filtersOverflow, setFiltersOverflow] = useState(false)

    useEffect(() => {
        initViewportHeightFix()
    }, [])

    const handleCardLoading = useCallback((loading) => {
        setIsLoading(loading)
    }, [])

    const loadUserVotes = useCallback(async () => {
        const [liked, disliked] = await Promise.all([
            getLikedMovies({ userId: LIST_USER_ID }),
            getDislikedMovies({ userId: LIST_USER_ID }),
        ])
        setLikedMovieIds(new Set(liked))
        setDislikedMovieIds(new Set(disliked))
    }, [])

    const handleMovieVote = useCallback(async (movieId, voteType, isActive) => {
        const isLike = voteType === 'like'

        setVotingMovieId(movieId)

        if (isActive) {
            setLikedMovieIds((prev) => {
                const next = new Set(prev)
                if (isLike) next.delete(movieId)
                return next
            })
            setDislikedMovieIds((prev) => {
                const next = new Set(prev)
                if (!isLike) next.delete(movieId)
                return next
            })

            try {
                if (isLike) {
                    await removeLike({ userId: LIST_USER_ID, movieId })
                } else {
                    await removeDislike({ userId: LIST_USER_ID, movieId })
                }
            } catch (e) {
                console.error('Не удалось убрать оценку:', e)
                await loadUserVotes()
            } finally {
                setVotingMovieId(null)
            }
            return
        }

        setLikedMovieIds((prev) => {
            const next = new Set(prev)
            if (isLike) next.add(movieId)
            else next.delete(movieId)
            return next
        })
        setDislikedMovieIds((prev) => {
            const next = new Set(prev)
            if (isLike) next.delete(movieId)
            else next.add(movieId)
            return next
        })

        try {
            if (isLike) {
                await postLike({ userId: LIST_USER_ID, movieId })
            } else {
                await postDislike({ userId: LIST_USER_ID, movieId })
            }
        } catch (e) {
            console.error('Не удалось сохранить оценку:', e)
            await loadUserVotes()
        } finally {
            setVotingMovieId(null)
        }
    }, [loadUserVotes])

    const loadListMovies = useCallback(async () => {
        setIsLoading(true)
        setLoadError(null)
        setHasMore(false)

        try {
            const feedContext = await createListFeedContext({
                submittedQuery,
                queryType,
                emotionFilter,
                photoFilter,
                genreFilter,
                surveyFilter,
            })
            listFeedRef.current = feedContext

            const [{ movies: loadedMovies, hasMore: moreAvailable, feedContext: nextContext }] =
                await Promise.all([
                    fetchListMoviesPage({
                        feedContext,
                        userId: LIST_USER_ID,
                        limit: MOVIES_PAGE_SIZE,
                    }),
                    loadUserVotes(),
                ])

            listFeedRef.current = nextContext
            setMovies(loadedMovies)
            setHasMore(moreAvailable)

            const ratings = await loadRatingsForMovies(loadedMovies)
            setEmotionRatingsMap(ratings)
        } catch (e) {
            console.error('Не удалось загрузить фильмы:', e)
            setLoadError('Не удалось загрузить фильмы')
            setMovies([])
            setEmotionRatingsMap({})
            setHasMore(false)
            listFeedRef.current = null
        } finally {
            setIsLoading(false)
        }
    }, [submittedQuery, queryType, emotionFilter, photoFilter, genreFilter, surveyFilter, loadUserVotes])

    const handleLoadMore = async () => {
        if (!listFeedRef.current || isLoadingMore || !hasMore) return

        setIsLoadingMore(true)
        setLoadError(null)

        try {
            const { movies: loadedMovies, hasMore: moreAvailable, feedContext: nextContext } =
                await fetchListMoviesPage({
                    feedContext: listFeedRef.current,
                    userId: LIST_USER_ID,
                    limit: MOVIES_PAGE_SIZE,
                })

            listFeedRef.current = nextContext
            setMovies((prev) => [...prev, ...loadedMovies])
            setHasMore(moreAvailable)

            const ratings = await loadRatingsForMovies(loadedMovies)
            setEmotionRatingsMap((prev) => ({ ...prev, ...ratings }))
        } catch (e) {
            console.error('Не удалось загрузить ещё фильмы:', e)
            setLoadError('Не удалось загрузить ещё фильмы')
        } finally {
            setIsLoadingMore(false)
        }
    }

    useEffect(() => {
        if (!isResultBeingShown || viewMode !== 'list') return
        loadListMovies()
    }, [isResultBeingShown, viewMode, submittedQuery, queryType, emotionFilter, photoFilter, genreFilter, surveyFilter, loadListMovies])

    const handleEmotionFilterApply = (emotion) => {
        setPhotoFilter(null)
        setEmotionFilter(emotion)
        setIsResultBeingShown(true)
    }

    const handleEmotionFilterClear = () => {
        setEmotionFilter(null)
    }

    const handlePhotoFilterApply = (filter) => {
        setEmotionFilter(null)
        setPhotoFilter(filter)
        setIsResultBeingShown(true)
    }

    const handlePhotoFilterClear = () => {
        setPhotoFilter(null)
    }

    const handleGenreFilterApply = (genre) => {
        setGenreFilter(genre)
        setIsResultBeingShown(true)
    }

    const handleGenreFilterClear = () => {
        setGenreFilter(null)
    }

    const handleSurveyFilterApply = (filter) => {
        setSurveyFilter(filter)
        setIsResultBeingShown(true)
    }

    const handleSurveyFilterClear = () => {
        setSurveyFilter(null)
    }

    useEffect(() => {
        let cancelled = false

        const updateActiveEmotion = async () => {
            const emotion = await resolveActiveEmotion({
                emotionFilter,
                photoFilter,
                surveyFilter,
                submittedQuery,
                queryType,
            })
            if (!cancelled) setActiveEmotion(emotion)
        }

        updateActiveEmotion()

        return () => {
            cancelled = true
        }
    }, [emotionFilter, photoFilter, surveyFilter, submittedQuery, queryType])

    useEffect(() => {
        const container = filtersContainerRef.current
        if (!container) return

        const updateOverflow = () => {
            setFiltersOverflow(container.scrollWidth > container.clientWidth + 1)
        }

        updateOverflow()

        const observer = new ResizeObserver(updateOverflow)
        observer.observe(container)

        const track = container.querySelector('.filters_track')
        if (track) observer.observe(track)

        return () => observer.disconnect()
    }, [])

    const handleSearchSubmit = () => {
        setSubmittedQuery(searchQuery)
        setIsResultBeingShown(true)
    }

    const handleRandomMovies = () => {
        setSearchQuery('')
        setSubmittedQuery('')
        setIsResultBeingShown(true)
    }

    const showListResults = isResultBeingShown && viewMode === 'list'
    const showCardResults = isResultBeingShown && viewMode === 'cards'

    return (
        <div className="main_container">
            <Blobs emotion={activeEmotion} />
            <main className={`main_content${isResultBeingShown ? ' raised' : ''}`}>
                <div className="search_row">
                    <FavoritesToggleButton onClick={() => setFavoritesOpen(true)} />
                    <SearchBar
                        value={searchQuery}
                        onChange={setSearchQuery}
                        onSubmit={handleSearchSubmit}
                        onFocusChange={(focused) => {
                            setIsSearchFocused(focused)
                            if (focused) setRandomGlowColor()
                        }}
                        isFocused={isSearchFocused}
                    />
                    <ViewModeToggle value={viewMode} onChange={setViewMode} />
                </div>
                <div className="filters_scroll">
                    <div
                        ref={filtersContainerRef}
                        className={`filters_container${filtersOverflow ? ' filters_container_overflow' : ''}`}
                    >
                        <div className="filters_track">
                            <RandomMoviesButton onClick={handleRandomMovies} />
                            <QueryTypeToggle value={queryType} onChange={setQueryType} />
                            <GenreFilterButton
                                value={genreFilter}
                                onApply={handleGenreFilterApply}
                                onClear={handleGenreFilterClear}
                            />
                            <EmotionFilterButton
                                value={emotionFilter}
                                onApply={handleEmotionFilterApply}
                                onClear={handleEmotionFilterClear}
                            />
                            <TestFilterButton
                                value={surveyFilter}
                                onApply={handleSurveyFilterApply}
                                onClear={handleSurveyFilterClear}
                            />
                            <PhotoFilterButton
                                value={photoFilter}
                                onApply={handlePhotoFilterApply}
                                onClear={handlePhotoFilterClear}
                            />
                        </div>
                    </div>
                </div>
                {isResultBeingShown && isLoading && (
                    <p className="cards_status">Загрузка фильмов...</p>
                )}
                {showCardResults && isLoading && (
                    <p className="cards_status">Загрузка фильмов...</p>
                )}
                {showListResults && !isLoading && loadError && (
                    <p className="cards_status cards_status_error">{loadError}</p>
                )}
                {showListResults && !isLoading && !loadError && movies.length === 0 && (
                    <p className="cards_status">Фильмы не найдены</p>
                )}
                {showListResults && !isLoading && movies.length > 0 && (
                    <div className="cards_wrapper">
                        <section className="cards_container">
                            {movies.map((movie) => (
                                <MovieCard
                                    key={movie.id}
                                    title={movie.title}
                                    description={movie.description}
                                    posterUrl={movie.vertical_poster_url}
                                    emotionRatings={emotionRatingsMap[movie.id]}
                                    isLiked={likedMovieIds.has(movie.id)}
                                    isDisliked={dislikedMovieIds.has(movie.id)}
                                    voteDisabled={votingMovieId === movie.id}
                                    onLike={() => handleMovieVote(movie.id, 'like', likedMovieIds.has(movie.id))}
                                    onDislike={() => handleMovieVote(movie.id, 'dislike', dislikedMovieIds.has(movie.id))}
                                    onOpen={(origin) => openListMovieDetail(movie, origin)}
                                />
                            ))}
                            {hasMore && (
                                <div className="load_more_wrap">
                                    <button
                                        type="button"
                                        className="filter_button color_blue load_more_button"
                                        onClick={handleLoadMore}
                                        disabled={isLoadingMore}
                                    >
                                        {isLoadingMore ? 'Загрузка...' : 'Загрузить ещё'}
                                    </button>
                                </div>
                            )}
                        </section>
                    </div>
                )}
                {showCardResults && (
                    <div className="cards_wrapper cards_wrapper_stack">
                        <CardStackView
                            query={submittedQuery}
                            queryType={queryType}
                            emotionFilter={emotionFilter}
                            photoFilter={photoFilter}
                            genreFilter={genreFilter}
                            surveyFilter={surveyFilter}
                            onLoading={handleCardLoading}
                        />
                    </div>
                )}
            </main>
            <FavoritesDrawer
                open={favoritesOpen}
                onClose={() => setFavoritesOpen(false)}
                userId={LIST_USER_ID}
                onOpenMovie={openListMovieDetail}
                onVotesChange={loadUserVotes}
            />
            <div className="card_open_portal" aria-hidden="true" />
            <MovieDetailOverlay
                movie={listMovieDetail?.movie ?? null}
                originRect={listMovieDetail?.originRect ?? null}
                startBorderRadius={listMovieDetail?.startBorderRadius ?? null}
                onClose={() => setListMovieDetail(null)}
            />
        </div>
    )
}
