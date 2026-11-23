import { useEffect, useMemo, useRef, useState } from 'react'
import { dayKey } from '../usePractice'
import { topics } from './exercises'
import type { Topic } from './exercises'

const storagePrefix = 'music-training.ear.v1:'
const topicIds = Object.keys(topics) as Topic[]

interface Count {
  correct: number
  attempts: number
}

type Counts = Record<Topic, Count>
type History = Record<string, Counts>

function emptyCounts(): Counts {
  return {
    degree: { correct: 0, attempts: 0 },
    interval: { correct: 0, attempts: 0 },
    chord: { correct: 0, attempts: 0 },
    eq: { correct: 0, attempts: 0 },
  }
}

function parseCounts(raw: string | null) {
  if (!raw) return null
  try {
    const data = JSON.parse(raw)
    if (!data || typeof data !== 'object') return null
    const counts = emptyCounts()
    for (const topic of topicIds) {
      const { correct, attempts } = data[topic] ?? {}
      if (Number.isSafeInteger(correct) && Number.isSafeInteger(attempts) && correct >= 0 && attempts >= correct) {
        counts[topic] = { correct, attempts }
      }
    }
    return counts
  } catch {
    return null
  }
}

export function currentStreak(days: ReadonlySet<string>, today: Date) {
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12)
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1)
  let streak = 0
  while (days.has(dayKey(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

function summarize(records: History) {
  const counts = emptyCounts()
  const total: Count = { correct: 0, attempts: 0 }
  const days = new Set<string>()
  for (const [key, entry] of Object.entries(records)) {
    for (const topic of topicIds) {
      const { correct, attempts } = entry[topic]
      counts[topic].correct += correct
      counts[topic].attempts += attempts
      total.correct += correct
      total.attempts += attempts
      if (attempts) days.add(key.slice(storagePrefix.length, storagePrefix.length + 10))
    }
  }
  return { counts, total, days }
}

function isHistoryKey(key: string) {
  return key.startsWith(storagePrefix) && /^\d{4}-\d{2}-\d{2}:/.test(key.slice(storagePrefix.length))
}

function readHistory(): History | null {
  try {
    const records: History = {}
    for (const key of Object.keys(localStorage)) {
      if (!isHistoryKey(key)) continue
      const counts = parseCounts(localStorage.getItem(key))
      if (counts) records[key] = counts
    }
    return records
  } catch {
    return null
  }
}

export function accuracy({ correct, attempts }: Count) {
  return attempts ? `${Math.round(100 * correct / attempts)}%` : '—'
}

export function useEarStats() {
  const [initial] = useState(readHistory)
  const [records, setRecords] = useState<History>(initial ?? {})
  const recordsRef = useRef(records)
  const [storageError, setStorageError] = useState(initial === null)
  // Each open tab owns its daily bucket so simultaneous answers cannot replace each other.
  const [writerId] = useState(() => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`)
  const summary = useMemo(() => summarize(records), [records])

  useEffect(() => {
    function sync(event: StorageEvent) {
      if (event.storageArea !== localStorage) return
      if (event.key === null) {
        recordsRef.current = readHistory() ?? {}
      } else {
        if (!isHistoryKey(event.key)) return
        const next = { ...recordsRef.current }
        const counts = parseCounts(event.newValue)
        if (counts) next[event.key] = counts
        else delete next[event.key]
        recordsRef.current = next
      }
      setRecords(recordsRef.current)
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  function record(topic: Topic, correct: boolean) {
    const key = `${storagePrefix}${dayKey(new Date())}:${writerId}`
    const bucket = recordsRef.current[key] ?? emptyCounts()
    const count = bucket[topic]
    const next = {
      ...bucket,
      [topic]: { correct: count.correct + Number(correct), attempts: count.attempts + 1 },
    }
    recordsRef.current = { ...recordsRef.current, [key]: next }
    setRecords(recordsRef.current)
    try {
      localStorage.setItem(key, JSON.stringify(next))
      setStorageError(false)
    } catch {
      setStorageError(true)
    }
  }

  return { ...summary, record, storageError }
}

export type EarStatsData = ReturnType<typeof useEarStats>
