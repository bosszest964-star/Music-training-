import { useEffect, useRef, useState } from 'react'

export const practiceStorageKey = 'music-training.practice.v1'
type DailyTotals = Record<string, number>

export function dayKey(date: Date) {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map(value => String(value).padStart(2, '0')).join('-')
}

export function addPracticeTime(totals: DailyTotals, start: number, end: number) {
  const next = { ...totals }
  while (start < end) {
    const date = new Date(start)
    const midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime()
    const segmentEnd = Math.min(end, midnight)
    const key = dayKey(date)
    next[key] = (next[key] ?? 0) + segmentEnd - start
    start = segmentEnd
  }
  return next
}

export function parsePracticeTotals(raw: string | null): DailyTotals | null {
  try {
    const stored: unknown = JSON.parse(raw ?? '{}')
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return null
    return Object.fromEntries(Object.entries(stored).filter(([day, value]) =>
      /^\d{4}-\d{2}-\d{2}$/.test(day) && typeof value === 'number' && Number.isFinite(value) && value >= 0))
  } catch {
    return null
  }
}

function readTotals() {
  try { return parsePracticeTotals(localStorage.getItem(practiceStorageKey)) } catch { return null }
}

function readClock() {
  return performance.timeOrigin + performance.now()
}

export function usePractice(toolActive: boolean) {
  const [manual, setManual] = useState(false)
  const [paused, setPaused] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [today, setToday] = useState(() => new Date())
  const [totals, setTotals] = useState<DailyTotals>(() => readTotals() ?? {})
  const totalsRef = useRef(totals)
  const [storageError, setStorageError] = useState(false)
  const running = manual || (toolActive && !paused)

  useEffect(() => {
    if (!toolActive) setPaused(false)
  }, [toolActive])

  useEffect(() => {
    function sync(event: StorageEvent) {
      if (event.key !== practiceStorageKey && event.key !== null) return
      const latest = readTotals()
      if (!latest) return
      totalsRef.current = latest
      setTotals(latest)
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  useEffect(() => {
    let last = readClock()
    function tick() {
      const now = readClock()
      setToday(new Date())
      if (!running || now <= last) return
      const delta = now - last
      const next = addPracticeTime(readTotals() ?? totalsRef.current, last, now)
      last = now
      totalsRef.current = next
      setTotals(next)
      setElapsed(value => value + delta)
      try {
        localStorage.setItem(practiceStorageKey, JSON.stringify(next))
        setStorageError(false)
      } catch {
        setStorageError(true)
      }
    }
    const timer = window.setInterval(tick, running ? 1000 : 30_000)
    window.addEventListener('pagehide', tick)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('pagehide', tick)
      document.removeEventListener('visibilitychange', tick)
      if (running) tick()
    }
  }, [running])

  function toggle() {
    setManual(!running)
    setPaused(running && toolActive)
  }

  return { elapsed, today, totals, running, storageError, toggle }
}

export function formatDuration(seconds: number) {
  const rounded = Math.round(seconds)
  const hours = Math.floor(rounded / 3600)
  const minutes = Math.floor(rounded / 60) % 60
  const rest = rounded % 60
  return hours ? `${hours} ชม. ${minutes} นาที` : minutes ? `${minutes} นาที ${rest} วินาที` : `${rest} วินาที`
}
