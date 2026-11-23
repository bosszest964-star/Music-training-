import { pianoCurriculum } from './curriculum'
import { fretExercises } from './fretboard'
import { readingExercises } from './sightReading'
import { strumPatterns } from './strumming'

const exercises = [...pianoCurriculum, ...strumPatterns, ...fretExercises, ...readingExercises]
export const instrumentExerciseById = new Map(exercises.map(exercise => [exercise.id, exercise]))
