import { getEmotionContainerStyle, getTopEmotionKey, getTopEmotions } from '../emotions.js'
import VoteButtons from './VoteButtons.jsx'

export default function MovieCard({
    title,
    description,
    posterUrl,
    emotionRatings,
    isLiked = false,
    isDisliked = false,
    onLike,
    onDislike,
    voteDisabled = false,
    onOpen,
}) {
    const topEmotions = getTopEmotions(emotionRatings, 3)
    const topEmotionKey = getTopEmotionKey(emotionRatings)
    const ratingContainerStyle = getEmotionContainerStyle(topEmotionKey)

    const open = (target) => {
        onOpen?.({
            rect: target.getBoundingClientRect(),
            borderRadius: getComputedStyle(target).borderRadius,
        })
    }

    return (
        <div
            className="movie_card"
            role="button"
            tabIndex={0}
            onClick={(event) => open(event.currentTarget)}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    open(event.currentTarget)
                }
            }}
        >
            <section className="preview_container">
                <div className="poster_container">
                    {posterUrl ? (
                        <img className="poster" src={posterUrl} alt={title || 'Постер фильма'} loading="lazy" />
                    ) : (
                        <div className="poster poster_placeholder" aria-hidden="true" />
                    )}
                </div>
                <article className="info_container">
                    <h1 className="movie_title">{title || '—'}</h1>
                    <p className="movie_description">{description || '—'}</p>
                    <VoteButtons
                        isLiked={isLiked}
                        isDisliked={isDisliked}
                        onLike={onLike}
                        onDislike={onDislike}
                        disabled={voteDisabled}
                    />
                </article>
            </section>
            <article className="rating_container" style={ratingContainerStyle || undefined}>
                <ul className="rating_list">
                    {topEmotions.map((emotion, index) => (
                        <li key={emotion.key || `empty-${index}`} className="emotion_rating">
                            {emotion.emoji}{' '}
                            {typeof emotion.rating === 'number' ? emotion.rating.toFixed(1) : '—'}
                        </li>
                    ))}
                </ul>
            </article>
        </div>
    )
}
