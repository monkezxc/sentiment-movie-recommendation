import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { EMOTION_OPTIONS } from '../emotions.js'
import { useFilterDropdown } from '../hooks/useFilterDropdown.js'

export default function EmotionFilterButton({ value, onApply, onClear }) {
    const {
        wrapRef,
        buttonRef,
        dropdownRef,
        isOpen,
        dropdownPosition,
        toggle,
        close,
    } = useFilterDropdown()

    const [pendingEmotion, setPendingEmotion] = useState(value || '')

    const isActive = Boolean(value)

    useEffect(() => {
        if (isOpen) {
            setPendingEmotion(value || '')
        }
    }, [isOpen, value])

    const handleApply = () => {
        if (!pendingEmotion) return
        onApply(pendingEmotion)
        close()
    }

    const handleClear = (event) => {
        event.preventDefault()
        event.stopPropagation()
        onClear()
        close()
    }

    return (
        <div className="filter_dropdown_wrap" ref={wrapRef}>
            <button
                ref={buttonRef}
                type="button"
                className={`filter_button color_green${isActive ? ' filter_button_active' : ''}`}
                onClick={toggle}
                aria-expanded={isOpen}
                aria-haspopup="listbox"
            >
                <span>Эмоции</span>
                {isActive && (
                    <span
                        className="filter_clear_btn"
                        role="button"
                        tabIndex={0}
                        aria-label="Сбросить фильтр эмоций"
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

            {isOpen && dropdownPosition && createPortal(
                <div
                    ref={dropdownRef}
                    className="filter_dropdown filter_dropdown_portal filter_dropdown_searchable"
                    role="listbox"
                    aria-label="Фильтр по эмоциям"
                    style={{
                        top: dropdownPosition.top,
                        left: dropdownPosition.left,
                    }}
                >
                    <div className="filter_dropdown_options">
                        {EMOTION_OPTIONS.map((option) => {
                            const isSelected = pendingEmotion === option.id

                            return (
                                <button
                                    key={option.id}
                                    type="button"
                                    role="option"
                                    aria-selected={isSelected}
                                    className={`filter_dropdown_option${isSelected ? ' filter_dropdown_option_active' : ''}`}
                                    onClick={() => setPendingEmotion(option.id)}
                                >
                                    <span className="filter_dropdown_option_label">
                                        {option.label} {option.emoji}
                                    </span>
                                </button>
                            )
                        })}
                    </div>

                    <button
                        type="button"
                        className="filter_button color_green filter_dropdown_apply"
                        disabled={!pendingEmotion}
                        onClick={handleApply}
                    >
                        Применить
                    </button>
                </div>,
                document.body,
            )}
        </div>
    )
}
