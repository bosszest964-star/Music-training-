import { useCallback, useEffect, useState } from 'react'

const prefix = 'music-training.instrument.round.v1:'

type Result = { activity: 'piano' | 'chords'; label: string; accuracy: number; duration: number }
type Record = Result & { id: string; date: number }
export type SaveRound = (result: Result) => void

function parseRound(raw: string | null, id: string): Record | null {
  try {
    const data = JSON.parse(raw ?? 'null')
    if (!data || (data.activity !== 'piano' && data.activity !== 'chords') || typeof data.label !== 'string'
      || !Number.isInteger(data.accuracy) || data.accuracy < 0 || data.accuracy > 100
      || !Number.isFinite(data.duration) || data.duration < 0
      || !Number.isFinite(data.date) || data.date <= 0 || data.date > 8.64e15) return null
    return { ...data, id }
  } catch {
    return null
  }
}

function sorted(items: Record[]) {
  return items.sort((a, b) => b.date - a.date)
}

function readRounds() {
  const rounds: Record[] = []
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

  return { ...stats, save }
}

export type InstrumentStats = ReturnType<typeof useInstrumentStats>
