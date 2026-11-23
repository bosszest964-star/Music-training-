import { instruments, noteLabel } from '../../audio/pitch'
import { exerciseMetadata } from '../../exerciseMetadata'

export const fretInstruments = {
  guitar: { ...instruments.guitar, label: 'กีตาร์โปร่ง / ไฟฟ้า 6 สาย', voice: 'guitar' },
  bass: { ...instruments.bass, label: 'เบส 4 สาย', voice: 'bass' },
  ukulele: { ...instruments.ukulele, label: 'อูคูเลเล่ 4 สาย', voice: 'ukulele' },
} as const
export type FretInstrument = keyof typeof fretInstruments
export type FretChallenge = 'find' | 'name'

export const fretRegions = {
  first: { label: 'สายเปิด–เฟร็ต 5', low: 0, high: 5 },
  upper: { label: 'เฟร็ต 6–12', low: 6, high: 12 },
  all: { label: 'สายเปิด–เฟร็ต 12', low: 0, high: 12 },
} as const

export const scales = {
  chromatic: { label: 'ทุกโน้ต', intervals: Array.from({ length: 12 }, (_, index) => index) },
  major: { label: 'Major', intervals: [0, 2, 4, 5, 7, 9, 11] },
  minor: { label: 'Natural Minor', intervals: [0, 2, 3, 5, 7, 8, 10] },
  pentatonic: { label: 'Major Pentatonic', intervals: [0, 2, 4, 7, 9] },
  blues: { label: 'Blues', intervals: [0, 3, 5, 6, 7, 10] },
} as const

export const pitchNames = Array.from({ length: 12 }, (_, index) => noteLabel(index + 60).slice(0, -1))

export function fretExercise(instrument: FretInstrument, mode: FretChallenge, region: keyof typeof fretRegions) {
  return exerciseMetadata('instrument-fretboard', `${instrument}-${mode}-${region}`,
    region === 'first' ? 'beginner' : region === 'upper' ? 'intermediate' : 'advanced')
}

export const fretExercises = (Object.keys(fretInstruments) as FretInstrument[]).flatMap(instrument =>
  (['find', 'name'] as const).flatMap(mode => (Object.keys(fretRegions) as (keyof typeof fretRegions)[])
    .map(region => fretExercise(instrument, mode, region))))

export interface FretPosition {
  string: number
  fret: number
  midi: number
}

export function fretPositions(instrument: FretInstrument, region: keyof typeof fretRegions) {
  const tuning = fretInstruments[instrument].strings
  const { low, high } = fretRegions[region]
  return [...tuning].reverse().map((open, index) =>
    Array.from({ length: high - low + 1 }, (_, i): FretPosition => ({
      string: index + 1, fret: low + i, midi: open + low + i,
    })))
}

export function fretQuestion(rows: readonly FretPosition[][], mode: FretChallenge, previous: FretPosition | null) {
  const candidates = rows.flat().filter(position => !previous || (mode === 'find'
    ? position.midi % 12 !== previous.midi % 12 || position.string !== previous.string
    : position.fret !== previous.fret || position.string !== previous.string))
  return candidates[Math.floor(Math.random() * candidates.length)]
}
