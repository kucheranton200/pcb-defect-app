import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { ReactNode } from 'react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api'
const TOKEN_KEY = 'pcb-defect-token'
const DEFECTS_PER_PAGE = 15

type Page = 'inspection' | 'admin' | 'login'
type FrameState = 'idle' | 'checking' | 'accepted' | 'rejected'

type Defect = {
  id: string
  title: string
  imageName: string
  className: string
  confidence: number
  boxX1: number
  boxY1: number
  boxX2: number
  boxY2: number
  createdAt: string
}

type InspectionFrameEvent = {
  id: string
  status: 'accepted' | 'rejected'
  imageBase64: string
  detections: Array<{
    class: string
    confidence: number
    box: [number, number, number, number]
  }>
  savedDefects: Defect[]
  createdAt: string
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [page, setPage] = useState<Page>(token ? 'inspection' : 'login')
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [currentFrame, setCurrentFrame] = useState<string | null>(null)
  const [frameState, setFrameState] = useState<FrameState>('idle')
  const [analyzedFrames, setAnalyzedFrames] = useState(0)
  const [sessionDefects, setSessionDefects] = useState(0)
  const [defects, setDefects] = useState<Defect[]>([])
  const [query, setQuery] = useState('')
  const [classFilter, setClassFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [renameTarget, setRenameTarget] = useState<Defect | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Defect | null>(null)
  const [imagePreview, setImagePreview] = useState<Defect | null>(null)
  const [titleDraft, setTitleDraft] = useState('')
  const [adminPage, setAdminPage] = useState(1)

  const filteredDefects = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null
    const to = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : null

    return defects.filter((defect) => {
      const created = new Date(defect.createdAt).getTime()
      const matchesTitle =
        !normalized || defect.title.toLowerCase().includes(normalized)
      const matchesClass = !classFilter || defect.className === classFilter
      const matchesFrom = from === null || created >= from
      const matchesTo = to === null || created <= to

      return matchesTitle && matchesClass && matchesFrom && matchesTo
    })
  }, [classFilter, dateFrom, dateTo, defects, query])

  const defectClasses = useMemo(
    () => Array.from(new Set(defects.map((defect) => defect.className))).sort(),
    [defects],
  )

  const totalAdminPages = Math.max(
    1,
    Math.ceil(filteredDefects.length / DEFECTS_PER_PAGE),
  )
  const paginatedDefects = useMemo(() => {
    const start = (adminPage - 1) * DEFECTS_PER_PAGE
    return filteredDefects.slice(start, start + DEFECTS_PER_PAGE)
  }, [adminPage, filteredDefects])

  useEffect(() => {
    setAdminPage(1)
  }, [classFilter, dateFrom, dateTo, query])

  useEffect(() => {
    setAdminPage((current) => Math.min(current, totalAdminPages))
  }, [totalAdminPages])

  useEffect(() => {
    if (token && page === 'admin') {
      void loadDefects()
    }
  }, [page, token])

  useEffect(() => {
    if (!token || page !== 'inspection') return

    const events = new EventSource(`${API_URL}/inspection/events`)

    events.onmessage = (message) => {
      const event = JSON.parse(message.data) as InspectionFrameEvent
      setAnalyzedFrames((current) => current + 1)
      setCurrentFrame(`data:image/jpeg;base64,${event.imageBase64}`)
      setFrameState('checking')

      window.setTimeout(() => {
        if (event.status === 'rejected') {
          setSessionDefects((current) => current + event.savedDefects.length)
          setDefects((current) => [...event.savedDefects, ...current])
          settleFrame('rejected')
          return
        }

        settleFrame('accepted')
      }, 250)
    }

    return () => events.close()
  }, [page, token])

  async function authorize(event: FormEvent) {
    event.preventDefault()
    setAuthError('')

    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, password }),
    })

    if (!response.ok) {
      setAuthError('Неверный логин или пароль')
      return
    }

    const data = await response.json()
    localStorage.setItem(TOKEN_KEY, data.accessToken)
    setToken(data.accessToken)
    setPage('inspection')
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setPage('login')
  }

  async function loadDefects() {
    if (!token) return

    const response = await fetch(`${API_URL}/defects`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (response.ok) {
      setDefects(await response.json())
    }
  }

  function settleFrame(state: Exclude<FrameState, 'idle' | 'checking'>) {
    setFrameState(state)
    window.setTimeout(() => {
      setCurrentFrame(null)
      setFrameState('idle')
    }, 1800)
  }

  function openRenameModal(defect: Defect) {
    setRenameTarget(defect)
    setTitleDraft(defect.title)
  }

  async function renameDefect() {
    if (!token) return
    if (!renameTarget) return
    const nextTitle = titleDraft.trim()
    if (!nextTitle || nextTitle === renameTarget.title) {
      setRenameTarget(null)
      return
    }

    const response = await fetch(`${API_URL}/defects/${renameTarget.id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: nextTitle }),
    })

    if (response.ok) {
      const updated = await response.json()
      setDefects((current) =>
        current.map((item) => (item.id === renameTarget.id ? updated : item)),
      )
      setRenameTarget(null)
    }
  }

  async function deleteDefect() {
    if (!token) return
    if (!deleteTarget) return

    const response = await fetch(`${API_URL}/defects/${deleteTarget.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })

    if (response.ok) {
      setDefects((current) =>
        current.filter((item) => item.id !== deleteTarget.id),
      )
      setDeleteTarget(null)
    }
  }

  return (
    <div className="app">
      <Header
        isAuthorized={Boolean(token)}
        page={page}
        onNavigate={setPage}
        onLogout={logout}
      />

      {page === 'login' || !token ? (
        <LoginPage
          login={login}
          password={password}
          error={authError}
          onLoginChange={setLogin}
          onPasswordChange={setPassword}
          onSubmit={authorize}
        />
      ) : page === 'inspection' ? (
        <InspectionPage
          currentFrame={currentFrame}
          frameState={frameState}
          analyzedFrames={analyzedFrames}
          sessionDefects={sessionDefects}
        />
      ) : (
        <AdminPage
          defects={paginatedDefects}
          classes={defectClasses}
          query={query}
          classFilter={classFilter}
          dateFrom={dateFrom}
          dateTo={dateTo}
          page={adminPage}
          totalPages={totalAdminPages}
          totalItems={filteredDefects.length}
          onQueryChange={setQuery}
          onClassFilterChange={setClassFilter}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          onPageChange={setAdminPage}
          onRefresh={loadDefects}
          onRename={openRenameModal}
          onDelete={setDeleteTarget}
          onImageClick={setImagePreview}
        />
      )}

      {renameTarget && (
        <Modal title="Переименовать дефект" onClose={() => setRenameTarget(null)}>
          <DefectModalPreview
            defect={renameTarget}
            onImageClick={setImagePreview}
          />
          <label className="modal-field">
            Title
            <input
              value={titleDraft}
              onChange={(event) => setTitleDraft(event.target.value)}
            />
          </label>
          <div className="modal-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={() => setRenameTarget(null)}
            >
              Отмена
            </button>
            <button className="primary-button" type="button" onClick={renameDefect}>
              Сохранить
            </button>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <Modal title="Удалить дефект" onClose={() => setDeleteTarget(null)}>
          <DefectModalPreview
            defect={deleteTarget}
            onImageClick={setImagePreview}
          />
          <div className="modal-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={() => setDeleteTarget(null)}
            >
              Отмена
            </button>
            <button className="danger-button" type="button" onClick={deleteDefect}>
              Удалить
            </button>
          </div>
        </Modal>
      )}

      {imagePreview && (
        <ImageLightbox
          defect={imagePreview}
          onClose={() => setImagePreview(null)}
        />
      )}

      <footer className="footer">PCB Defect Inspection Platform</footer>
    </div>
  )
}

