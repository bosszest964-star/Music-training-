import { Star } from 'lucide-react'
import { difficultyNames } from '../exerciseMetadata'
import type { ExerciseMetadata } from '../exerciseMetadata'

export function ExercisePicker({ exercises, selected, disabled, groups, onSelect }: {
  exercises: readonly (ExerciseMetadata & { label: string; group: string })[]
  selected: string
  disabled: boolean
  groups: Record<string, string>
  onSelect: (id: string) => void
}) {
  const current = exercises.find(exercise => exercise.id === selected) ?? exercises[0]

  return (
    <>
      <div className="vocal-filters" role="group" aria-label="เลือกกลุ่มแบบฝึก">
        {Object.entries(groups).map(([id, label]) => (
          <button key={id} type="button" className="subtle-button" aria-pressed={current.group === id} disabled={disabled}
            onClick={() => {
              const next = exercises.find(exercise => exercise.group === id)
              if (next && current.group !== id) onSelect(next.id)
            }}>{label}</button>
        ))}
      </div>
      <div className="vocal-exercises" role="group" aria-label="เลือกแบบฝึก">
        {exercises.filter(exercise => exercise.group === current.group).map(exercise => (
          <button key={exercise.id} type="button" aria-pressed={exercise.id === selected} disabled={disabled}
            onClick={() => { if (exercise.id !== selected) onSelect(exercise.id) }}>
            <strong>{exercise.label}</strong>
            <small>ระดับ{difficultyNames[exercise.difficulty]}</small>
          </button>
        ))}
      </div>
    </>
  )
}

export function VocalStars({ stars, max }: { stars: number; max: number }) {
  return (
    <span className="vocal-stars" role="img" aria-label={`${stars} จาก ${max} ดาว`}>
      {Array.from({ length: max }, (_, index) => <Star key={index} aria-hidden="true" size={16}
        className={index < stars ? 'earned' : undefined} />)}
    </span>
  )
}
