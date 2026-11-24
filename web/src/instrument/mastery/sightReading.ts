import { exerciseMetadata } from '../../exerciseMetadata'
import type { ExerciseDifficulty } from '../../exerciseMetadata'

export const clefs = { treble: 'กุญแจซอล', bass: 'กุญแจฟา', grand: 'บรรทัดคู่เปียโน' } as const
export type Clef = keyof typeof clefs
export type StaffClef = Exclude<Clef, 'grand'>

const letterNames = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
const solfege = ['โด', 'เร', 'มี', 'ฟา', 'ซอล', 'ลา', 'ที']
const semitones = [0, 2, 4, 5, 7, 9, 11]
const bottom = { treble: 37, bass: 25 }
const accidentalMarks = { '-1': '♭', '0': '', '1': '♯' }

export type Accidental = -1 | 0 | 1

export interface StaffNote {
  clef: StaffClef
  position: number
  letter: number
  accidental: Accidental
  midi: number
  octave: number
  value?: 'quarter' | 'eighth' | 'dotted-quarter'
}

export const readingLevels = {
  beginner: { label: 'โน้ตในบรรทัด', low: 0, high: 8 },
  intermediate: { label: 'เพิ่มเส้นน้อย', low: -4, high: 12 },
  advanced: { label: 'ชาร์ปและแฟลต', low: -5, high: 13 },
} satisfies Record<ExerciseDifficulty, { label: string; low: number; high: number }>

export function readingExercise(clef: Clef, difficulty: ExerciseDifficulty) {
  return exerciseMetadata('instrument-reading', `${clef}-${difficulty}`, difficulty)
}

export const readingExercises = (Object.keys(clefs) as Clef[]).flatMap(clef =>
  (Object.keys(readingLevels) as ExerciseDifficulty[]).map(level => readingExercise(clef, level)))

export function staffNote(clef: StaffClef, position: number, accidental: Accidental = 0): StaffNote {
  const index = bottom[clef] + position
  const letter = index % 7
  const octave = Math.floor(index / 7) - 1
  return { clef, position, letter, octave, accidental, midi: (octave + 1) * 12 + semitones[letter] + accidental }
}

export function allowedAccidentals(letter: number): Accidental[] {
  if (letter === 2 || letter === 6) return [0, -1]
  if (letter === 0 || letter === 3) return [0, 1]
  return [0, 1, -1]
}

export function noteName(letter: number, accidental: Accidental, thai: boolean) {
  return (thai ? solfege : letterNames)[letter] + accidentalMarks[accidental]
}

export function readingChoices(level: ExerciseDifficulty) {
  const letters = letterNames.map((_, letter) => ({ letter, accidental: 0 as Accidental }))
  if (level === 'advanced') {
    for (const accidental of [1, -1] as const) {
      for (let letter = 0; letter < 7; letter += 1) {
        if (allowedAccidentals(letter).includes(accidental)) letters.push({ letter, accidental })
      }
    }
  }
  return letters
}

function pick<T>(items: readonly T[]) {
  return items[Math.floor(Math.random() * items.length)]
}

export function readingQuestion(clef: Clef, level: ExerciseDifficulty, previous: StaffNote | null) {
  const { low, high } = readingLevels[level]
  const staves = clef === 'grand' ? ['treble', 'bass'] as const : [clef]
  const candidates = staves.flatMap(staff => Array.from({ length: high - low + 1 }, (_, index) => staffNote(staff, index + low)))
    .filter(note => note.clef !== previous?.clef || note.position !== previous.position)
  const focused = level === 'intermediate' && Math.random() < 0.58
    ? candidates.filter(note => note.position <= -2 || note.position >= 10) : candidates
  const natural = pick(focused)
  if (level !== 'advanced' || Math.random() < 0.2) return natural
  const accidental = pick(allowedAccidentals(natural.letter).filter(value => value !== 0))
  return staffNote(natural.clef, natural.position, accidental)
}

export function ledgerPositions(position: number) {
  const result: number[] = []
  for (let line = -2; line >= position; line -= 2) result.push(line)
  for (let line = 10; line <= position; line += 2) result.push(line)
  return result
}
