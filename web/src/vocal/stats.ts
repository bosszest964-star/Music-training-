import { useEffect, useMemo, useState } from 'react'
import { gradeStars } from '../exerciseMetadata'
import { bpmLimits, pitchLimits } from './music'
import type { VocalRange } from './music'
import { vocalExerciseById } from './catalog'

export const vocalRangeKey = 'music-training.vocal.range.v1'
export const vocalRoundPrefix = 'music-training.vocal.round.v1:'

interface PracticeResult {
  exercise: string
  duration: number
}

interface PitchedResult extends PracticeResult {
  kind: 'pitch'
  root: number
  bpm: number
  accuracy: number
  coverage: number
  combo?: number
}

type VocalResult = (PracticeResult & { kind: 'breath' }) | PitchedResult
type VocalRound = VocalResult & { id: string; finishedAt: number }

const legacyIds: ReadonlyMap<string, string> = new Map(
  ['scale', 'arpeggio', 'siren', 'hold'].map(id => [id, `vocal-warmup-${id}`]),
)

function validNote(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= pitchLimits.low && value <= pitchLimits.high
}

export function parseVocalRange(raw: string | null): VocalRange | null {
  try {
    const data = JSON.parse(raw ?? 'null')
    return validNote(data?.low) && validNote(data?.high) && data.low <= data.high ? { low: data.low, high: data.high } : null
  } catch {
    return null
  }
}

export function parseVocalRound(raw: string | null, id: string): VocalRound | null {
  try {
    const data = JSON.parse(raw ?? 'null')
    const percent = (value: number) => Number.isInteger(value) && value >= 0 && value <= 100
    const exercise = vocalExerciseById.get(legacyIds.get(data?.exercise) ?? data?.exercise)
    if (!exercise || !Number.isFinite(data.finishedAt) || data.finishedAt <= 0 || data.finishedAt > 8.64e15
      || !Number.isFinite(data.duration) || data.duration <= 0 || data.duration > 180) return null
    const common = { id, finishedAt: data.finishedAt, exercise: exercise.id, duration: data.duration }
    if (exercise.categoryId === 'vocal-breath') return { ...common, kind: 'breath' }
    if (!validNote(data.root) || !percent(data.accuracy) || !percent(data.coverage) || data.coverage < data.accuracy
      || !Number.isInteger(data.bpm) || data.bpm < bpmLimits.min || data.bpm > bpmLimits.max) return null
    const combo = exercise.categoryId === 'vocal-flyer' && Number.isInteger(data.combo) && data.combo >= 0
      && data.combo <= exercise.route.length ? data.combo : undefined
    return { ...common, kind: 'pitch', root: data.root, bpm: data.bpm, accuracy: data.accuracy, coverage: data.coverage, combo }
  } catch {
    return null
  }
}

function loadStats() {
  try {
    const rounds: VocalRound[] = []
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith(vocalRoundPrefix)) continue
      const round = parseVocalRound(localStorage.getItem(key), key.slice(vocalRoundPrefix.length))
      if (round) rounds.push(round)
    }
    return { range: parseVocalRange(localStorage.getItem(vocalRangeKey)), rounds: sorted(rounds), storageError: false }
  } catch {
    return { range: null, rounds: [], storageError: true }
  }
}

function sorted(rounds: VocalRound[]) {
  return rounds.sort((left, right) => right.finishedAt - left.finishedAt)
}

export function useVocalStats() {
  const [initial] = useState(loadStats)
  const [range, setRange] = useState(initial.range)
  const [rounds, setRounds] = useState(initial.rounds)
  const [storageError, setStorageError] = useState(initial.storageError)

  useEffect(() => {
    function sync(event: StorageEvent) {
      if (event.storageArea !== localStorage) return
      if (event.key === null) {
        const data = loadStats()
        setRange(data.range)
        setRounds(data.rounds)
      } else if (event.key === vocalRangeKey) {
        setRange(parseVocalRange(event.newValue))
      } else if (event.key.startsWith(vocalRoundPrefix)) {
        const id = event.key.slice(vocalRoundPrefix.length)
        const round = parseVocalRound(event.newValue, id)
        setRounds(previous => {
          const next = previous.filter(entry => entry.id !== id)
          if (round) next.push(round)
          return sorted(next)
        })
      }
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  function persist(key: string, value: object) {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      setStorageError(true)
    }
  }

  function saveRange(next: VocalRange) {
    setRange(next)
    persist(vocalRangeKey, next)
  }

  function saveRound(result: VocalResult) {
    const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
    const round = { ...result, id, finishedAt: Date.now() }
    setRounds(previous => sorted([...previous, round]))
    persist(vocalRoundPrefix + id, round)
  }

  const summary = useMemo(() => {
    const bestStars = new Map<string, number>()
    let practiceTime = 0
    for (const round of rounds) {
      practiceTime += round.duration
      if (round.kind !== 'pitch') continue
      const max = vocalExerciseById.get(round.exercise)?.maxStars ?? 0
      const stars = gradeStars(round.accuracy, 100, max)
      bestStars.set(round.exercise, Math.max(stars, bestStars.get(round.exercise) ?? 0))
    }
    return {
      practiceTime,
      stars: [...bestStars.values()].reduce((sum, stars) => sum + stars, 0),
      latestPitch: rounds.find(round => round.kind === 'pitch'),
    }
  }, [rounds])

  return { range, rounds, summary, storageError, saveRange, saveRound }
}

export type VocalStats = ReturnType<typeof useVocalStats>
