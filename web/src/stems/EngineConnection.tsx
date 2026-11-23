import { useEffect, useRef, useState } from 'react'
import { Cpu, Link2, Upload } from 'lucide-react'
import { checkEngine, normalizeAddress } from './engine'
import type { Connection, EngineHealth } from './engine'

const addressKey = 'music-training.stem-engine.address'

function initialAddress() {
  try {
    const stored = localStorage.getItem(addressKey)
    if (stored) return stored
  } catch {
    // Storage can be unavailable in a private browsing context.
  }
  const { hostname, origin, port } = window.location
  if (port === '8765' || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname)) return origin
  if (hostname === 'localhost' || hostname === '127.0.0.1') return 'http://localhost:8765'
  return ''
}

function getSavedKey(address: string) {
  try {
    return sessionStorage.getItem(addressKey + ':' + address.replace(/\/+$/, '')) ?? ''
  } catch {
    return ''
  }
}

export default function EngineConnection({ busy, separate }: {
  busy: boolean
  separate: (file: File, connection: Connection, health: EngineHealth) => void
}) {
  const [address, setAddress] = useState(initialAddress)
  const [key, setKey] = useState(() => getSavedKey(address))
  const [checking, setChecking] = useState(false)
  const [checked, setChecked] = useState<{ connection: Connection; health: EngineHealth } | null>(null)
  const [error, setError] = useState('')
  const request = useRef<AbortController | null>(null)
  const mixed = window.location.protocol === 'https:' && /^http:\/\//i.test(address.trim())

  useEffect(() => () => {
    const active = request.current
    request.current = null
    active?.abort()
  }, [])

  async function connect() {
    if (request.current) return
    setError('')
    setChecked(null)
    const controller = new AbortController()
    request.current = controller
    const timer = window.setTimeout(() => controller.abort(new Error('เครื่องไม่ตอบภายใน 8 วินาที ตรวจสอบ Wi‑Fi และที่อยู่')), 8000)
    setChecking(true)
    try {
      const connection = { address: normalizeAddress(address), key: key.trim() }
      if (!connection.key) throw new Error('กรอกรหัสเชื่อมต่อที่แสดงในหน้าต่างเครื่องคอม')
      const health = await checkEngine(connection, controller.signal)
      if (request.current !== controller) return
      setChecked({ connection, health })
      setAddress(connection.address)
      try {
        localStorage.setItem(addressKey, connection.address)
        sessionStorage.setItem(addressKey + ':' + connection.address, connection.key)
      } catch {
        // The active connection works without browser storage.
      }
    } catch (cause) {
      if (request.current !== controller) return
      const reason = controller.signal.aborted ? controller.signal.reason : cause
      setError(reason instanceof Error ? reason.message : 'เชื่อมต่อไม่ได้')
    } finally {
      window.clearTimeout(timer)
      if (request.current === controller) {
        request.current = null
        setChecking(false)
      }
    }
  }

  const disabled = checking || busy
  const health = checked?.health

  return (
    <div className="stem-source-fields">
      <form className="stem-engine-fields" onSubmit={event => { event.preventDefault(); void connect() }}>
        <label className="stem-field">ที่อยู่เครื่องคอม
          <input type="url" placeholder="http://192.168.1.25:8765" required value={address} disabled={disabled}
            onChange={event => {
              const value = event.currentTarget.value
              setAddress(value)
              setKey(getSavedKey(value.trim()))
              setChecked(null)
              setError('')
            }} />
        </label>
        <label className="stem-field">รหัสเชื่อมต่อ
          <input type="password" autoComplete="off" required value={key} disabled={disabled} onChange={event => {
            setKey(event.currentTarget.value)
            setChecked(null)
            setError('')
          }} />
        </label>
        <button className="subtle-button" disabled={disabled} type="submit"><Link2 size={17} />{checking ? 'กำลังตรวจสอบ…' : 'ตรวจการเชื่อมต่อ'}</button>
      </form>
      <p className="stem-connection" role="status">
        <i data-ready={health?.ready || undefined} />
        {health?.ready ? 'เชื่อมต่อแล้ว' : health ? 'เชื่อมต่อได้ · ยังติดตั้งไม่ครบ' : 'ยังไม่เชื่อมต่อ'}
        {health && <span><Cpu size={15} />{health.hardware} · {health.device.toUpperCase()} · {health.model}</span>}
      </p>
      {health && !health.ready && <p className="field-error">เครื่องคอมยังขาด {health.missing.join(', ')}</p>}
      {mixed && <p className="stem-hint">Safari อาจบล็อก HTTPS → HTTP ให้เปิดเว็บจากเลข IP ที่เครื่องคอมแสดง หรือใช้ที่อยู่ Engine แบบ HTTPS ที่เชื่อถือได้</p>}
      {error && <p className="field-error" role="alert">{error}</p>}
      <label className="primary-button stem-file">
        <Upload size={17} />เลือกเพลงและสั่งแยก 4 แทร็ก
        <input type="file" aria-label="เลือกเพลงและสั่งแยก 4 แทร็ก" accept="audio/*,.m4a,.mp3,.wav,.flac,.ogg" disabled={disabled || !health?.ready}
          onChange={event => {
            const file = event.currentTarget.files?.[0]
            event.currentTarget.value = ''
            if (file && checked && checked.health.ready) separate(file, checked.connection, checked.health)
          }} />
      </label>
    </div>
  )
}
