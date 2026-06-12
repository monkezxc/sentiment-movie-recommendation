function ThumbUpIcon({ filled = false }) {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
            <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
        </svg>
    )
}

function ThumbDownIcon({ filled = false }) {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z" />
            <path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
        </svg>
    )
}

export default function VoteButtons({
    isLiked = false,
    isDisliked = false,
    onLike,
    onDislike,
    disabled = false,
}) {
    const stop = (event) => event.stopPropagation()

    return (
        <div className="movie_vote_actions" onClick={stop} onKeyDown={stop}>
            <button
                type="button"
                className={`movie_vote_btn movie_vote_btn--like${isLiked ? ' is_active' : ''}`}
                aria-label={isLiked ? 'Убрать лайк' : 'Нравится'}
                aria-pressed={isLiked}
                disabled={disabled}
                onClick={(event) => {
                    stop(event)
                    onLike?.()
                }}
            >
                <ThumbUpIcon filled={isLiked} />
            </button>
            <button
                type="button"
                className={`movie_vote_btn movie_vote_btn--dislike${isDisliked ? ' is_active' : ''}`}
                aria-label={isDisliked ? 'Убрать дизлайк' : 'Не нравится'}
                aria-pressed={isDisliked}
                disabled={disabled}
                onClick={(event) => {
                    stop(event)
                    onDislike?.()
                }}
            >
                <ThumbDownIcon filled={isDisliked} />
            </button>
        </div>
    )
}
