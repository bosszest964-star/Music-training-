import { useEffect, useRef, useState } from 'react'
import { Check, Clock3, Flame, Pause, Play, Sparkles } from 'lucide-react'
import { dayKey } from '../usePractice'
import { tracks, workoutTotal } from './campaign'
import type { Track, dailyPlan } from './campaign'
import { MissionRunner } from './ExerciseRunner'
import type { RunnerProps } from './ExerciseRunner'

export interface Workout {
  track: Track
  plan: ReturnType<typeof dailyPlan>
}

const ignoreActiveChange = () => {}
const clock = (seconds: number) => Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0')

export default function DailyWorkout({ workout, sources, onActiveChange, onFinish, back }: RunnerProps & {
  workout: Workout; onFinish: (day: string, track: Track) => void; back: () => void
}) {
  const { plan, track } = workout
  const [index, setIndex] = useState(0)
  const [seconds, setSeconds] = useState<number>(plan[0].seconds)
  const [paused, setPaused] = useState(document.hidden)
  const [finished, setFinished] = useState(false)
  const [practiced, setPracticed] = useState<ReadonlySet<number>>(() => new Set())
  const completed = useRef(new Set<number>())
  const remaining = useRef(plan[0].seconds * 1000)
  const deadline = useRef(0)
  const success = practiced.size === plan.length

  useEffect(() => {
    if (paused || finished) return
    deadline.current = performance.now() + remaining.current
    onActiveChange(true)

    function tick() {
      if (document.hidden) {
        remaining.current = Math.max(0, deadline.current - performance.now())
        setPaused(true)
        return
      }
      remaining.current = Math.max(0, deadline.current - performance.now())
      setSeconds(Math.ceil(remaining.current / 1000))
      if (remaining.current > 0) return
      if (index + 1 === plan.length) {
        setFinished(true)
        if (completed.current.size === plan.length) onFinish(dayKey(new Date()), track)
      } else {
        remaining.current = plan[index + 1].seconds * 1000
        deadline.current = performance.now() + remaining.current
        setSeconds(plan[index + 1].seconds)
        setIndex(index + 1)
      }
    }

    const timer = window.setInterval(tick, 125)
    const hide = () => {
      if (!document.hidden) return
      remaining.current = Math.max(0, deadline.current - performance.now())
      setSeconds(Math.ceil(remaining.current / 1000))
      setPaused(true)
    }
    document.addEventListener('visibilitychange', hide)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', hide)
      onActiveChange(false)
    }
  }, [plan, track, paused, finished, index, onActiveChange, onFinish])

  function pause() {
    if (!paused) {
      remaining.current = Math.max(0, deadline.current - performance.now())
      setSeconds(Math.ceil(remaining.current / 1000))
    }
    setPaused(!paused)
  }

  const current = plan[index]
  const elapsed = finished ? workoutTotal :
    plan.slice(0, index).reduce((sum, stage) => sum + stage.seconds, 0) + current.seconds - seconds

  return (
    <>
      <section className="hero journey-hero journey-daily-hero">
        <div className="hero-copy"><h1>ซ้อมรายวัน 10 นาที</h1><span>{tracks[track]}</span></div>
        <Flame size={104} className="journey-hero-mark" aria-hidden="true" />
      </section>
      <section className="panel journey-panel">
        <div className="journey-heading">
          <div><h2>{finished ? 'จบคอร์ส' : current.label}</h2><p>ทำแบบฝึกให้จบอย่างน้อยหนึ่งรอบในแต่ละช่วง</p></div>
          <strong className="journey-clock"><Clock3 size={19} />{clock(workoutTotal - elapsed)} เหลือ</strong>
        </div>
        <label className="journey-meter">
          <span><strong>{finished ? 'ครบเวลา' : 'ช่วง ' + (index + 1) + ' จาก ' + plan.length}</strong>
            <small>{finished ? 'ฝึกจบ ' + practiced.size + '/' + plan.length + ' ช่วง' : 'ช่วงนี้เหลือ ' + clock(seconds)}</small></span>
          <progress max={workoutTotal} value={elapsed} />
        </label>
        <ol className="journey-workout-plan">
          {plan.map((stage, slot) => <li key={slot} aria-current={!finished && index === slot ? 'step' : undefined}>
            <span>{practiced.has(slot) ? <Check size={16} aria-label="ซ้อมแล้ว" /> : slot + 1}</span>
            <strong>{stage.skill}</strong><small>{clock(stage.seconds)}</small>
          </li>)}
        </ol>
        <div className="journey-actions">
          {!finished && <button className="primary-button" onClick={pause}>
            {paused ? <Play size={17} /> : <Pause size={17} />}{paused ? 'ซ้อมต่อ' : 'พักเวลา'}
          </button>}
          <button className="subtle-button" onClick={back}>{finished ? 'กลับหน้าหลัก' : 'ออกจากคอร์ส'}</button>
        </div>
        {finished && <div className="journey-finish journey-celebration" data-celebrate={success || undefined} role="status">
          <Sparkles size={26} />
          <div><strong>{success ? 'ภารกิจวันนี้สำเร็จ!' : 'ครบ 10 นาทีแล้ว'}</strong>
            <span>{success ? 'บันทึกวันซ้อมและอัปเดตไฟต่อเนื่องแล้ว' : 'จะบันทึกไฟต่อเนื่องเมื่อฝึกจบครบทั้ง 4 ช่วง'}</span>
          </div>
          {success && <div className="journey-confetti" aria-hidden="true">{Array.from({ length: 8 }, (_, i) => <i key={i} />)}</div>}
        </div>}
      </section>
      {!finished && !paused && <div className="journey-exercise">
        <MissionRunner key={index} mission={current.mission} sources={sources} onActiveChange={ignoreActiveChange}
          onResult={result => {
            if (!result.practiced || completed.current.has(index)) return
            completed.current.add(index)
            setPracticed(new Set(completed.current))
          }} />
      </div>}
    </>
  )
}
