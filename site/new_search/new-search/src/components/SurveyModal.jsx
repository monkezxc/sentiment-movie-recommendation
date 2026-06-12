import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { SURVEY_QUESTIONS } from '../surveyQuestions.js'
import { submitSurveyAnswers } from '../api.js'

const INITIAL_ANSWERS = {
    q1: null,
    q2: null,
    q3: null,
    q4: null,
    q5: null,
    q6: null,
}

export default function SurveyModal({ isOpen, onClose, onComplete }) {
    const [step, setStep] = useState(0)
    const [answers, setAnswers] = useState(INITIAL_ANSWERS)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState(null)

    useEffect(() => {
        if (!isOpen) return undefined

        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'

        const onKeyDown = (event) => {
            if (event.key === 'Escape' && !isSubmitting) {
                onClose()
            }
        }
        window.addEventListener('keydown', onKeyDown)

        return () => {
            document.body.style.overflow = previousOverflow
            window.removeEventListener('keydown', onKeyDown)
        }
    }, [isOpen, isSubmitting, onClose])

    useEffect(() => {
        if (isOpen) {
            setStep(0)
            setAnswers(INITIAL_ANSWERS)
            setError(null)
            setIsSubmitting(false)
        }
    }, [isOpen])

    if (!isOpen) return null

    const question = SURVEY_QUESTIONS[step]
    const answerKey = question.id
    const selectedAnswer = answers[answerKey]
    const isLastStep = step === SURVEY_QUESTIONS.length - 1

    const handleSelect = (optionIndex) => {
        setAnswers((prev) => ({ ...prev, [answerKey]: optionIndex }))
        setError(null)
    }

    const handleBack = () => {
        if (step > 0) setStep((prev) => prev - 1)
    }

    const handleNext = async () => {
        if (selectedAnswer === null) {
            setError('Выберите один из вариантов ответа')
            return
        }

        if (!isLastStep) {
            setStep((prev) => prev + 1)
            return
        }

        setIsSubmitting(true)
        setError(null)

        try {
            const result = await submitSurveyAnswers(answers)
            onComplete(result)
        } catch (e) {
            console.error('Не удалось отправить ответы опроса:', e)
            setError('Не удалось отправить ответы. Попробуйте ещё раз.')
        } finally {
            setIsSubmitting(false)
        }
    }

    return createPortal(
        <div
            className="survey_overlay"
            role="presentation"
            onClick={() => {
                if (!isSubmitting) onClose()
            }}
        >
            <div
                className="survey_dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="survey_dialog_title"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="survey_header">
                    <p className="survey_progress">
                        Вопрос {step + 1} из {SURVEY_QUESTIONS.length}
                    </p>
                    <button
                        type="button"
                        className="survey_close_btn"
                        aria-label="Закрыть опрос"
                        onClick={onClose}
                        disabled={isSubmitting}
                    >
                        ×
                    </button>
                </div>

                <div className="survey_body">
                    <p className="survey_category">{question.title}</p>
                    <h2 id="survey_dialog_title" className="survey_question">
                        {question.text}
                    </h2>

                    <div className="survey_options">
                        {question.options.map((option, index) => {
                            const isSelected = selectedAnswer === index

                            return (
                                <button
                                    key={option}
                                    type="button"
                                    className={`survey_option${isSelected ? ' survey_option_active' : ''}`}
                                    onClick={() => handleSelect(index)}
                                    disabled={isSubmitting}
                                >
                                    <span className="survey_option_index">{index + 1}</span>
                                    <span className="survey_option_text">{option}</span>
                                </button>
                            )
                        })}
                    </div>

                    {error && <p className="survey_error">{error}</p>}
                </div>

                <div className="survey_footer">
                    <button
                        type="button"
                        className="filter_button color_blue survey_nav_btn"
                        onClick={handleBack}
                        disabled={step === 0 || isSubmitting}
                    >
                        Назад
                    </button>
                    <button
                        type="button"
                        className="filter_button color_blue survey_nav_btn"
                        onClick={handleNext}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Отправка...' : isLastStep ? 'Завершить' : 'Далее'}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    )
}
