"""Классификатор эмоций (roberta-base-go_emotions + перевод RU->EN)."""

from transformers import pipeline

_emotion_classifier = None

def get_classifier():
    """Ленивая загрузка модели."""
    global _emotion_classifier
    
    if _emotion_classifier is None:
        print("Загрузка модели")
        _emotion_classifier = pipeline(
            task="text-classification",
            model="SamLowe/roberta-base-go_emotions",
            top_k=None
        )
        print("Модель загружена")
    
    return _emotion_classifier



"""Классификатор эмоций с переводом через deep_translator."""

from typing import Dict, List
from deep_translator import GoogleTranslator

class EmotionClassifier:
    """Классификатор эмоций с переводом (RU->EN)."""
    
    def __init__(self):
        """Инициализация."""
        self.classifier = get_classifier()
        
        self.translator_ru_en = GoogleTranslator(source='ru', target='en')
        
        self.target_emotions = [
            'sadness',
            'fear',
            'optimism',
            'anger',
            'neutral',
            'worry',
            'love',
            'fun',
            'boredom']
        
        self.emotion_mapping = {
            'sadness': ['sadness'],
            'fear': ['fear', 'embarrassment', 'remorse'],
            'optimism': ['optimism', 'approval', 'pride', 'admiration'],
            'anger': ['anger', 'disapproval', 'disgust'],
            'neutral': ['neutral', 'realization', 'surprise', 'confusion'],
            'love': ['love', 'caring', 'desire'],
            'fun': ['amusement', 'excitement', 'joy'],
            'boredom': ['disappointment','annoyance'],
            'worry': ['nervousness']}

    
    def is_russian(self, text: str) -> bool:
        """Проверяет, есть ли в тексте русские буквы."""
        if not text or not isinstance(text, str):
            return False
        
        for char in text:
            if ('а' <= char <= 'я') or ('А' <= char <= 'Я') or char in 'ёЁ':
                return True
        
        return False
    
    def translate_ru_to_en(self, text: str) -> str:
        """Перевод RU->EN. Если перевод не удался — возвращаем исходный текст."""
        try:
            if not self.is_russian(text):
                return text
            
            translated = self.translator_ru_en.translate(text)
            return translated
        except Exception as e:
            print(f"Ошибка перевода: {e}")
            return text
    
    def prepare_text(self, text: str, translate: bool = True) -> tuple:
        """Готовит текст для модели и возвращает (text, meta)."""
        is_russian = self.is_russian(text)
        
        if is_russian:
            english_text = self.translate_ru_to_en(text)
            return english_text, {
                'original': text,
                'translated': english_text,
                'was_translated': True,
                'language': 'ru'
            }
        else:
            return text, {
                'original': text,
                'translated': text,
                'was_translated': False,
                'language': 'en' if not is_russian else 'ru'
            }
    
    def query_model(self, text: str) -> List[Dict]:
        """Запрос к модели (с обрезкой длинных текстов)."""
        return self.classifier([text], truncation=True, max_length=512)[0]
    
    def map_emotions(self, raw_predictions: List[Dict]) -> Dict[str, float]:
        """Маппинг 28 эмоций модели -> 9 целевых."""
        emotion_scores = {emotion: 0.0 for emotion in self.target_emotions}
        
        for target_emotion, source_emotions in self.emotion_mapping.items():
            for pred in raw_predictions:
                if pred['label'] in source_emotions:
                    emotion_scores[target_emotion] += pred['score']
        
        total = sum(emotion_scores.values())
        if total > 0:
            emotion_scores = {k: v/total for k, v in emotion_scores.items()}
        
        return emotion_scores
    
    def classify(self, text: str, translate: bool = True) -> Dict:
        """Классификация эмоций: топ-эмоция + распределение."""
        processed_text, translation_info = self.prepare_text(text, translate)
        
        raw_predictions = self.query_model(processed_text)
        
        mapped_emotions = self.map_emotions(raw_predictions)
        
        sorted_emotions = sorted(
            mapped_emotions.items(),
            key=lambda x: x[1],
            reverse=True
        )
        
        top_emotion, top_confidence = sorted_emotions[0]
        
        result = {
            'original_text': translation_info['original'],
            'top_emotion': top_emotion,
            'top_confidence': float(top_confidence),
            'all_emotions': {k: float(v) for k, v in mapped_emotions.items()}
        }
        
        return result
    
    def classify_simple(self, text: str) -> str:
        """Упрощённо: возвращает только название эмоции."""
        result = self.classify(text, translate=True)
        return result['top_emotion']
    


def create_classifier() -> EmotionClassifier:
    """Создает и возвращает классификатор эмоций."""
    return EmotionClassifier()


_global_classifier = None

def get_global_classifier() -> EmotionClassifier:
    """Возвращает глобальный экземпляр классификатора."""
    global _global_classifier
    if _global_classifier is None:
        _global_classifier = EmotionClassifier()
    return _global_classifier

classifier_instance = EmotionClassifier()