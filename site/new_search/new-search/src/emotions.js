export const EMOTION_META = {
    sadness: { label: 'Грусть', emoji: '😢' },
    optimism: { label: 'Оптимизм', emoji: '😊' },
    fear: { label: 'Страх', emoji: '😨' },
    anger: { label: 'Гнев', emoji: '😠' },
    neutral: { label: 'Нейтральность', emoji: '😐' },
    worry: { label: 'Беспокойство', emoji: '😟' },
    love: { label: 'Любовь', emoji: '❤️' },
    fun: { label: 'Веселье', emoji: '😄' },
    boredom: { label: 'Скука', emoji: '😴' },
}

/** Скрыта в UI и выдаче */
export const EXCLUDED_OUTPUT_EMOTIONS = new Set(['neutral'])

export function isOutputEmotion(emotion) {
    return Boolean(emotion) && !EXCLUDED_OUTPUT_EMOTIONS.has(emotion)
}

export function stripExcludedEmotions(ratings) {
    if (!ratings || typeof ratings !== 'object') {
        return {}
    }
    return Object.fromEntries(
        Object.entries(ratings).filter(([key]) => !EXCLUDED_OUTPUT_EMOTIONS.has(key)),
    )
}

export const EMOTION_OPTIONS = Object.entries(EMOTION_META)
    .filter(([id]) => !EXCLUDED_OUTPUT_EMOTIONS.has(id))
    .map(([id, meta]) => ({
        id,
        label: meta.label,
        emoji: meta.emoji,
    }))

export const EMOTION_COLORS = {
    anger: '#D32F2F',
    fear: '#1A1A2E',
    fun: '#FFD93D',
    neutral: '#9E9E9E',
    sadness: '#4A6FA5',
    worry: '#7E57C2',
    embarrassment: '#F48FB1',
    optimism: '#FDD835',
    love: '#E91E63',
    boredom: '#A8A8A8',
}

export const EMOTION_BLOB_COLORS = {
    anger: ['#D32F2F', '#8B0000', '#FF6F00'],
    fear: ['#2C3E50', '#1A1A2E', '#6C757D'],
    fun: ['#FFD93D', '#FF6B6B', '#4D96FF'],
    neutral: ['#9E9E9E', '#BDBDBD', '#E0E0E0'],
    sadness: ['#4A6FA5', '#6B7280', '#A7BBC7'],
    worry: ['#7E57C2', '#78909C', '#B0BEC5'],
    embarrassment: ['#F8BBD0', '#F48FB1', '#FFCCBC'],
    optimism: ['#FDD835', '#81C784', '#64B5F6'],
    love: ['#E91E63', '#C2185B', '#FF8A80'],
    boredom: ['#A8A8A8', '#C7C7C7', '#8D99AE'],
}

export const DEFAULT_BLOB_COLORS = ['#e05263', '#69a2b0', '#a1c084']

export function getBlobColorsForEmotion(emotion) {
    if (!emotion) return DEFAULT_BLOB_COLORS
    return EMOTION_BLOB_COLORS[emotion] || DEFAULT_BLOB_COLORS
}

function hexToRgba(hex, alpha = 0.92) {
    const normalized = hex.replace('#', '')
    const r = Number.parseInt(normalized.slice(0, 2), 16)
    const g = Number.parseInt(normalized.slice(2, 4), 16)
    const b = Number.parseInt(normalized.slice(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function getEmotionTextColor(hex) {
    const normalized = hex.replace('#', '')
    const r = Number.parseInt(normalized.slice(0, 2), 16) / 255
    const g = Number.parseInt(normalized.slice(2, 4), 16) / 255
    const b = Number.parseInt(normalized.slice(4, 6), 16) / 255
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
    return luminance > 0.55 ? '#1c1c1c' : '#f2f2f7'
}

export function getTopEmotionKey(emotionRatings) {
    const [top] = getTopEmotions(emotionRatings, 1)
    return top?.key || null
}

function getEmotionBoxShadow(hex) {
    return `0 0 15px ${hexToRgba(hex, 0.85)}`
}

export function getEmotionContainerStyle(emotionKey) {
    const color = EMOTION_COLORS[emotionKey]
    if (!color) return null

    return {
        backgroundColor: hexToRgba(color),
        color: getEmotionTextColor(color),
        boxShadow: getEmotionBoxShadow(color),
    }
}

export function getTopEmotions(emotionRatings, topN = 3) {
    const entries = Object.entries(emotionRatings || {})
        .filter(([key, rating]) => (
            !EXCLUDED_OUTPUT_EMOTIONS.has(key)
            && typeof rating === 'number'
            && Number.isFinite(rating)
        ))
        .sort(([, a], [, b]) => b - a)
        .slice(0, topN)

    const result = []
    for (let i = 0; i < topN; i++) {
        const [key, rating] = entries[i] || [null, null]
        if (!key || rating === null) {
            result.push({ key: null, label: '—', emoji: '', rating: null })
            continue
        }
        const meta = EMOTION_META[key] || { label: key, emoji: '🤔' }
        result.push({ key, label: meta.label, emoji: meta.emoji, rating })
    }
    return result
}
