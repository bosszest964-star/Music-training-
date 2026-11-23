import { Play, Square, Star } from 'lucide-react'
import type { ReactNode } from 'react'
import EarOptions from '../EarOptions'
import { difficultyNames, gradeStars } from '../exerciseMetadata'
import type { ExerciseDifficulty, ExerciseMetadata } from '../exerciseMetadata'

export function TrainingDifficulty({ value, change }: { value: ExerciseDifficulty; change: (value: ExerciseDifficulty) => void }) {
  return <EarOptions label="ระดับความยาก" options={difficultyNames} value={value} onChange={change} />
}

export function ListenButton({ playing, heard, listen, stop, before = 'ฟังโจทย์' }: {
  playing: boolean; heard: boolean; listen: () => void; stop: () => void; before?: string
}) {
  return <button type="button" className="primary-button" onClick={playing ? stop : listen}>
    {playing ? <Square size={17} /> : <Play size={17} />}
    {playing ? 'หยุดเสียง' : heard ? 'ฟังอีกครั้ง' : before}
  </button>
}

export function RoundGrade({ exercise, correct, attempts, children }: {
  exercise: ExerciseMetadata; correct: number; attempts: number; children?: ReactNode
}) {
  const stars = gradeStars(correct, attempts, exercise.maxStars)
  return (
    <div className="advanced-result">
      <div className="advanced-result-summary" role="status">
        <span className="advanced-stars" aria-label={`${stars} จาก ${exercise.maxStars} ดาว`}>
          {Array.from({ length: exercise.maxStars }, (_, index) =>
            <Star key={index} size={18} aria-hidden="true" fill={index < stars ? 'currentColor' : 'none'} />)}
        </span>
        <strong>{attempts ? Math.round(100 * correct / attempts) : 0}%</strong>
        <span>{correct}/{attempts} ถูกต้อง</span>
      </div>
      {children}
    </div>
  )
}
