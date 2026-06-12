export const API_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').trim()
export const DEFAULT_USER_ID = '1'
export const MOVIES_PAGE_SIZE = 10

export function resolveUserId(raw) {
    const value = (raw ?? '').toString().trim()
    if (!value || value === 'null' || value === 'undefined') {
        return DEFAULT_USER_ID
    }
    return value
}
