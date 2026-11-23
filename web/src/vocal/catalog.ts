import { breathingPatterns } from './breathing'
import { etudes } from './etudes'
import { flyerLevels } from './flyer'
import { warmups } from './warmups'

export const vocalExercises = [...warmups, ...etudes, ...flyerLevels, ...breathingPatterns]
export const vocalExerciseById = new Map(vocalExercises.map(exercise => [exercise.id, exercise]))
