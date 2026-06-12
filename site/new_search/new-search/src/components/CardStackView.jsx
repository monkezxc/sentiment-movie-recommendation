import { useEffect, useRef } from 'react'
import { createCardStack } from '../legacy/createCardStack.js'
import { initViewportHeightFix } from '../../../../js/viewport_fix.js'
import { initUserContext } from '../../../../js/user_gate.js'
import { resolveUserId } from '../config.js'
export default function CardStackView({ query, queryType, emotionFilter, photoFilter, genreFilter, surveyFilter, onLoading }) {
    const wrapperRef = useRef(null)
    const loaderRef = useRef(null)

    useEffect(() => {
        initViewportHeightFix()
    }, [])

    useEffect(() => {
        const wrapperEl = wrapperRef.current
        const loaderEl = loaderRef.current
        if (!wrapperEl || !loaderEl) return

        const { userId, username } = initUserContext()
        const effectiveUserId = resolveUserId(userId)

        const stack = createCardStack({
            wrapperEl,
            loaderEl,
            userId: effectiveUserId,
            username,
        })

        stack.init()

        let cancelled = false

        const boot = async () => {
            onLoading?.(true)
            try {
                await stack.reloadFeed({ query, queryType, emotionFilter, photoFilter, genreFilter, surveyFilter })
            } finally {
                if (!cancelled) onLoading?.(false)
            }
        }

        boot()

        return () => {
            cancelled = true
            stack.destroy()
        }
    }, [query, queryType, emotionFilter, photoFilter, genreFilter, surveyFilter, onLoading])

    return (
        <div className="legacy_stack_shell">
            <div ref={wrapperRef} className="cards-wrapper" />

            <div ref={loaderRef} className="app-loader" aria-hidden="true">
                <div className="loader" aria-label="Загрузка">
                    <svg width="100" height="100" viewBox="0 0 100 100">
                        <defs>
                            <mask id="clipping">
                                <polygon points="0,0 100,0 100,100 0,100" fill="black" />
                                <polygon points="25,25 75,25 50,75" fill="white" />
                                <polygon points="50,25 75,75 25,75" fill="white" />
                                <polygon points="35,35 65,35 50,65" fill="white" />
                            </mask>
                        </defs>
                    </svg>
                    <div className="box" />
                </div>
            </div>
        </div>
    )
}