function Header({
  isAuthorized,
  page,
  onNavigate,
  onLogout,
}: {
  isAuthorized: boolean
  page: Page
  onNavigate: (page: Page) => void
  onLogout: () => void
}) {
  return (
    <header className="header">
      <button className="brand" type="button" onClick={() => onNavigate('inspection')}>
        <span className="brand-mark">PC</span>
        <span>
          <strong>PCB Vision</strong>
          <small>Inspection</small>
        </span>
      </button>

      {isAuthorized && (
        <nav className="nav">
          <button
            className={page === 'inspection' ? 'active' : ''}
            type="button"
            onClick={() => onNavigate('inspection')}
          >
            Проверка
          </button>
          <button
            className={page === 'admin' ? 'active' : ''}
            type="button"
            onClick={() => onNavigate('admin')}
          >
            Админка
          </button>
        </nav>
      )}

      <div className="header-actions">
        {isAuthorized ? (
          <button type="button" onClick={onLogout}>
            Выход
          </button>
        ) : page !== 'login' ? (
          <button type="button" onClick={() => onNavigate('login')}>
            Войти
          </button>
        ) : null}
      </div>
    </header>
  )
}

function LoginPage({
  login,
  password,
  error,
  onLoginChange,
  onPasswordChange,
  onSubmit,
}: {
  login: string
  password: string
  error: string
  onLoginChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onSubmit: (event: FormEvent) => void
}) {
  return (
    <main className="login-page">
      <form className="login-panel" onSubmit={onSubmit}>
        <h1>Вход администратора</h1>
        <label>
          Логин
          <input value={login} onChange={(event) => onLoginChange(event.target.value)} />
        </label>
        <label>
          Пароль
          <input
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            type="password"
          />
        </label>
        {error && <p className="error-text">{error}</p>}
        <button className="primary-button" type="submit">
          Войти
        </button>
      </form>
    </main>
  )
}

