import { pitchSampleInterval } from '../audio/microphonePitch'

export const pitchLimits = { low: 32, high: 90 }
export const bpmLimits = { min: 40, max: 180 }
export const tolerance = 0.5
export const holdSeconds = 1.5

export interface VocalRange {
  low: number
  high: number
}

export const voiceGroups = [
  { name: 'Bass', low: 40, high: 64 },
  { name: 'Baritone', low: 45, high: 69 },
  { name: 'Tenor', low: 48, high: 72 },
  { name: 'Alto', low: 53, high: 77 },
  { name: 'Mezzo-Soprano', low: 57, high: 81 },
  { name: 'Soprano', low: 60, high: 84 },
] as const

export function nearestVoiceGroup(range: VocalRange) {
  const distance = (group: VocalRange) => Math.abs(range.low - group.low) + Math.abs(range.high - group.high)
  return voiceGroups.reduce((nearest, group) => distance(group) < distance(nearest) ? group : nearest)
}

export interface NoteHold {
  start: number
  last: number
  anchor: number
  mean: number
  samples: number
}

export function trackHold(previous: NoteHold | null, midi: number | null, time: number): NoteHold | null {
  if (midi === null || midi < pitchLimits.low - 0.5 || midi > pitchLimits.high + 0.5) return null
  if (!previous || time - previous.last > 0.18 || Math.abs(midi - previous.anchor) > 0.65) {
    return { start: time, last: time, anchor: midi, mean: midi, samples: 1 }
  }
  return {
    ...previous, last: time,
    mean: previous.mean + (midi - previous.mean) / (previous.samples + 1),
    samples: previous.samples + 1,
  }
}

export interface Target {
  start: number
  end: number
  from: number
  to: number
}

export interface PianoCue {
  at: number
  duration: number
  notes: readonly number[]
}

export interface VocalPlan {
  root: number
  span: number
  beat: number
  beatsPerBar: number
  targets: readonly Target[]
  backing: readonly PianoCue[]
  duration: number
}

export function limitRoot(root: number, span: number) {
  return Math.min(pitchLimits.high - span, Math.max(pitchLimits.low, Math.round(root)))
}

export function fittedRoot(range: VocalRange | null, span: number) {
  return range ? limitRoot((range.low + range.high - span) / 2, span) : 60
}

export function targetAt(plan: VocalPlan, time: number) {
  const segment = plan.targets.find(target => time >= target.start && time < target.end)
  if (!segment) return null
  const midi = segment.from + (segment.to - segment.from) * (time - segment.start) / (segment.end - segment.start)
  const steady = time - segment.start >= Math.min(0.12, plan.beat * 0.22)
    && segment.end - time >= pitchSampleInterval / 2
  return { midi, settled: segment.from !== segment.to || steady }
}

export interface PitchPoint {
  time: number
  midi: number | null
}

export function scoreRound(plan: VocalPlan, points: readonly PitchPoint[]) {
  let total = 0
  let voiced = 0
  let matched = 0
  let index = 0

  // Evaluate evenly spaced time slots so rendering FPS cannot change the score.
  for (let time = pitchSampleInterval / 2; time < plan.duration; time += pitchSampleInterval) {
    const target = targetAt(plan, time)
    if (!target?.settled) continue
    total += 1
    while (index + 1 < points.length && Math.abs(points[index + 1].time - time) <= Math.abs(points[index].time - time)) index += 1
    const point = points[index]
    if (!point || point.midi === null || Math.abs(point.time - time) > 0.08) continue
    voiced += 1
    if (Math.abs(point.midi - target.midi) <= tolerance) matched += 1
  }
  return {
    accuracy: total ? Math.round(100 * matched / total) : 0,
    coverage: total ? Math.round(100 * voiced / total) : 0,
  }
}
