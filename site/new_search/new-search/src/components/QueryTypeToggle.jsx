const QUERY_TYPES = [
    { id: 'title', name: 'Название', color: 'purple' },
    { id: 'description', name: 'Описание', color: 'orange' },
]

export default function QueryTypeToggle ({ value, onChange }) {
    return (
        <div className="query_type_container" role="radiogroup" aria-label="Тип запроса">
            {QUERY_TYPES.map((option) => {
                const isActive = value === option.id

                return (
                    <button
                        key={option.id}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        className={`filter_button filter_button_${option.id} color_${option.color}${isActive ? ' filter_button_active' : ''}`}
                        onClick={() => onChange(option.id)}
                    >
                        {option.name}
                    </button>
                )
            })}
        </div>
    )
}
