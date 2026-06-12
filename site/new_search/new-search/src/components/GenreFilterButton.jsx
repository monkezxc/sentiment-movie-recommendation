import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { filterGenresByQuery, GENRE_OPTIONS } from '../genres.js'
import { useFilterDropdown } from '../hooks/useFilterDropdown.js'

export default function GenreFilterButton({ value, onApply, onClear }) {
    const {
        wrapRef,
        buttonRef,
        dropdownRef,
        isOpen,
        dropdownPosition,
        toggle,
        close,
    } = useFilterDropdown()

    const [pendingGenre, setPendingGenre] = useState(value || '')
    const [searchQuery, setSearchQuery] = useState('')

    const isActive = Boolean(value)

    const visibleGenres = useMemo(
        () => filterGenresByQuery(GENRE_OPTIONS, searchQuery),
        [searchQuery],
    )

    useEffect(() => {
        if (isOpen) {
            setPendingGenre(value || '')
            setSearchQuery('')
        }
    }, [isOpen, value])

    const handleApply = () => {
        if (!pendingGenre) return
        onApply(pendingGenre)
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
                className={`filter_button color_red${isActive ? ' filter_button_active' : ''}`}
                onClick={toggle}
                aria-expanded={isOpen}
                aria-haspopup="listbox"
            >
                <span>Жанр</span>
                {isActive && (
                    <span
                        className="filter_clear_btn"
                        role="button"
                        tabIndex={0}
                        aria-label="Сбросить фильтр жанра"
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
                    aria-label="Фильтр по жанру"
                    style={{
                        top: dropdownPosition.top,
                        left: dropdownPosition.left,
                    }}
                >
                    <input
                        type="search"
                        className="filter_dropdown_search"
                        placeholder="Поиск жанра..."
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        autoFocus
                    />

                    <div className="filter_dropdown_options">
                        {visibleGenres.length === 0 && (
                            <p className="filter_dropdown_empty">Жанры не найдены</p>
                        )}

                        {visibleGenres.map((option) => {
                            const isSelected = pendingGenre === option.id

                            return (
                                <button
                                    key={option.id}
                                    type="button"
                                    role="option"
                                    aria-selected={isSelected}
                                    className={`filter_dropdown_option${isSelected ? ' filter_dropdown_option_active filter_dropdown_option_active_red' : ''}`}
                                    onClick={() => setPendingGenre(option.id)}
                                >
                                    <span className="filter_dropdown_option_label">
                                        {option.label}
                                    </span>
                                </button>
                            )
                        })}
                    </div>

                    <button
                        type="button"
                        className="filter_button color_red filter_dropdown_apply"
                        disabled={!pendingGenre}
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
