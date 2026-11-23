import { intonationStages } from './intonation'
import { melodies } from './melodies'
import { progressions } from './progressions'
import { rhythmPatterns } from './rhythmPatterns'

export const advancedExercises = [...progressions, ...melodies, ...rhythmPatterns, ...intonationStages]
export const exerciseById = new Map(advancedExercises.map(exercise => [exercise.id, exercise]))
