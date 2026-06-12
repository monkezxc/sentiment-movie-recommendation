function HeartListIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path
                d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    )
}

export default function FavoritesToggleButton({ onClick }) {
    return (
        <button
            type="button"
            className="favorites_toggle_btn glass-button"
            aria-label="Открыть список оценённых фильмов"
            onClick={onClick}
        >
            <HeartListIcon />
        </button>
    )
}
