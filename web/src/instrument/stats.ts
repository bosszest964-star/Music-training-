import { useCallback, useEffect, useMemo, useState } from 'react'
import { gradeStars } from '../exerciseMetadata'
import { instrumentExerciseById } from './mastery/catalog'

const prefix = 'music-training.instrument.round.v1:'

export const activityLabels = {
  piano: 'โน้ตไหล', chords: 'เปลี่ยนคอร์ด · ประเมินเอง', strum: 'ตีคอร์ด',
  fretboard: 'จำโน้ตบนคอ', reading: 'อ่านโน้ต',
} as const

type Activity = keyof typeof activityLabels
type PracticeResult = { label: string; duration: number; exerciseId?: string }
type GradedActivity = Exclude<Activity, 'strum'>
type GradedResult = { [Mode in GradedActivity]: { activity: Mode; accuracy: number; stars?: number } }[GradedActivity]
type Result = PracticeResult & ({ activity: 'strum' } | GradedResult)
type RoundRecord = Result & { id: string; date: number }
export type SaveRound = (result: Result) => void

export function roundStars(round: Result) {
  if (round.activity === 'strum' || !round.exerciseId) return null
  const exercise = instrumentExerciseById.get(round.exerciseId)
  if (!exercise?.maxStars) return null
  return { stars: round.stars ?? gradeStars(round.accuracy, 100, exercise.maxStars), max: exercise.maxStars }
}

function parseRound(raw: string | null, id: string): RoundRecord | null {
  try {
    const data = JSON.parse(raw ?? 'null')
    if (!data || !Object.hasOwn(activityLabels, data.activity) || typeof data.label !== 'string'
      || !Number.isFinite(data.duration) || data.duration < 0
      || !Number.isFinite(data.date) || data.date <= 0 || data.date > 8.64e15) return null
    const activity = data.activity as Activity
    const exercise = instrumentExerciseById.get(data.exerciseId)
    const exerciseId = exercise?.categoryId === `instrument-${activity}` ? exercise.id : undefined
    const common = { label: data.label, duration: data.duration, exerciseId, id, date: data.date }
    if (activity === 'strum') return { ...common, activity }
    if (!Number.isInteger(data.accuracy) || data.accuracy < 0 || data.accuracy > 100) return null
    const stars = typeof data.stars === 'number' && Number.isInteger(data.stars) && data.stars >= 0
      && exercise && data.stars <= exercise.maxStars ? data.stars : undefined
    return { ...common, activity, accuracy: data.accuracy, stars }
  } catch {
    return null
  }
}

function sorted(items: RoundRecord[]) {
  return items.sort((a, b) => b.date - a.date)
}

function readRounds() {
  const rounds: RoundRecord[] = []
  try {
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith(prefix)) continue
      const round = parseRound(localStorage.getItem(key), key.slice(prefix.length))
      if (round) rounds.push(round)
    }
    return { rounds: sorted(rounds), storageError: false }
  } catch {
    return { rounds, storageError: true }
  }
}

export function useInstrumentStats() {
  const [stats, setStats] = useState(readRounds)

  useEffect(() => {
    function sync(event: StorageEvent) {
      if (event.storageArea !== localStorage) return
      if (event.key === null) setStats(readRounds())
      else if (event.key.startsWith(prefix)) {
        const id = event.key.slice(prefix.length)
        const round = parseRound(event.newValue, id)
        setStats(previous => {
          const next = previous.rounds.filter(item => item.id !== id)
          if (round) next.push(round)
          return { ...previous, rounds: sorted(next) }
        })
      }
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  const save = useCallback<SaveRound>(result => {
    const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
    const round = { ...result, id, date: Date.now() }
    let storageError = false
    try {
      localStorage.setItem(prefix + id, JSON.stringify(round))
    } catch {
      storageError = true
    }
    setStats(previous => ({ rounds: sorted([...previous.rounds, round]), storageError: previous.storageError || storageError }))
  }, [])

  const totals = useMemo(() => {
    const best = new Map<string, number>()
    let duration = 0
    for (const round of stats.rounds) {
      duration += round.duration
      const earned = roundStars(round)
      if (round.exerciseId && earned) best.set(round.exerciseId, Math.max(best.get(round.exerciseId) ?? 0, earned.stars))
    }
    return { duration, stars: [...best.values()].reduce((total, value) => total + value, 0) }
  }, [stats.rounds])

  return { ...stats, totals, save }
}

export type InstrumentStats = ReturnType<typeof useInstrumentStats>
