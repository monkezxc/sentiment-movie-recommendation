const MODES = [
    { id: 'cards', label: 'Карточки' },
    { id: 'list', label: 'Список' },
]

export default function ViewModeToggle({ value, onChange }) {
    return (
        <div className="view_mode_toggle" role="radiogroup" aria-label="Режим отображения">
            {MODES.map((mode) => {
                const isActive = value === mode.id

                return (
                    <button
                        key={mode.id}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        className={`view_mode_button${isActive ? ' view_mode_button_active' : ''}`}
                        onClick={() => onChange(mode.id)}
                    >
                        {mode.label}
                    </button>
                )
            })}
        </div>
    )
}
