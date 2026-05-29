import os
import base64
import json
import subprocess
import time
import uuid
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv


load_dotenv()


BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:3000/api").rstrip("/")
ML_SERVICE_URL = os.getenv("ML_SERVICE_URL", "http://localhost:8000").rstrip("/")
ADMIN_LOGIN = os.getenv("ADMIN_LOGIN", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin")
CAMERA_MODE = os.getenv("CAMERA_MODE", "usb")
USB_DEVICE = os.getenv("USB_DEVICE", "/dev/video0")
DSHOW_DEVICE = os.getenv("DSHOW_DEVICE", "Integrated Camera")
RTSP_URL = os.getenv("RTSP_URL", "")
FRAME_INTERVAL_SECONDS = float(os.getenv("FRAME_INTERVAL_SECONDS", "0.5"))
FRAME_WIDTH = int(os.getenv("FRAME_WIDTH", "1280"))
FRAME_HEIGHT = int(os.getenv("FRAME_HEIGHT", "720"))
FRAME_DIR = Path(os.getenv("FRAME_DIR", "frames"))


def login() -> str:
    response = requests.post(
        f"{BACKEND_URL}/auth/login",
        json={"login": ADMIN_LOGIN, "password": ADMIN_PASSWORD},
        timeout=10,
    )
    response.raise_for_status()
    return response.json()["accessToken"]


def capture_frame(frame_path: Path) -> None:
    if CAMERA_MODE == "usb":
        command = [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-f",
            "v4l2",
            "-video_size",
            f"{FRAME_WIDTH}x{FRAME_HEIGHT}",
            "-i",
            USB_DEVICE,
            "-frames:v",
            "1",
            "-q:v",
            "2",
            str(frame_path),
        ]
    elif CAMERA_MODE == "dshow":
        command = [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-f",
            "dshow",
            "-video_size",
            f"{FRAME_WIDTH}x{FRAME_HEIGHT}",
            "-i",
            f"video={DSHOW_DEVICE}",
            "-frames:v",
            "1",
            "-q:v",
            "2",
            str(frame_path),
        ]
    elif CAMERA_MODE == "rtsp":
        if not RTSP_URL:
            raise RuntimeError("RTSP_URL is required when CAMERA_MODE=rtsp")

        command = [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-rtsp_transport",
            "tcp",
            "-i",
            RTSP_URL,
            "-frames:v",
            "1",
            "-q:v",
            "2",
            str(frame_path),
        ]
    else:
        raise RuntimeError(f"Unsupported CAMERA_MODE: {CAMERA_MODE}")

    subprocess.run(command, check=True)


def predict(frame_path: Path) -> dict[str, Any]:
    with frame_path.open("rb") as image:
        response = requests.post(
            f"{ML_SERVICE_URL}/predict",
            files={"file": (frame_path.name, image, "image/jpeg")},
            timeout=60,
        )
    response.raise_for_status()
    return response.json()

def save_annotated_image(frame_path: Path, annotated_image_base64: str) -> Path:
    annotated_path = frame_path.with_name(f"{frame_path.stem}-annotated.jpg")
    annotated_path.write_bytes(base64.b64decode(annotated_image_base64))
    return annotated_path


def send_frame_result(
    token: str,
    frame_path: Path,
    detections: list[dict[str, Any]],
) -> dict[str, Any]:
    with frame_path.open("rb") as image:
        response = requests.post(
            f"{BACKEND_URL}/inspection/frame-result",
            headers={"Authorization": f"Bearer {token}"},
            data={"detections": json.dumps(detections)},
            files={"image": (frame_path.name, image, "image/jpeg")},
            timeout=30,
        )
    response.raise_for_status()
    return response.json()


def main() -> None:
    FRAME_DIR.mkdir(parents=True, exist_ok=True)
    token = login()
    print(f"camera-worker started: mode={CAMERA_MODE}")

    while True:
        frame_path = FRAME_DIR / f"{uuid.uuid4()}.jpg"

        try:
            capture_frame(frame_path)
            prediction = predict(frame_path)
            detections = prediction.get("detections", [])

            if not detections:
                send_frame_result(token, frame_path, detections)
                frame_path.unlink(missing_ok=True)
                print("ok: no defects")
            else:
                image_to_save = frame_path
            
                if prediction.get("annotatedImageBase64"):
                    image_to_save = save_annotated_image(
                        frame_path,
                        prediction["annotatedImageBase64"],
                    )
            
                result = send_frame_result(token, image_to_save, detections)
            
                frame_path.unlink(missing_ok=True)
                if image_to_save != frame_path:
                    image_to_save.unlink(missing_ok=True)
            
                print(f"defects saved: {result['savedDefectsCount']}")

        except requests.HTTPError as error:
            if error.response is not None and error.response.status_code == 401:
                token = login()
                print("token refreshed")
            else:
                print(f"http error: {error}")
        except subprocess.CalledProcessError as error:
            frame_path.unlink(missing_ok=True)
            print(f"ffmpeg error: {error}")
        except KeyboardInterrupt:
            frame_path.unlink(missing_ok=True)
            print("camera-worker stopped")
            break
        except Exception as error:
            frame_path.unlink(missing_ok=True)
            print(f"error: {error}")

        time.sleep(FRAME_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
