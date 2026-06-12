export default function RandomMoviesButton({ onClick }) {
    return (
        <button
            type="button"
            className="filter_button color_pink random_movies_button"
            onClick={onClick}
        >
            Рекомендации
        </button>
    )
}
