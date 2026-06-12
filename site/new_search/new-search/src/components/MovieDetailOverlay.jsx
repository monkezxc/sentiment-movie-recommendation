import { useEffect, useRef } from 'react'
import { createListMovieViewer } from '../legacy/createListMovieViewer.js'
import { initUserContext } from '../../../../js/user_gate.js'
import { resolveUserId } from '../config.js'

export default function MovieDetailOverlay({ movie, originRect, startBorderRadius, onClose }) {
    const hostRef = useRef(null)
    const viewerRef = useRef(null)

    useEffect(() => {
        if (!movie || !hostRef.current) return undefined

        const { userId, username } = initUserContext()
        const viewer = createListMovieViewer({
            wrapperEl: hostRef.current,
            userId: resolveUserId(userId),
            username,
        })

        viewer.init()
        viewer.openMovie(movie, {
            startRect: originRect || null,
            startBorderRadius: startBorderRadius || null,
        })
        viewerRef.current = viewer

        const host = hostRef.current
        const observer = new MutationObserver(() => {
            if (!host.querySelector('.card')) {
                onClose?.()
            }
        })
        observer.observe(host, { childList: true })

        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                const card = host.querySelector('.card')
                card?.querySelector('.close-card-button')?.click()
            }
        }
        window.addEventListener('keydown', onKeyDown)

        return () => {
            observer.disconnect()
            window.removeEventListener('keydown', onKeyDown)
            viewer.destroy()
            viewerRef.current = null
        }
    }, [movie, originRect, startBorderRadius, onClose])

    if (!movie) return null

    return (
        <div
            ref={hostRef}
            className="list_movie_detail_host"
            aria-modal="true"
            role="dialog"
            aria-label={movie.title || 'Информация о фильме'}
        />
    )
}
