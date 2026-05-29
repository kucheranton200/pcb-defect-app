import base64
import os
import tempfile

import cv2
from fastapi import FastAPI, File, UploadFile
from ultralytics import YOLO

app = FastAPI()

MODEL_CONF = float(os.getenv("MODEL_CONF", "0.5"))
MODEL_IMGSZ = int(os.getenv("MODEL_IMGSZ", "640"))
model = YOLO("models/my_modelpcb.pt")

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    suffix = os.path.splitext(file.filename or "")[1] or ".jpg"

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    results = model.predict(tmp_path, conf=MODEL_CONF, imgsz=MODEL_IMGSZ)

    detections = []
    annotated_image_base64 = None
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

        if detections and annotated_image_base64 is None:
            annotated_image = result.plot()
            success, buffer = cv2.imencode(".jpg", annotated_image)
            if success:
                annotated_image_base64 = base64.b64encode(buffer).decode("ascii")

    os.remove(tmp_path)

    return {
        "detections": detections,
        "annotatedImageBase64": annotated_image_base64,
    }