function InspectionPage({
  currentFrame,
  frameState,
  analyzedFrames,
  sessionDefects,
}: {
  currentFrame: string | null
  frameState: FrameState
  analyzedFrames: number
  sessionDefects: number
}) {
  return (
    <main className="inspection-page">
      <section className="inspection-topbar">
        <div className="inspection-title">
          <span className="eyebrow">Проверка в реальном времени</span>
          <h1>Контроль дефектов печатных плат</h1>
        </div>
      </section>

      <section className="inspection-stage">
        <div className="result-column">
          <strong>Дефект</strong>
          <div className="result-zone reject-zone">
            <span>×</span>
          </div>
        </div>

        <div className="frame-column">
          <div className="frame-stage">
            {currentFrame ? (
              <img
                className={`checking-frame ${frameState}`}
                src={currentFrame}
                alt=""
              />
            ) : (
              <div className="empty-frame">Ожидание кадра от camera-worker</div>
            )}
          </div>
        </div>

        <div className="result-column">
          <strong>Нет дефектов</strong>
          <div className="result-zone accept-zone">
            <span>✓</span>
          </div>
        </div>
      </section>

      <section className="metrics">
        <Metric label="Кадров обработано" value={String(analyzedFrames)} />
        <Metric label="Дефектов за сессию" value={String(sessionDefects)} />
      </section>
    </main>
  )
}

