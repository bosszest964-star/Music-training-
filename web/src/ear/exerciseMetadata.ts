export const advancedCategories = {
  progression: 'ทางเดินคอร์ด',
  echo: 'ฟังทำนองแล้วเล่นตาม',
  rhythm: 'เคาะจังหวะ',
  intonation: 'จับเสียงเพี้ยน',
} as const

export type AdvancedCategory = keyof typeof advancedCategories
export type ExerciseDifficulty = 'beginner' | 'intermediate' | 'advanced'

export const difficultyNames: Record<ExerciseDifficulty, string> = {
  beginner: 'ต้น', intermediate: 'กลาง', advanced: 'สูง',
}

export interface ExerciseMetadata<Category extends string = AdvancedCategory> {
  id: string
  categoryId: Category
  difficulty: ExerciseDifficulty
  maxStars: number
  accessTier: 'free' | 'pro'
}

export function exerciseMetadata<Category extends AdvancedCategory>(
  categoryId: Category, id: string, difficulty: ExerciseDifficulty,
): ExerciseMetadata<Category> {
  return { id: `${categoryId}-${id}`, categoryId, difficulty, maxStars: 3, accessTier: 'free' }
}

export function gradeStars(correct: number, attempts: number, maxStars: number) {
  if (!attempts) return 0
  const accuracy = correct / attempts
  return Math.min(maxStars, accuracy >= 0.9 ? 3 : accuracy >= 0.7 ? 2 : accuracy >= 0.45 ? 1 : 0)
}

export function sampleDistinct<Item>(items: readonly Item[], count: number): Item[] {
  const pool = [...items]
  return Array.from({ length: Math.min(count, pool.length) }, () =>
    pool.splice(Math.floor(Math.random() * pool.length), 1)[0])
}
