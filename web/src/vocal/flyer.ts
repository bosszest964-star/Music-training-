import { exerciseMetadata } from '../exerciseMetadata'
import type { ExerciseDifficulty } from '../exerciseMetadata'

function level(id: string, difficulty: ExerciseDifficulty, label: string, offsets: readonly number[],
  route: readonly number[], bpm: number) {
  return { ...exerciseMetadata('vocal-flyer', id, difficulty), label, offsets, route, bpm, span: offsets[offsets.length - 1] }
}

export const flyerLevels = [
  level('five-note', 'beginner', 'Major 5 โน้ต', [0, 2, 4, 5, 7], [0, 1, 2, 1, 0, 2, 3, 4, 2, 1, 0], 80),
  level('minor-pentatonic', 'intermediate', 'Minor Pentatonic', [0, 3, 5, 7, 10], [0, 2, 1, 3, 4, 2, 3, 1, 2, 1, 0, 3, 2, 0], 90),
  level('full-major', 'advanced', 'Major หนึ่งอ็อกเทฟ', [0, 2, 4, 5, 7, 9, 11, 12],
    [0, 2, 4, 3, 5, 7, 6, 4, 2, 0, 1, 3, 5, 4, 2, 0], 104),
]

export interface FlyerGate {
  time: number
  note: number
  result: 'pending' | 'hit' | 'miss'
}

export function createFlight(level: typeof flyerLevels[number], root: number) {
  const beat = 60 / level.bpm
  const gates: FlyerGate[] = level.route.map((step, index) => ({
    time: (1 + index * 2) * beat, note: root + level.offsets[step], result: 'pending',
  }))
  return {
    beat, gates, notes: level.offsets.map(offset => root + offset), time: 0, pitch: null as number | null, position: root,
    duration: gates[gates.length - 1].time + beat, next: 0, hits: 0, voiced: 0, combo: 0, bestCombo: 0,
    readings: [] as number[], lastVoice: -Infinity, lastMatch: -Infinity, streakStart: -Infinity, heardGate: false,
  }
}

export type Flight = ReturnType<typeof createFlight>

export const gateWindow = 0.36

export function readFlightPitch(flight: Flight, time: number, midi: number | null) {
  // A median removes isolated octave errors before they can move the flyer or score.
  if (midi === null || midi < flight.notes[0] - 2 || midi > flight.notes[flight.notes.length - 1] + 2) {
    flight.readings.length = 0
    flight.lastMatch = -Infinity
    if (time - flight.lastVoice > 0.16) flight.pitch = null
    return
  }
  flight.readings.push(midi)
  if (flight.readings.length > 3) flight.readings.shift()
  if (flight.readings.length < 3) return
  const [low, pitch, high] = [...flight.readings].sort((left, right) => left - right)
  if (high - low > 1.25) {
    flight.lastMatch = -Infinity
    if (time - flight.lastVoice > 0.16) flight.pitch = null
    return
  }
  flight.pitch = pitch
  flight.lastVoice = time

  const gate = flight.gates[flight.next]
  if (!gate || Math.abs(time - gate.time) > gateWindow || gate.result !== 'pending') return
  flight.heardGate = true
  if (Math.abs(pitch - gate.note) > 0.5) {
    flight.lastMatch = -Infinity
    return
  }

  if (time - flight.lastMatch > 0.105) flight.streakStart = time
  flight.lastMatch = time
  if (time - flight.streakStart < 0.13) return
  gate.result = 'hit'
  flight.hits += 1
  flight.combo += 1
  flight.bestCombo = Math.max(flight.bestCombo, flight.combo)
}

export function advanceFlight(flight: Flight, time: number) {
  const dt = Math.max(0, time - flight.time)
  flight.time = time
  if (flight.pitch !== null) flight.position += (flight.pitch - flight.position) * (1 - Math.exp(-dt / 0.09))
  const gate = flight.gates[flight.next]
  // Allow for the analysis window to arrive after its physical audio timestamp.
  if (!gate || time <= gate.time + gateWindow + 0.12) return
  if (gate.result === 'pending') {
    gate.result = 'miss'
    flight.combo = 0
  }
  if (flight.heardGate) flight.voiced += 1
  flight.heardGate = false
  flight.lastMatch = -Infinity
  flight.next += 1
}
