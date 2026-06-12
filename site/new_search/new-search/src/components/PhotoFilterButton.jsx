import { useRef, useState } from 'react'
import { detectEmotionFromPhoto } from '../api.js'
import { EMOTION_META } from '../emotions.js'

const TOOLTIP_TEXT = 'Загрузите фото, чтобы определить эмоцию и подобрать фильмы'

export default function PhotoFilterButton({ value, onApply, onClear }) {
    const inputRef = useRef(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState(null)

    const isActive = Boolean(value?.emotion)

    const emotionLabel = value?.emotion
        ? (EMOTION_META[value.emotion]?.label || value.emotion)
        : null

    const handlePickPhoto = () => {
        if (isLoading) return
        setError(null)
        inputRef.current?.click()
    }

    const handleFileChange = async (event) => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (!file) return

        setIsLoading(true)
        setError(null)

        try {
            const result = await detectEmotionFromPhoto({ file })
            onApply({
                emotion: result.emotion,
                detectedEmotions: result.detected_emotions || [],
                mappedEmotions: result.mapped_emotions || [],
            })
        } catch (e) {
            console.error('Не удалось определить эмоцию по фото:', e)
            setError('Не удалось определить эмоцию. Попробуйте другое фото.')
        } finally {
            setIsLoading(false)
        }
    }

    const handleClear = (event) => {
        event.preventDefault()
        event.stopPropagation()
        setError(null)
        onClear()
    }

    const tooltipText = isActive && emotionLabel
        ? `Эмоция по фото: ${emotionLabel}`
        : TOOLTIP_TEXT

    return (
        <div className="filter_tooltip_wrap">
            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="photo_file_input"
                onChange={handleFileChange}
                tabIndex={-1}
                aria-hidden="true"
            />
            <button
                type="button"
                className={`filter_button color_yellow${isActive ? ' filter_button_active' : ''}`}
                onClick={handlePickPhoto}
                disabled={isLoading}
                aria-busy={isLoading}
            >
                <span>{isLoading ? 'Анализ...' : 'Фото'}</span>
                {isActive && !isLoading && (
                    <span
                        className="filter_clear_btn"
                        role="button"
                        tabIndex={0}
                        aria-label="Сбросить фильтр по фото"
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
                {tooltipText}
            </span>
            {error && <span className="photo_filter_error">{error}</span>}
        </div>
    )
}
