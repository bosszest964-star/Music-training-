export const advancedCategories = {
  progression: 'ทางเดินคอร์ด',
  echo: 'ฟังทำนองแล้วเล่นตาม',
  rhythm: 'เคาะจังหวะ',
  intonation: 'จับเสียงเพี้ยน',
} as const

export type AdvancedCategory = keyof typeof advancedCategories
export { difficultyNames, exerciseMetadata, gradeStars } from '../exerciseMetadata'
export type { ExerciseDifficulty, ExerciseMetadata } from '../exerciseMetadata'

export function sampleDistinct<Item>(items: readonly Item[], count: number): Item[] {
  const pool = [...items]
  return Array.from({ length: Math.min(count, pool.length) }, () =>
    pool.splice(Math.floor(Math.random() * pool.length), 1)[0])
}
