import { useEffect, useMemo, useRef, useState } from 'react'
import { Activity, CheckCircle2, Music2, Square, Volume2 } from 'lucide-react'
import PianoLoadStatus from '../audio/PianoLoadStatus'
import { noteLabel } from '../audio/pitch'
import { gradeStars } from '../exerciseMetadata'
import { bpmLimits, fittedRoot, limitRoot, scoreRound, targetAt, tolerance } from './music'
import type { VocalRange, VocalPlan } from './music'
import { warmups, warmupGroups, buildWarmup } from './warmups'
import { etudes, etudeGroups, buildEtude } from './etudes'
import { scheduleSinging, singingPianoNotes } from './singingAudio'
import { KeyControls } from './KeyControls'
import { ExercisePicker, VocalStars } from './VocalControls'
import PitchGraph from './PitchGraph'
import type { PitchTrace } from './PitchGraph'
import { useMicrophonePitch } from '../audio/useMicrophonePitch'
import type { VocalStats } from './stats'

type Phase = 'idle' | 'demo' | 'count' | 'singing' | 'complete'
const phaseLabel: Record<Phase, string> = {
  idle: 'พร้อมเริ่ม', demo: 'ฟังเปียโนนำ', count: 'เตรียมร้อง', singing: 'ร้องตามแถบโน้ต', complete: 'จบรอบ',
}
const initialFeedback = { target: null as number | null, input: null as number | null, cents: null as number | null }

