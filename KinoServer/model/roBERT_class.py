'''
Загрузка модели roberta-base-go_emotions
'''

from transformers import pipeline

classifier = pipeline(task="text-classification", model="SamLowe/roberta-base-go_emotions", top_k=None)


from transformers import pipeline

# Глобальная переменная для модели
_emotion_classifier = None

def get_classifier():
    """
    Загружает модель
    Возвращает готовую модель для классификации
    """
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



"""
Классификатор эмоций с переводом через deeptranslate
"""

from typing import Dict, List
from deep_translator import GoogleTranslator

class EmotionClassifier:
    """
    Классификатор эмоций с автоматическим переводом.
    Использует deeptranslate для качественного перевода.
    """
    
    def __init__(self):
        """Инициализация с загрузкой модели"""
        self.classifier = get_classifier()
        
        # Инициализируем переводчик
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
        
        # Маппинг оригинальных эмоций в целевые
        
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
        """
        Простая проверка: русский ли текст
        
        Args:
            text: Текст для проверки
            
        Returns:
            True если есть русские буквы
        """
        if not text or not isinstance(text, str):
            return False
        
        for char in text:
            if ('а' <= char <= 'я') or ('А' <= char <= 'Я') or char in 'ёЁ':
                return True
        
        return False
    
    def translate_ru_to_en(self, text: str) -> str:
        """
        Переводит русский текст на английский с помощью deeptranslate.
        
        Args:
            text: Русский текст
            
        Returns:
            str: Английский перевод
        """
        try:
            if not self.is_russian(text):
                return text
            
            # Используем GoogleTranslator из deep_translator
            translated = self.translator_ru_en.translate(text)
            return translated
        except Exception as e:
            print(f"Ошибка перевода: {e}")
            # Fallback: возвращаем оригинальный текст
            return text
    
    def prepare_text(self, text: str, translate: bool = True) -> tuple:
        """
        Подготавливает текст для модели.
        
        Args:
            text: Исходный текст
            translate: Нужно ли переводить
            
        Returns:
            tuple: (обработанный_текст, информация_о_переводе)
        """
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
        """
        Отправляет запрос к модели эмоций.
        
        Args:
            text: Текст на английском
            
        Returns:
            List[Dict]: Сырые предсказания модели
        """
        # Важно: у RoBERTa ограничение ~512 токенов. Длинные тексты могут падать с indexing error.
        # Поэтому включаем обрезку (truncation) — остальная логика (маппинг/топ-эмоция) не меняется.
        return self.classifier([text], truncation=True, max_length=512)[0]
    
    def map_emotions(self, raw_predictions: List[Dict]) -> Dict[str, float]:
        """
        Маппинг 28 -> 9
        
        Args:
            raw_predictions: Сырые предсказания модели
            
        Returns:
            Dict: Целевые эмоции с вероятностями
        """
        # Инициализируем скоры для всех целевых эмоций
        emotion_scores = {emotion: 0.0 for emotion in self.target_emotions}
        
        # Агрегируем скоры по правилам маппинга
        for target_emotion, source_emotions in self.emotion_mapping.items():
            for pred in raw_predictions:
                if pred['label'] in source_emotions:
                    emotion_scores[target_emotion] += pred['score']
        
        # Нормализуем
        total = sum(emotion_scores.values())
        if total > 0:
            emotion_scores = {k: v/total for k, v in emotion_scores.items()}
        
        return emotion_scores
    
    def classify(self, text: str, translate: bool = True) -> Dict:
        """
        Основная функция классификации эмоций
        
        Args:
            text: Текст для анализа
            translate: Переводить ли русский текст
            
        Returns:
            Dict: Результат классификации
        """
        # Подготовка текста
        processed_text, translation_info = self.prepare_text(text, translate)
        
        # Отправляем запрос
        raw_predictions = self.query_model(processed_text)
        
        # Мап эмоций
        mapped_emotions = self.map_emotions(raw_predictions)
        
        # Находим топ эмоции
        sorted_emotions = sorted(
            mapped_emotions.items(),
            key=lambda x: x[1],
            reverse=True
        )
        
        top_emotion, top_confidence = sorted_emotions[0]
        
        # 5. Формируем результат
        result = {
            'original_text': translation_info['original'],
            'top_emotion': top_emotion,
            'top_confidence': float(top_confidence),
            'all_emotions': {k: float(v) for k, v in mapped_emotions.items()}
        }
        
        return result
    
    def classify_simple(self, text: str) -> str:
        """
        Упрощенная версия: возвращает только название эмоции.
        
        Args:
            text: Текст для анализа
            
        Returns:
            str: Название эмоции
        """
        result = self.classify(text, translate=True)
        return result['top_emotion']
    


# Функция для быстрого создания классификатора
def create_classifier() -> EmotionClassifier:
    """Создает и возвращает классификатор эмоций."""
    return EmotionClassifier()


# Глобальный экземпляр для повторного использования
_global_classifier = None

def get_global_classifier() -> EmotionClassifier:
    """Возвращает глобальный экземпляр классификатора."""
    global _global_classifier
    if _global_classifier is None:
        _global_classifier = EmotionClassifier()
    return _global_classifier

classifier_instance = EmotionClassifier()