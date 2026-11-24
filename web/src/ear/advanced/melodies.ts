import { exerciseMetadata, sampleDistinct } from '../exerciseMetadata'
import type { ExerciseDifficulty } from '../exerciseMetadata'

type Pattern = readonly [id: string, steps: readonly number[], rhythm?: readonly number[]]

function patterns(difficulty: ExerciseDifficulty, rows: readonly Pattern[]) {
  return rows.map(([id, steps, rhythm]) => ({
    ...exerciseMetadata('echo', id, difficulty), steps, rhythm,
  }))
}

export const melodies = [
  ...patterns('beginner', [
    ['rise-step', [0, 2, 4]], ['fall-step', [0, -2, -4]], ['rise-return', [0, 2, 0]],
    ['fall-return', [0, -2, 0]], ['third-up', [0, 4, 2]], ['minor-third-down', [0, -3, -5]],
    ['fourth-turn', [0, 5, 4]], ['repeat-rise', [0, 0, 2]], ['repeat-fall', [0, 0, -2]],
    ['minor-rise', [0, 3, 5]], ['third-home', [0, 4, 0]], ['below-rise', [0, -2, 2]],
  ]),
  ...patterns('intermediate', [
    ['step-arch', [0, 2, 4, 7, 4]], ['gentle-fall', [0, -2, -4, -5]],
    ['pentatonic', [0, 2, 4, 7, 9]], ['five-home', [0, 4, 7, 5, 0]],
    ['skip-down', [0, 5, 2, -2, 0]], ['thirds', [0, 4, 2, 5]],
    ['small-answer', [0, -3, 0, 4, 2]], ['near-cadence', [0, -2, -5, -4, -2], [1, 1, 0.8, 0.8, 1.2]],
    ['higher-return', [0, 7, 9, 7, 4]], ['answered-steps', [0, 2, 0, -2, -4]],
    ['minor-shape', [0, 3, 7, 5, 3]], ['octave-preview', [0, 4, 7, 12, 7]],
  ]),
  ...patterns('advanced', [
    ['chromatic-turn', [0, 4, 3, 4, 7, 5, 2]], ['high-rise', [0, 7, 12, 11, 9, 7, 4]],
    ['minor-swing', [0, 3, 7, 10, 9, 7], [1, 0.75, 1, 0.75, 1, 1.2]],
    ['long-arch', [0, 2, 5, 9, 7, 4, 0]], ['crossing-tonic', [0, -5, -3, 2, 1, 0, -2]],
    ['octave-answer', [0, 12, 7, 9, 4, 5]], ['borrowed-step', [0, 4, 7, 8, 5, 4, 0]],
    ['passing-tone', [0, 5, 4, 2, 1, 2, 0]], ['major-seven', [0, 7, 11, 12, 7, 2, 4]],
    ['deep-echo', [0, -7, -5, 0, 2, 4]], ['tritone-color', [0, 6, 7, 2, 4, 1, 0]],
    ['octave-fall', [0, -12, -7, -3, -5, -2, 0], [1, 1.2, 1, 0.8, 0.8, 1, 1.1]],
  ]),
]

export type Melody = typeof melodies[number]

export function melodyQuestion(difficulty: ExerciseDifficulty, previous?: Melody) {
  const [exercise] = sampleDistinct(melodies.filter(item => item.difficulty === difficulty && item !== previous), 1)
  return melodyForExercise(exercise)
}

export function melodyForExercise(exercise: Melody) {
  const { difficulty } = exercise
  const low = 60 - Math.min(...exercise.steps)
  const high = 83 - Math.max(...exercise.steps)
  const [root] = sampleDistinct(Array.from({ length: high - low + 1 }, (_, index) => low + index), 1)
  const notes = exercise.steps.map(step => root + step)
  const beat = difficulty === 'beginner' ? 0.55 : difficulty === 'intermediate' ? 0.47 : 0.43
  let at = 0
  const cues = notes.map((midi, index) => {
    const gap = beat * (exercise.rhythm?.[index] ?? 1)
    const cue = { notes: [midi], at, duration: gap * 0.72 }
    at += gap
    return cue
  })
  return { exercise, notes, sound: { cues } }
}
