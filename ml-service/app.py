from fastapi import FastAPI, UploadFile, File
from ultralytics import YOLO
import tempfile
import os

app = FastAPI()

model = YOLO("models/my_modelpcb.pt")

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    suffix = os.path.splitext(file.filename or "")[1] or ".jpg"

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    results = model.predict(tmp_path, conf=0.25, imgsz=640)

    detections = []
    for result in results:
        if result.boxes is None:
            continue

        for box in result.boxes:
            cls_id = int(box.cls[0])
            detections.append({
                "class": model.names[cls_id],
                "confidence": float(box.conf[0]),
                "box": [float(x) for x in box.xyxy[0]]
            })

    os.remove(tmp_path)

    return {"detections": detections}