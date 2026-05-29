# Camera Worker

Отдельный сервис, который получает кадры с камеры, отправляет их в ML service и сохраняет найденные дефекты через backend API.

## USB camera

Linux:

```bash
cd camera-worker
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

В `.env`:

```env
CAMERA_MODE=usb
USB_DEVICE=/dev/video0
```

Запуск:

```bash
python main.py
```

Windows:

```powershell
cd camera-worker
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
ffmpeg -list_devices true -f dshow -i dummy
```

В `.env`:

```env
CAMERA_MODE=dshow
DSHOW_DEVICE=Integrated Camera
```

Запуск:

```powershell
python main.py
```

## Industrial/IP camera via RTSP

В `.env`:

```env
CAMERA_MODE=rtsp
RTSP_URL=rtsp://user:password@192.168.1.50:554/stream1
```

Запуск:

```bash
python main.py
```

Для USB и RTSP нужен установленный `ffmpeg`.
