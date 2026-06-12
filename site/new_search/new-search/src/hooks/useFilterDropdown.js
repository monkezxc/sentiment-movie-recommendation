import { useEffect, useRef, useState } from 'react'

function getDropdownPosition(buttonEl) {
    const rect = buttonEl.getBoundingClientRect()

    return {
        top: rect.bottom + 10,
        left: rect.left + rect.width / 2,
    }
}

export function useFilterDropdown() {
    const wrapRef = useRef(null)
    const buttonRef = useRef(null)
    const dropdownRef = useRef(null)
    const [isOpen, setIsOpen] = useState(false)
    const [dropdownPosition, setDropdownPosition] = useState(null)

    useEffect(() => {
        if (!isOpen || !buttonRef.current) return

        const updatePosition = () => {
            if (!buttonRef.current) return
            setDropdownPosition(getDropdownPosition(buttonRef.current))
        }

        updatePosition()

        window.addEventListener('resize', updatePosition)
        window.addEventListener('scroll', updatePosition, true)

        return () => {
            window.removeEventListener('resize', updatePosition)
            window.removeEventListener('scroll', updatePosition, true)
        }
    }, [isOpen])

    useEffect(() => {
        if (!isOpen) return

        const handlePointerDown = (event) => {
            const inWrap = wrapRef.current?.contains(event.target)
            const inDropdown = dropdownRef.current?.contains(event.target)

            if (!inWrap && !inDropdown) {
                setIsOpen(false)
            }
        }

        document.addEventListener('pointerdown', handlePointerDown)
        return () => document.removeEventListener('pointerdown', handlePointerDown)
    }, [isOpen])

    const toggle = () => setIsOpen((prev) => !prev)
    const close = () => setIsOpen(false)

    return {
        wrapRef,
        buttonRef,
        dropdownRef,
        isOpen,
        setIsOpen,
        dropdownPosition,
        toggle,
        close,
    }
}