function AdminPage({
  defects,
  classes,
  query,
  classFilter,
  dateFrom,
  dateTo,
  page,
  totalPages,
  totalItems,
  onQueryChange,
  onClassFilterChange,
  onDateFromChange,
  onDateToChange,
  onPageChange,
  onRefresh,
  onRename,
  onDelete,
  onImageClick,
}: {
  defects: Defect[]
  classes: string[]
  query: string
  classFilter: string
  dateFrom: string
  dateTo: string
  page: number
  totalPages: number
  totalItems: number
  onQueryChange: (value: string) => void
  onClassFilterChange: (value: string) => void
  onDateFromChange: (value: string) => void
  onDateToChange: (value: string) => void
  onPageChange: (value: number) => void
  onRefresh: () => void
  onRename: (defect: Defect) => void
  onDelete: (defect: Defect) => void
  onImageClick: (defect: Defect) => void
}) {
  return (
    <main className="admin-page">
      <section className="admin-heading">
        <div>
          <span className="eyebrow">Админский UI</span>
          <h1>База обнаруженных дефектов</h1>
        </div>
        <button type="button" onClick={onRefresh}>
          Обновить
        </button>
      </section>

      <section className="admin-filters">
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Поиск по названию"
        />
        <select
          value={classFilter}
          onChange={(event) => onClassFilterChange(event.target.value)}
        >
          <option value="">Все классы</option>
          {classes.map((className) => (
            <option key={className} value={className}>
              {className}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(event) => onDateFromChange(event.target.value)}
        />
        <input
          type="date"
          value={dateTo}
          onChange={(event) => onDateToChange(event.target.value)}
        />
      </section>

      <section className="defect-grid">
        {defects.map((defect) => (
          <article className="defect-card" key={defect.id}>
            <ImageZoomButton defect={defect} onClick={onImageClick} />
            <div className="defect-body">
              <div>
                <strong>{defect.title}</strong>
                <span>{Math.round(defect.confidence * 100)}%</span>
              </div>
              <code>{defect.className}</code>
              <small>{new Date(defect.createdAt).toLocaleString()}</small>
            </div>
            <div className="card-actions">
              <button type="button" onClick={() => onRename(defect)}>
                Переименовать
              </button>
              <button type="button" onClick={() => onDelete(defect)}>
                Удалить
              </button>
            </div>
          </article>
        ))}
      </section>

      <Pagination
        page={page}
        totalPages={totalPages}
        totalItems={totalItems}
        onPageChange={onPageChange}
      />
    </main>
  )
}

function Pagination({
  page,
  totalPages,
  totalItems,
  onPageChange,
}: {
  page: number
  totalPages: number
  totalItems: number
  onPageChange: (value: number) => void
}) {
  return (
    <section className="pagination">
      <span>
        Страница {page} из {totalPages}, найдено {totalItems}
      </span>
      <div>
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Назад
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Вперед
        </button>
      </div>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string
  children: ReactNode
  onClose: () => void
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button type="button" onClick={onClose}>
            ×
          </button>
        </div>
        {children}
      </section>
    </div>
  )
}

function DefectModalPreview({
  defect,
  onImageClick,
}: {
  defect: Defect
  onImageClick: (defect: Defect) => void
}) {
  return (
    <div className="modal-preview">
      <ImageZoomButton defect={defect} onClick={onImageClick} />
      <div>
        <strong>{defect.title}</strong>
        <span>{defect.className}</span>
        <small>{Math.round(defect.confidence * 100)}%</small>
      </div>
    </div>
  )
}

function ImageZoomButton({
  defect,
  onClick,
}: {
  defect: Defect
  onClick: (defect: Defect) => void
}) {
  return (
    <button
      className="image-zoom-button"
      type="button"
      onClick={() => onClick(defect)}
      aria-label="Увеличить изображение"
    >
      <img src={`${API_URL}/defects/${defect.id}/image`} alt="" />
      <span className="zoom-overlay">⌕</span>
    </button>
  )
}

function ImageLightbox({
  defect,
  onClose,
}: {
  defect: Defect
  onClose: () => void
}) {
  return (
    <div className="lightbox-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="lightbox"
        role="dialog"
        aria-modal="true"
        aria-label={defect.title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="lightbox-header">
          <div>
            <strong>{defect.title}</strong>
            <span>{defect.className}</span>
          </div>
          <button type="button" onClick={onClose}>
            ×
          </button>
        </div>
        <img src={`${API_URL}/defects/${defect.id}/image`} alt="" />
      </section>
    </div>
  )
}

export default App
