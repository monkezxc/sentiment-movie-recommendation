import { useEffect } from 'react'
import { getBlobColorsForEmotion } from '../emotions.js'

export default function Blobs({ emotion }) {
    useEffect(() => {
        const [blob1, blob2, blob3] = getBlobColorsForEmotion(emotion)
        const root = document.documentElement

        root.style.setProperty('--blob-1', blob1)
        root.style.setProperty('--blob-2', blob2)
        root.style.setProperty('--blob-3', blob3)
    }, [emotion])

    return (
        <div className="ambient_bg">
            <div className="blob_1 blob" />
            <div className="blob_2 blob" />
            <div className="blob_3 blob" />
        </div>
    )
}
