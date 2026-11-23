import { useEffect, useMemo, useRef, useState } from 'react'
import { dayKey } from '../usePractice'
import { topics } from './exercises'
import type { Topic } from './exercises'
import { advancedCategories, gradeStars } from './exerciseMetadata'
import type { AdvancedCategory, ExerciseMetadata } from './exerciseMetadata'
import { exerciseById } from './advanced/catalog'

const storagePrefix = 'music-training.ear.v1:'
const topicIds = Object.keys(topics) as Topic[]

interface Count {
  correct: number
  attempts: number
}

type Counts = Record<Topic, Count>
type Stars = Record<string, number>
type Bucket = Counts & { bestStars: Stars }
type History = Record<string, Bucket>

function emptyCounts(): Counts {
  return Object.fromEntries(topicIds.map(topic => [topic, { correct: 0, attempts: 0 }])) as Counts
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
    const bestStars: Stars = {}
    if (data.bestStars && typeof data.bestStars === 'object') {
      for (const [id, stars] of Object.entries(data.bestStars)) {
        const exercise = exerciseById.get(id)
        if (exercise && typeof stars === 'number' && Number.isSafeInteger(stars) && stars > 0 && stars <= exercise.maxStars) {
          bestStars[id] = stars
        }
      }
    }
    return { ...counts, bestStars }
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
  const bestStars: Stars = {}
  for (const [key, entry] of Object.entries(records)) {
    for (const [id, stars] of Object.entries(entry.bestStars)) bestStars[id] = Math.max(bestStars[id] ?? 0, stars)
    for (const topic of topicIds) {
      const { correct, attempts } = entry[topic]
      counts[topic].correct += correct
      counts[topic].attempts += attempts
      total.correct += correct
      total.attempts += attempts
      if (attempts) days.add(key.slice(storagePrefix.length, storagePrefix.length + 10))
    }
  }
  const starsByCategory = Object.fromEntries(Object.keys(advancedCategories).map(id => [id, 0])) as Record<AdvancedCategory, number>
  for (const [id, stars] of Object.entries(bestStars)) {
    const exercise = exerciseById.get(id)
    if (exercise) starsByCategory[exercise.categoryId] += stars
  }
  const totalStars = Object.values(starsByCategory).reduce((sum, stars) => sum + stars, 0)
  return { counts, total, days, bestStars, starsByCategory, totalStars }
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

  function add(topic: Topic, correct: number, attempts: number, exercise?: ExerciseMetadata<AdvancedCategory>) {
    const key = `${storagePrefix}${dayKey(new Date())}:${writerId}`
    const bucket = recordsRef.current[key] ?? { ...emptyCounts(), bestStars: {} }
    const count = bucket[topic]
    const bestStars: Stars = { ...bucket.bestStars }
    if (exercise) {
      const stars = gradeStars(correct, attempts, exercise.maxStars)
      if (stars > (bestStars[exercise.id] ?? 0)) bestStars[exercise.id] = stars
    }
    const next = { ...bucket, bestStars, [topic]: { correct: count.correct + correct, attempts: count.attempts + attempts } }
    recordsRef.current = { ...recordsRef.current, [key]: next }
    setRecords(recordsRef.current)
    try {
      localStorage.setItem(key, JSON.stringify(next))
      setStorageError(false)
    } catch {
      setStorageError(true)
    }
  }

  function record(topic: Topic, correct: boolean) {
    add(topic, Number(correct), 1)
  }

  function recordExercise(exercise: ExerciseMetadata<AdvancedCategory>, correct: number, attempts: number) {
    add(exercise.categoryId, correct, attempts, exercise)
  }

  return { ...summary, record, recordExercise, storageError }
}

export type EarStatsData = ReturnType<typeof useEarStats>
