import { stems } from './mixer'
import type { Stem } from './mixer'

export interface Connection {
  address: string
  key: string
}

export interface EngineHealth {
  service: 'music-training-stems'
  model: string
  ready: boolean
  device: 'cuda' | 'mps' | 'cpu'
  hardware: string
  missing: string[]
  max_bytes: number
  max_seconds: number
}

interface JobStatus {
  id: string
  status: 'uploading' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
  stage: string
  progress: number
  device: string
  error: string | null
  stems: Stem[]
}

export function normalizeAddress(input: string) {
  try {
    const url = new URL(input.trim())
    if ((url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password && !url.search && !url.hash) {
      return url.href.replace(/\/+$/, '')
    }
  } catch {
    // Use the same readable message after an invalid URL or unsupported scheme.
  }
  throw new Error('ใช้ที่อยู่ HTTP หรือ HTTPS เช่น http://192.168.1.25:8765')
}

async function request(connection: Connection, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('X-Stem-Key', connection.key)
  let response: Response
  try {
    response = await fetch(connection.address + path, { ...init, headers, cache: 'no-store', redirect: 'error' })
  } catch (error) {
    if (init.signal?.aborted) throw error
    throw new Error('ติดต่อเครื่องแยกเสียงไม่ได้ ตรวจสอบที่อยู่ Wi‑Fi และการตั้งค่า CORS หรือใช้หน้าเว็บจากเลข IP ที่เครื่องแสดง')
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(typeof body?.detail === 'string' ? body.detail : `เครื่องแยกเสียงตอบกลับ HTTP ${response.status}`)
  }
  return response
}

export async function checkEngine(connection: Connection, signal: AbortSignal) {
  const response = await request(connection, '/health', { signal })
  const result: EngineHealth | null = await response.json().catch(() => null)
  if (!result || result.service !== 'music-training-stems' || !Number.isFinite(result.max_bytes)
    || !Number.isFinite(result.max_seconds) || !Array.isArray(result.missing)
    || typeof result.ready !== 'boolean' || !['cuda', 'mps', 'cpu'].includes(result.device)
    || typeof result.hardware !== 'string' || typeof result.model !== 'string') {
    throw new Error('ที่อยู่นี้ไม่ใช่ Local GPU Engine ของห้องซ้อม')
  }
  return result
}

function wait(signal: AbortSignal) {
  signal.throwIfAborted()
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      signal.removeEventListener('abort', abort)
      resolve()
    }, 700)
    function abort() {
      window.clearTimeout(timer)
      reject(signal.reason)
    }
    signal.addEventListener('abort', abort, { once: true })
  })
}

export async function separateSong(
  connection: Connection, file: File, signal: AbortSignal,
  progress: (job: JobStatus) => void, receive: (stem: Stem, bytes: ArrayBuffer, index: number) => Promise<void>,
) {
  const response = await request(connection, '/separate', {
    method: 'POST', body: file, signal, headers: { 'Content-Type': 'application/octet-stream' },
  })
  let current: JobStatus = await response.json()
  if (!/^[\da-f-]{36}$/i.test(current.id)) throw new Error('เครื่องแยกเสียงส่งรหัสงานไม่ถูกต้อง')
  const path = '/separate/' + current.id
  try {
    while (current.status === 'queued' || current.status === 'running' || current.status === 'uploading') {
      progress(current)
      await wait(signal)
      current = await (await request(connection, path, { signal })).json()
    }
    if (current.status !== 'completed') {
      throw new Error(current.error || 'งานแยกเสียงหยุดก่อนเสร็จ')
    }
    for (const [index, stem] of stems.entries()) {
      const track = await request(connection, path + '/stems/' + stem, { signal })
      await receive(stem, await track.arrayBuffer(), index)
    }
  } finally {
    void request(connection, path, { method: 'DELETE' }).catch(() => {})
  }
}

export function stageLabel(stage: string) {
  switch (stage) {
    case 'queued': return 'กำลังรอคิว'
    case 'checking_audio': return 'กำลังตรวจไฟล์เสียง'
    case 'loading_model': return 'กำลังเตรียมโมเดล ครั้งแรกอาจต้องดาวน์โหลด'
    case 'fallback_cpu': return 'กำลังลองใหม่ด้วย CPU'
    case 'separating': return 'กำลังแยกเสียง'
    case 'exporting': return 'กำลังบันทึกแทร็ก'
    default: return 'กำลังเตรียมงาน'
  }
}
