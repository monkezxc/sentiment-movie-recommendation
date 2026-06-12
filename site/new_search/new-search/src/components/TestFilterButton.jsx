import { useState } from 'react'
import SurveyModal from './SurveyModal.jsx'

const TOOLTIP_TEXT =
    'Пройдите краткий опрос, чтобы мы могли лучше понять Ваше настроение'

export default function TestFilterButton({ value, onApply, onClear }) {
    const [isModalOpen, setIsModalOpen] = useState(false)

    const isActive = Boolean(
        value && (value.genres?.length > 0 || value.emotions?.length > 0),
    )

    const handleOpen = () => {
        setIsModalOpen(true)
    }

    const handleClose = () => {
        setIsModalOpen(false)
    }

    const handleComplete = (result) => {
        onApply({
            genres: result.genres || [],
            emotions: result.emotions || [],
        })
        setIsModalOpen(false)
    }

    const handleClear = (event) => {
        event.preventDefault()
        event.stopPropagation()
        onClear()
    }

    return (
        <>
            <div className="filter_tooltip_wrap">
                <button
                    type="button"
                    className={`filter_button color_blue${isActive ? ' filter_button_active' : ''}`}
                    onClick={handleOpen}
                    aria-haspopup="dialog"
                >
                    <span>Тест</span>
                    {isActive && (
                        <span
                            className="filter_clear_btn"
                            role="button"
                            tabIndex={0}
                            aria-label="Сбросить результаты опроса"
                            onClick={handleClear}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault()
                                    handleClear(event)
                                }
                            }}
                        >
                            ×
                        </span>
                    )}
                </button>
                <span className="filter_tooltip" role="tooltip">
                    {TOOLTIP_TEXT}
                </span>
            </div>

            <SurveyModal
                isOpen={isModalOpen}
                onClose={handleClose}
                onComplete={handleComplete}
            />
        </>
    )
}
