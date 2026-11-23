export default function EarOptions<T extends string>({ label, options, value, onChange }: {
  label: string
  options: Record<T, string>
  value: T
  onChange: (option: T) => void
}) {
  return (
    <div className="ear-control">
      <span>{label}</span>
      <div className="segmented ear-options" role="group" aria-label={label}>
        {(Object.keys(options) as T[]).map(option =>
          <button key={option} type="button" aria-pressed={option === value} onClick={() => onChange(option)}>
            {options[option]}
          </button>,
        )}
      </div>
    </div>
  )
}
