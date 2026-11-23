export type ExerciseDifficulty = 'beginner' | 'intermediate' | 'advanced'

export const difficultyNames: Record<ExerciseDifficulty, string> = {
  beginner: 'ต้น', intermediate: 'กลาง', advanced: 'สูง',
}

export interface ExerciseMetadata<Category extends string = string> {
  id: string
  categoryId: Category
  difficulty: ExerciseDifficulty
  maxStars: number
  accessTier: 'free' | 'pro'
}

export function exerciseMetadata<Category extends string>(
  categoryId: Category, id: string, difficulty: ExerciseDifficulty,
  { maxStars = 3, accessTier = 'free' }: Partial<Pick<ExerciseMetadata, 'maxStars' | 'accessTier'>> = {},
): ExerciseMetadata<Category> {
  return { id: `${categoryId}-${id}`, categoryId, difficulty, maxStars, accessTier }
}

export function gradeStars(correct: number, attempts: number, maxStars: number) {
  if (!attempts) return 0
  const accuracy = correct / attempts
  return Math.min(maxStars, accuracy >= 0.9 ? 3 : accuracy >= 0.7 ? 2 : accuracy >= 0.45 ? 1 : 0)
}
