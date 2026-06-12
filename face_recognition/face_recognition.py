import os

import cv2
from ultralytics import YOLO

_MODEL_DIR = os.path.dirname(os.path.abspath(__file__))
_MODEL_PATH = os.path.join(_MODEL_DIR, 'best.pt')

FACE_TO_APP_EMOTION = {
    'Anger': 'anger',
    'Contempt': 'anger',
    'Disgust': 'anger',
    'Fear': 'fear',
    'Happy': 'fun',
    'Neutral': 'neutral',
    'Sad': 'sadness',
    'Surprise': 'worry',
}


class FaceFoundAnalyse:
  def __init__(self) -> None:
     self.model = YOLO(_MODEL_PATH)
     self.faces = []
     self.img=0

  def detect_and_extract_faces(self, image_path):
      # Загружаем изображение
      self.img=image_path
      image = cv2.imread(image_path)
      if image is None:
          print("Ошибка: Изображение не найдено")
          return []

      # Конвертируем в RGB (для вывода) и серый (для детекции)
      image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
      gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

      # Инициализируем классификатор
      face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")

      # Ищем лица
      faces_coords = face_cascade.detectMultiScale(
          gray,
          scaleFactor=1.1,
          minNeighbors=5,
          minSize=(30, 30)
      )

      extracted_faces = []
      for (x, y, w, h) in faces_coords:
          # Вырезаем лицо из RGB оригинала
          face_img = image_rgb[y:y+h, x:x+w]
          extracted_faces.append(face_img)

      # блок для попытки найти лица, если не нашлись
      if extracted_faces == []:
        for i in range(2,6):
          faces_coords = face_cascade.detectMultiScale(
          gray,
          scaleFactor=1.1,
          minNeighbors=i,  # Меняем, может быть найдёт
          minSize=(30, 30))

          for (x, y, w, h) in faces_coords:
            # Вырезаем лицо из RGB оригинала
            face_img = image_rgb[y:y+h, x:x+w]
            extracted_faces.append(face_img)

          if extracted_faces != []:
            self.faces=extracted_faces
            return

      self.faces=extracted_faces
      return

  def emotion_analysis(self):
    emotions_list = []

    # Анализируем каждое лицо отдельно
    #  ДЛЯ АНАЛИЗА ОТДЕЛЬНЫХ ЛИЦ
    for face in self.faces:
      results = self.model(face)[0]
      if results.boxes is not None:
        for cls in results.boxes.cls.int().tolist():
          emotions_list.append(results.names[cls])

    # Анализируем всё изображение целиком
    #  ДЛЯ ТОГО ЧТОБЫ ХОТЬ ЧТО-ТО ТОЧНО ПОЙМАЛО
    results_full = self.model(self.img)[0]
    if results_full.boxes is not None:
      for cls in results_full.boxes.cls.int().tolist():
        emotions_list.append(results_full.names[cls])

    # Убираем дубликаты
    unique_emotions = []
    for emotion in emotions_list:
      if emotion not in unique_emotions:
        unique_emotions.append(emotion)

    self.faces = []
    self.img = 0
    return unique_emotions

FFA = FaceFoundAnalyse()


def map_face_emotion_to_app(raw_emotion: str) -> str | None:
    if not raw_emotion:
        return None
    normalized = raw_emotion.strip()
    if normalized in FACE_TO_APP_EMOTION:
        return FACE_TO_APP_EMOTION[normalized]
    lowered = normalized.lower()
    for face_emotion, app_emotion in FACE_TO_APP_EMOTION.items():
        if face_emotion.lower() == lowered:
            return app_emotion
    return lowered if lowered in {
        'sadness', 'optimism', 'fear', 'anger', 'neutral',
        'worry', 'love', 'fun', 'boredom',
    } else None


def analyze_photo_emotion(image_path: str) -> dict | None:
    """Определяет основную эмоцию на фото и возвращает id для фильтра рекомендаций."""
    FFA.detect_and_extract_faces(image_path)
    detected = FFA.emotion_analysis()
    if not detected:
        return None

    mapped = []
    for raw_emotion in detected:
        app_emotion = map_face_emotion_to_app(raw_emotion)
        if not app_emotion or app_emotion == 'neutral' or app_emotion in mapped:
            continue
        mapped.append(app_emotion)

    if not mapped:
        return None

    return {
        'emotion': mapped[0],
        'detected_emotions': detected,
        'mapped_emotions': mapped,
    }
