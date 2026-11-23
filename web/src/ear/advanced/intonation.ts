import { exerciseMetadata, sampleDistinct } from '../exerciseMetadata'
import type { ExerciseDifficulty } from '../exerciseMetadata'

export const pitchChoices = { flat: 'ต่ำกว่า (Flat)', same: 'ตรงคีย์', sharp: 'สูงกว่า (Sharp)' } as const
export type PitchChoice = keyof typeof pitchChoices

const sizes: ReadonlyArray<readonly [number, ExerciseDifficulty]> = [
  [50, 'beginner'], [35, 'beginner'], [25, 'intermediate'], [18, 'intermediate'],
  [12, 'advanced'], [8, 'advanced'], [5, 'advanced'],
]

export const intonationStages = sizes.map(([cents, difficulty]) => ({
  ...exerciseMetadata('intonation', String(cents), difficulty), cents,
}))

export type IntonationStage = typeof intonationStages[number]

export function intonationQuestion(stage: IntonationStage, previousMidi?: number) {
  const [midi] = sampleDistinct(Array.from({ length: 19 }, (_, index) => 55 + index).filter(note => note !== previousMidi), 1)
  const [answer] = sampleDistinct(Object.keys(pitchChoices) as PitchChoice[], 1)
  const cents = answer === 'flat' ? -stage.cents : answer === 'sharp' ? stage.cents : 0
  return {
    midi, answer, cents,
    sound: {
      cues: [
        { notes: [midi], at: 0, duration: 0.58 },
        { notes: [midi], at: 1.05, duration: 0.58, cents },
      ],
    },
  }
}