export default function SingingSession({ mode, range, save, onActiveChange }: {
  mode: 'warmup' | 'etude'
  range: VocalRange | null
  save: VocalStats['saveRound']
  onActiveChange: (active: boolean) => void
}) {
  const isEtude = mode === 'etude'
  const exercises = isEtude ? etudes : warmups
  const [exerciseId, setExerciseId] = useState(exercises[0].id)
  const [customBpm, setBpm] = useState<number | null>(null)
  const [transpose, setTranspose] = useState(0)
  const [guide, setGuide] = useState(true)
  const [phase, setPhase] = useState<Phase>('idle')
  const [count, setCount] = useState(2)
  const [feedback, setFeedback] = useState(initialFeedback)
  const [result, setResult] = useState<ReturnType<typeof scoreRound> | null>(null)
  const mic = useMicrophonePitch()
  const trace = useRef<PitchTrace | null>(null)
  const [sessionPlan, setSessionPlan] = useState<VocalPlan | null>(null)
  const exercise = exercises.find(item => item.id === exerciseId) ?? exercises[0]
  const bpm = customBpm ?? exercise.bpm
  const span = exercise.span
  const base = fittedRoot(range, span)
  const root = limitRoot(base + transpose, span)
  const selection = useMemo(() => 'bars' in exercise ? buildEtude(exercise, bpm, root)
    : buildWarmup(exercise, bpm, root), [exercise, bpm, root])
  const plan = sessionPlan ?? selection
  const busy = mic.state !== 'idle'

  useEffect(() => () => onActiveChange(false), [onActiveChange])

  function clearRound() {
    trace.current = null
    setResult(null)
    setFeedback(initialFeedback)
    setSessionPlan(null)
    setPhase('idle')
  }

  function stop() {
    onActiveChange(false)
    mic.stop()
    clearRound()
  }

  function start() {
    clearRound()
    setSessionPlan(selection)
    const current: PitchTrace = { plan: selection, elapsed: 0, points: [] }
    trace.current = current
    let schedule = { countStart: 0, singStart: 0, countBeats: 0 }
    let lastCount = 0
    let counting = false
    let hasStarted = false
    let lastFeedback = -Infinity

    void mic.start({
      onReady(context) {
        schedule = scheduleSinging(context, selection, guide)
        lastCount = schedule.countBeats
        setCount(lastCount)
        setPhase('demo')
      },
      onFrame(time, pitch) {
        const { countStart, singStart } = schedule
        if (time < singStart) {
          if (time >= countStart) {
            if (!counting) {
              counting = true
              setPhase('count')
            }
            const remaining = Math.max(1, Math.ceil((singStart - time) / selection.beat))
            if (remaining !== lastCount) {
              lastCount = remaining
              setCount(remaining)
            }
          }
          return
        }

        if (!hasStarted) {
          hasStarted = true
          onActiveChange(true)
          setPhase('singing')
        }
        current.elapsed = Math.min(selection.duration, time - singStart)
        if (pitch) {
          const sampleTime = pitch.time - singStart
          if (sampleTime >= 0 && sampleTime < selection.duration) {
            current.points.push({ time: sampleTime, midi: pitch.midi })
            if (sampleTime - lastFeedback >= 0.1) {
              lastFeedback = sampleTime
              const target = targetAt(selection, sampleTime)
              setFeedback({
                target: target?.midi ?? null,
                input: pitch.midi,
                cents: pitch.midi === null || !target ? null : 100 * (pitch.midi - target.midi),
              })
            }
          }
        }
        // The last analysis window may still contain audio from before the end.
        if (time - singStart < selection.duration + 0.12) return
        onActiveChange(false)
        mic.stop()
        const scored = scoreRound(selection, current.points)
        setResult(scored)
        setPhase('complete')
        setFeedback(initialFeedback)
        save({ ...scored, kind: 'pitch', exercise: exercise.id, bpm, root, duration: selection.duration })
      },
      onLost() {
        onActiveChange(false)
        clearRound()
      },
    })
  }

  const cents = feedback.cents
  const pitchClass = cents === null ? '' : Math.abs(cents) <= tolerance * 100 ? 'match' : cents > 0 ? 'high' : 'low'
  const direction = pitchClass === 'match' ? 'ตรงคีย์' : pitchClass === 'high' ? 'สูงไป' : pitchClass === 'low' ? 'ต่ำไป' : 'รอสัญญาณเสียง'
  const displayCents = cents === null ? null : Math.round(cents)
  const prompt = mic.state === 'activation' ? 'แตะเพื่อเริ่มระบบเสียง' : mic.state === 'requesting' ? 'รออนุญาตไมโครโฟน'
    : phase === 'count' ? `เริ่มร้องใน ${count}` : phaseLabel[phase]

  return (
    <section className="panel vocal-panel" aria-labelledby="warmup-title">
      <header className="panel-header vocal-warmup-header">
        <span className="tool-icon purple">{isEtude ? <Music2 size={22} /> : <Activity size={22} />}</span>
        <div>
          <h2 id="warmup-title">{isEtude ? 'ร้องทำนองกับเปียโนคลอ' : 'วอร์มเสียงกับเปียโน'}</h2>
          <p>{isEtude ? 'ฟังคีย์และจังหวะนับนำ แล้วร้องกับคอร์ด เปียโนไกด์เปิดหรือปิดได้' : 'ฟังตัวอย่างและนับเข้า จากนั้นร้องตามกราฟ'}</p>
        </div>
        <span className={`status vocal-phase ${phase === 'singing' ? 'status-live' : ''}`} role="status">{prompt}</span>
      </header>
      <ExercisePicker exercises={exercises} groups={isEtude ? etudeGroups : warmupGroups} selected={exercise.id}
        disabled={busy} onSelect={id => {
          clearRound()
          setExerciseId(id)
          setTranspose(0)
          setBpm(null)
        }} />
      <p className="vocal-coach"><strong>วิธีร้อง</strong> {exercise.coach}</p>
      <div className="vocal-settings">
        <div className="vocal-bpm">
          <label htmlFor="vocal-bpm">ความเร็ว <strong>{bpm} BPM</strong></label>
          <input id="vocal-bpm" type="range" min={bpmLimits.min} max={bpmLimits.max} value={bpm} disabled={busy}
            onChange={event => {
              clearRound()
              setBpm(event.currentTarget.valueAsNumber)
            }} />
        </div>
        <KeyControls range={range} span={span} root={root} disabled={busy} onChange={next => {
          clearRound()
          setTranspose(next - base)
        }} />
      </div>
      {'bars' in exercise && (
        <div className="vocal-etude-guide">
          <label><input type="checkbox" checked={guide} disabled={busy} onChange={event => {
            setGuide(event.currentTarget.checked)
            clearRound()
          }} />เสียงเมโลดี้ไกด์</label>
          <span>{exercise.bars.length} ห้อง · {exercise.beatsPerBar}/4 · ใช้หูฟังเพื่อให้ไมค์จับเสียงร้องได้ชัด</span>
        </div>
      )}
      <PianoLoadStatus notes={singingPianoNotes(plan)} anchorLimit={14} />
      <PitchGraph plan={plan} trace={trace} moving={phase === 'singing'} />
      <div className="vocal-readout">
        <div><span>เป้าหมาย</span><strong>{feedback.target === null ? '—' : noteLabel(Math.round(feedback.target))}</strong></div>
        <div><span>เสียงที่ได้ยิน</span><strong>{feedback.input === null ? '—' : noteLabel(Math.round(feedback.input))}</strong></div>
        <div className={pitchClass}><span>{direction}</span><strong>{displayCents === null ? '—' : `${displayCents > 0 ? '+' : ''}${displayCents}¢`}</strong></div>
      </div>
      <div className="vocal-actions">
        <button className="primary-button" onClick={mic.state === 'activation' ? mic.activate : busy ? stop : start}>
          {!busy || mic.state === 'activation' ? <Volume2 size={17} /> : <Square size={17} />}
          {mic.state === 'activation' ? 'เริ่มเสียงเปียโน' : mic.state === 'requesting' ? 'ยกเลิกขอใช้ไมโครโฟน' : busy ? 'หยุดรอบ' : result ? 'ซ้อมอีกรอบ' : 'เริ่มรอบซ้อม'}
        </button>
        {mic.state === 'activation' && <button className="subtle-button" onClick={stop}>ยกเลิก</button>}
      </div>
      {mic.error && <p className="field-error" role="alert">{mic.error}</p>}
      {result && (
        <div className="vocal-round-result" role="status">
          <CheckCircle2 size={22} />
          <div>
            <strong>ความแม่นยำ {result.accuracy}%</strong>
            <VocalStars stars={gradeStars(result.accuracy, 100, exercise.maxStars)} max={exercise.maxStars} />
            <p>ตรวจพบเสียงร้อง {result.coverage}% ของช่วงที่ให้คะแนน คลาดไม่เกิน ±50 cents นับว่าตรงคีย์</p>
          </div>
        </div>
      )}
    </section>
  )
}
