import { useEffect, useState } from 'react'
import { bpmLimits, pitchLimits, warmups } from './music'
import type { VocalRange, WarmupId } from './music'

const rangeKey = 'music-training.vocal.range.v1'
const roundPrefix = 'music-training.vocal.round.v1:'

export interface VocalRound {
  id: string
  finishedAt: number
  exercise: WarmupId
  root: number
  bpm: number
  accuracy: number
  coverage: number
  duration: number
}

function validNote(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= pitchLimits.low && value <= pitchLimits.high
}

function parseRange(raw: string | null): VocalRange | null {
  try {
    const data = JSON.parse(raw ?? 'null')
    return validNote(data?.low) && validNote(data?.high) && data.low <= data.high ? { low: data.low, high: data.high } : null
  } catch {
    return null
  }
}

function parseRound(raw: string | null, id: string): VocalRound | null {
  try {
    const data = JSON.parse(raw ?? 'null')
    const percent = (value: number) => Number.isInteger(value) && value >= 0 && value <= 100
    if (!data || !Object.hasOwn(warmups, data.exercise) || !validNote(data.root)
      || !percent(data.accuracy) || !percent(data.coverage) || data.coverage < data.accuracy
      || !Number.isFinite(data.finishedAt) || data.finishedAt <= 0 || data.finishedAt > 8.64e15
      || !Number.isInteger(data.bpm) || data.bpm < bpmLimits.min || data.bpm > bpmLimits.max
      || !Number.isFinite(data.duration) || data.duration <= 0 || data.duration > 30) return null
    return { ...data, id }
  } catch {
    return null
  }
}

function loadStats() {
  try {
    const rounds: VocalRound[] = []
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith(roundPrefix)) continue
      const round = parseRound(localStorage.getItem(key), key.slice(roundPrefix.length))
      if (round) rounds.push(round)
    }
    return { range: parseRange(localStorage.getItem(rangeKey)), rounds: sorted(rounds), storageError: false }
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
      } else if (event.key === rangeKey) {
        setRange(parseRange(event.newValue))
      } else if (event.key.startsWith(roundPrefix)) {
        const id = event.key.slice(roundPrefix.length)
        const round = parseRound(event.newValue, id)
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
    persist(rangeKey, next)
  }

  function saveRound(result: Omit<VocalRound, 'id' | 'finishedAt'>) {
    const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
    const round = { ...result, id, finishedAt: Date.now() }
    setRounds(previous => sorted([...previous, round]))
    persist(roundPrefix + id, round)
  }

  return { range, rounds, storageError, saveRange, saveRound }
}

export type VocalStats = ReturnType<typeof useVocalStats>

export function formatDuration(seconds: number) {
  const rounded = Math.round(seconds)
  const hours = Math.floor(rounded / 3600)
  const minutes = Math.floor(rounded / 60) % 60
  const rest = rounded % 60
  return hours ? `${hours} ชม. ${minutes} นาที` : minutes ? `${minutes} นาที ${rest} วินาที` : `${rest} วินาที`
}
