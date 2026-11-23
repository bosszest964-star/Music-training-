import type { PianoSong } from './songs'

const windowSeconds = 0.19

export function createPianoRound(song: PianoSong, wait: boolean) {
  let time = -2
  let last = 0
  let wrong = 0
  let count = 0
  let cursor = 0
  let finished = false
  const hits = new Map<number, Set<number>>()

  function advance(now: number) {
    const delta = Math.max(0, now - last)
    last = now
    if (finished) return
    time += delta
    if (wait && cursor < song.cues.length) time = Math.min(time, song.cues[cursor].time)
    else {
      while (cursor < song.cues.length && song.cues[cursor].time < time - windowSeconds) cursor += 1
      if (time >= song.length + windowSeconds) {
        time = song.length + windowSeconds
        finished = true
      }
    }
  }

  function press(midi: number, now: number) {
    advance(now)
    if (finished) return
    const cue = song.cues[cursor]
    if (wait && (!cue || time < cue.time - windowSeconds)) return
    if (time < -windowSeconds) return
    let nearest = -1
    let distance = Infinity
    let repeated = false
    for (let index = cursor; index < song.cues.length; index += 1) {
      if (wait && index !== cursor) break
      const candidate = song.cues[index]
      if (candidate.time > time + windowSeconds) break
      if (!candidate.notes.some(note => note.midi === midi)) continue
      if (hits.get(index)?.has(midi)) {
        repeated = true
        continue
      }
      const offset = Math.abs(candidate.time - time)
      if (offset < distance) {
        nearest = index
        distance = offset
      }
    }
    if (nearest < 0) {
      if (!repeated && time <= (song.cues.at(-1)?.time ?? 0) + windowSeconds) wrong += 1
      return
    }
    const notes = hits.get(nearest) ?? new Set<number>()
    notes.add(midi)
    hits.set(nearest, notes)
    count += 1
    if (wait && notes.size === cue.notes.length) {
      // The next cue follows at its original musical distance from the one just played.
      time = cue.time
      cursor += 1
    }
  }

  function snapshot() {
    const cue = song.cues[cursor]
    const waiting = wait && !!cue && time >= cue.time
    const target = cue && time >= cue.time - windowSeconds ? cue.notes.filter(note => !hits.get(cursor)?.has(note.midi)) : []
    return { time, waiting, target, count, wrong, cursor, finished }
  }

  return {
    advance, press, snapshot, hits,
    restartClock(now: number) { last = now },
    accuracy() { return Math.round(100 * count / (song.total + wrong)) },
  }
}

export type PianoRound = ReturnType<typeof createPianoRound>

export function pianoKeys(low: number, high: number) {
  const first = Math.min(96, Math.floor(low / 12) * 12)
  const last = Math.min(127, Math.max(first + 23, Math.floor(high / 12) * 12 + 11))
  const white = new Set([0, 2, 4, 5, 7, 9, 11])
  let whites = 0
  const keys = Array.from({ length: last - first + 1 }, (_, index) => {
    const midi = first + index
    const black = !white.has(midi % 12)
    const center = black ? whites : whites + 0.5
    if (!black) whites += 1
    return { midi, center, black }
  })
  return { keys, whites }
}

export type PianoLayout = ReturnType<typeof pianoKeys>
