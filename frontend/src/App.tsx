import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api'

type Defect = {
  id: string
  className: string
  confidence: number
  boxX1: number
  boxY1: number
  boxX2: number
  boxY2: number
}

type InspectionResponse = {
  analyzedFrames: number
  savedDefectsCount: number
  savedDefects: Defect[]
}

function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const tokenRef = useRef<string | null>(null)
  const [login, setLogin] = useState('admin')
  const [password, setPassword] = useState('admin')
  const [isAuthorized, setAuthorized] = useState(false)
  const [isRecording, setRecording] = useState(false)
  const [status, setStatus] = useState('Готов к запуску')
  const [defects, setDefects] = useState<Defect[]>([])
  const [analyzedFrames, setAnalyzedFrames] = useState(0)

  async function authorize(event: FormEvent) {
    event.preventDefault()
    setStatus('Авторизация')

    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, password }),
    })

    if (!response.ok) {
      setStatus('Неверный логин или пароль')
      return
    }

    const data = await response.json()
    tokenRef.current = data.accessToken
    setAuthorized(true)
    setStatus('Авторизован')
  }

  async function startInspection() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    })

    if (videoRef.current) {
      videoRef.current.srcObject = stream
    }

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
      ? 'video/webm;codecs=vp8'
      : 'video/webm'

    const recorder = new MediaRecorder(stream, { mimeType })
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        void sendChunk(event.data)
      }
    }
    recorder.start(3000)
    recorderRef.current = recorder
    setRecording(true)
    setStatus('Идет анализ видео')
  }

  function stopInspection() {
    recorderRef.current?.stop()
    recorderRef.current?.stream.getTracks().forEach((track) => track.stop())
    recorderRef.current = null
    setRecording(false)
    setStatus('Остановлено')
  }

  async function sendChunk(blob: Blob) {
    if (!tokenRef.current) {
      return
    }

    const form = new FormData()
    form.append('video', blob, `webcam-${Date.now()}.webm`)

    const response = await fetch(`${API_URL}/inspection/video-chunk`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenRef.current}` },
      body: form,
    })

    if (!response.ok) {
      setStatus('Ошибка анализа чанка')
      return
    }

    const data = (await response.json()) as InspectionResponse
    setAnalyzedFrames((current) => current + data.analyzedFrames)

    if (data.savedDefectsCount > 0) {
      setDefects((current) => [...data.savedDefects, ...current])
      setStatus(`Найдено дефектов: ${data.savedDefectsCount}`)
      return
    }

    setStatus('Дефекты не найдены')
  }

  return (
    <main className="app-shell">
      <section className="toolbar">
        <form className="login-form" onSubmit={authorize}>
          <input
            value={login}
            onChange={(event) => setLogin(event.target.value)}
            placeholder="Логин"
          />
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Пароль"
            type="password"
          />
          <button type="submit">Войти</button>
        </form>
        <div className="controls">
          <button
            type="button"
            onClick={startInspection}
            disabled={!isAuthorized || isRecording}
          >
            Старт
          </button>
          <button type="button" onClick={stopInspection} disabled={!isRecording}>
            Стоп
          </button>
        </div>
      </section>

      <section className="workspace">
        <div className="camera-panel">
          <video ref={videoRef} autoPlay muted playsInline />
        </div>

        <aside className="side-panel">
          <div>
            <span className="label">Статус</span>
            <strong>{status}</strong>
          </div>
          <div>
            <span className="label">Кадров обработано</span>
            <strong>{analyzedFrames}</strong>
          </div>
          <div>
            <span className="label">Дефектов сохранено</span>
            <strong>{defects.length}</strong>
          </div>
        </aside>
      </section>

      <section className="defects-list">
        {defects.map((defect) => (
          <article className="defect-row" key={defect.id}>
            <img src={`${API_URL}/defects/${defect.id}/image`} alt="" />
            <div>
              <strong>{defect.className}</strong>
              <span>{Math.round(defect.confidence * 100)}%</span>
              <code>
                [{Math.round(defect.boxX1)}, {Math.round(defect.boxY1)},{' '}
                {Math.round(defect.boxX2)}, {Math.round(defect.boxY2)}]
              </code>
            </div>
          </article>
        ))}
      </section>
    </main>
  )
}

export default App
