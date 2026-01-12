from roBERT_class import classifier_instance
i=True
while True:
    text = input()
    if text=="stop":
        break
    emotion = classifier_instance.classify_simple(text)
    print(emotion)