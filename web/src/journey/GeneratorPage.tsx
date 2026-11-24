import { useEffect, useRef, useState } from 'react'
import { Dices, RefreshCw } from 'lucide-react'
import { difficultyNames } from '../exerciseMetadata'
import type { ExerciseDifficulty } from '../exerciseMetadata'
import { MasterySelect } from '../instrument/mastery/MasteryControls'
import { GeneratedRunner } from './ExerciseRunner'
import type { RunnerProps } from './ExerciseRunner'
import { defaultSettings, generateExercise, generatorKinds, generatorMeters, keyNames, nextExerciseIndex, settingsLabel } from './generator'
import type { GeneratedExercise, GeneratorSettings } from './generator'
import { useForegroundPractice } from './useForegroundPractice'

export default function GeneratorPage({ sources, onActiveChange, recordGeneration }: RunnerProps & { recordGeneration: () => void }) {
  const [settings, setSettings] = useState(defaultSettings)
  const [display, setDisplay] = useState<'staff' | 'falling'>('staff')
  const [active, setActive] = useState<{ exercise: GeneratedExercise; settings: GeneratorSettings; index: bigint } | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const generation = useRef(0)
  useEffect(() => () => { generation.current += 1 }, [])
  useForegroundPractice(!!active && active.exercise.kind !== 'reading', onActiveChange)

  function update<K extends keyof GeneratorSettings>(name: K, value: GeneratorSettings[K]) {
    setSettings(current => ({ ...current, [name]: value }))
  }

  async function create() {
    if (pending) return
    const token = ++generation.current
    setPending(true)
    setError('')
    try {
      const index = await nextExerciseIndex(settings)
      if (generation.current !== token) return
      setActive({ settings, index, exercise: generateExercise(settings, index) })
      recordGeneration()
    } catch {
      if (generation.current === token) setError('สร้างโจทย์ไม่ได้ ลองกดสร้างใหม่อีกครั้ง')
    } finally {
      if (generation.current === token) setPending(false)
    }
  }

  return (
    <>
      <section className="hero journey-hero journey-generator-hero">
        <div className="hero-copy"><h1>สุ่มโจทย์ไม่จำกัด</h1><span>เลือกคีย์ จังหวะ และความเร็ว แล้วสร้างแบบฝึกใหม่</span></div>
        <Dices size={100} className="journey-hero-mark" aria-hidden="true" />
      </section>
      <section className="panel journey-panel">
        <div className="journey-generator-settings">
          <MasterySelect label="แบบฝึก" value={settings.kind} onChange={value => update('kind', value as GeneratorSettings['kind'])}>
            {Object.entries(generatorKinds).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </MasterySelect>
          <MasterySelect label="คีย์เพลง" value={settings.key} onChange={value => update('key', Number(value))}>
            {keyNames.map((name, index) => <option key={name} value={index}>{name}</option>)}
          </MasterySelect>
          <MasterySelect label="โหมดสเกล" value={settings.tonality} onChange={value => update('tonality', value as GeneratorSettings['tonality'])}>
            <option value="major">เมเจอร์</option><option value="minor">ไมเนอร์</option>
          </MasterySelect>
          <MasterySelect label="สัดส่วนจังหวะ" value={settings.meter} onChange={value => update('meter', value as GeneratorSettings['meter'])}>
            {Object.keys(generatorMeters).map(meter => <option key={meter}>{meter}</option>)}
          </MasterySelect>
          <MasterySelect label="ระดับ" value={settings.difficulty} onChange={value => update('difficulty', value as ExerciseDifficulty)}>
            {Object.entries(difficultyNames).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </MasterySelect>
          <label className="instrument-field mastery-tempo">ความเร็ว
            <strong>{settings.bpm} BPM</strong>
            <input type="range" min={30} max={240} value={settings.bpm} onChange={event => update('bpm', event.currentTarget.valueAsNumber)} />
          </label>
        </div>
        <div className="journey-actions">
          <button className="primary-button" onClick={() => void create()} disabled={pending}>
            <RefreshCw size={18} />{pending ? 'กำลังสร้าง…' : 'สร้างโจทย์ใหม่'}
          </button>
          {(settings.kind === 'reading' || active?.exercise.kind === 'reading') &&
            <div className="instrument-toolbar" role="group" aria-label="รูปแบบอ่านโน้ต">
              <button className="subtle-button" aria-pressed={display === 'staff'} onClick={() => setDisplay('staff')}>บรรทัดห้าเส้น</button>
              <button className="subtle-button" aria-pressed={display === 'falling'} onClick={() => setDisplay('falling')}>โน้ตไหล</button>
            </div>}
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
      </section>
      {active && <div className="journey-exercise">
        <div className="journey-round-heading"><h2>{generatorKinds[active.settings.kind]}</h2>
          <span>{settingsLabel(active.settings)} · {active.settings.meter} · {active.settings.bpm} BPM · ระดับ{difficultyNames[active.settings.difficulty]}</span></div>
        <GeneratedRunner key={active.index + ':' + JSON.stringify(active.settings) + ':' + display}
          exercise={active.exercise} settings={active.settings} falling={display === 'falling'}
          sources={sources} onActiveChange={onActiveChange} />
      </div>}
    </>
  )
}
