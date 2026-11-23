import { useEffect, useMemo, useRef, useState } from 'react'
import { Activity, CheckCircle2, Minus, Plus, RotateCcw, Square, Volume2 } from 'lucide-react'
import { playNote } from '../audio/noteSynth'
import { noteLabel } from '../audio/pitch'
import { bpmLimits, buildWarmup, fittedRoot, limitRoot, scoreRound, targetAt, tolerance, warmups } from './music'
import type { VocalRange, WarmupId, WarmupPlan } from './music'
import PitchGraph from './PitchGraph'
import type { PitchTrace } from './PitchGraph'
import { useMicrophonePitch } from '../audio/useMicrophonePitch'
import type { VocalStats } from './stats'

type Phase = 'idle' | 'demo' | 'count' | 'singing' | 'complete'
const phaseLabel: Record<Phase, string> = {
  idle: 'พร้อมเริ่ม', demo: 'ฟังเปียโนนำ', count: 'เตรียมร้อง', singing: 'ร้องตามแถบโน้ต', complete: 'จบรอบ',
}
const initialFeedback = { target: null as number | null, input: null as number | null, cents: null as number | null }

function scheduleDemo(context: AudioContext, plan: WarmupPlan) {
  const start = context.currentTime + 0.08
  for (const target of plan.targets) {
    const duration = Math.min(target.end - target.start, plan.beat) * 0.68
    playNote(context, context.destination, target.from, start + target.start, duration, 'piano', 0.25)
  }
  const end = start + plan.duration
  if (plan.id === 'siren') {
    playNote(context, context.destination, plan.root, end - plan.beat, plan.beat * 0.6, 'piano', 0.25)
  }
  for (let beat = 0; beat < 2; beat += 1) {
    playNote(context, context.destination, 84, end + beat * plan.beat, 0.07, 'soft', 0.16)
  }
  // Keep the demo and count-in outside the scored microphone window.
  return { demoEnd: end, singStart: end + 2 * plan.beat + 0.1 }
}

export default function WarmupSession({ range, save, onActiveChange }: {
  range: VocalRange | null
  save: VocalStats['saveRound']
  onActiveChange: (active: boolean) => void
}) {
  const [exercise, setExercise] = useState<WarmupId>('scale')
  const [bpm, setBpm] = useState(92)
  const [transpose, setTranspose] = useState(0)
  const [phase, setPhase] = useState<Phase>('idle')
  const [count, setCount] = useState(2)
  const [feedback, setFeedback] = useState(initialFeedback)
  const [result, setResult] = useState<ReturnType<typeof scoreRound> | null>(null)
  const mic = useMicrophonePitch()
  const trace = useRef<PitchTrace | null>(null)
  const [sessionPlan, setSessionPlan] = useState<WarmupPlan | null>(null)
  const span = warmups[exercise].span
  const base = fittedRoot(range, span)
  const root = limitRoot(base + transpose, span)
  const selection = useMemo(() => buildWarmup(exercise, bpm, root), [exercise, bpm, root])
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
    let demoEnd = 0
    let singStart = 0
    let lastCount = 2
    let counting = false
    let hasStarted = false
    let lastFeedback = -Infinity

    void mic.start({
      onReady(context) {
        const schedule = scheduleDemo(context, selection)
        demoEnd = schedule.demoEnd
        singStart = schedule.singStart
        setCount(2)
        setPhase('demo')
      },
      onFrame(time, pitch) {
        if (time < singStart) {
          if (time >= demoEnd) {
            if (!counting) {
              counting = true
              setPhase('count')
            }
            const remaining = Math.min(2, Math.max(1, Math.ceil((singStart - time - 0.1) / selection.beat)))
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
        save({ ...scored, exercise, bpm, root, duration: selection.duration })
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
        <span className="tool-icon purple"><Activity size={22} /></span>
        <div><h2 id="warmup-title">วอร์มเสียงกับเปียโน</h2><p>ฟังตัวอย่างและนับเข้า จากนั้นร้องตามกราฟ</p></div>
        <span className={`status vocal-phase ${phase === 'singing' ? 'status-live' : ''}`} role="status">{prompt}</span>
      </header>
      <div className="vocal-exercises" role="group" aria-label="เลือกแบบฝึกวอร์มเสียง">
        {(Object.keys(warmups) as WarmupId[]).map(id => (
          <button key={id} type="button" aria-pressed={exercise === id} disabled={busy} onClick={() => {
            if (exercise === id) return
            clearRound()
            setExercise(id)
            setTranspose(0)
          }}>
            <strong>{warmups[id].label}</strong><small>{warmups[id].detail}</small>
          </button>
        ))}
      </div>
      <div className="vocal-settings">
        <div className="vocal-bpm">
          <label htmlFor="vocal-bpm">ความเร็ว <strong>{bpm} BPM</strong></label>
          <input id="vocal-bpm" type="range" min={bpmLimits.min} max={bpmLimits.max} value={bpm} disabled={busy}
            onChange={event => {
              clearRound()
              setBpm(event.currentTarget.valueAsNumber)
            }} />
        </div>
        <div className="vocal-transpose" role="group" aria-label="เลื่อนคีย์">
          <button className="square-button" aria-label="ลดคีย์ครึ่งเสียง" disabled={busy || root <= limitRoot(root - 1, span)}
            onClick={() => {
              clearRound()
              setTranspose(root - 1 - base)
            }}><Minus size={17} /></button>
          <div><span>{range && plan.root === base ? 'คีย์ตามช่วงเสียง' : 'คีย์เริ่มต้น'}</span><strong>{noteLabel(plan.root)}</strong></div>
          <button className="square-button" aria-label="เพิ่มคีย์ครึ่งเสียง" disabled={busy || root >= limitRoot(root + 1, span)}
            onClick={() => {
              clearRound()
              setTranspose(root + 1 - base)
            }}><Plus size={17} /></button>
          {root !== base && <button className="subtle-button" disabled={busy} onClick={() => {
            clearRound()
            setTranspose(0)
          }}><RotateCcw size={15} />คืนคีย์แนะนำ</button>}
        </div>
      </div>
      {range && !busy && (root < range.low || root + span > range.high) && (
        <p className="vocal-help">
          {span > range.high - range.low
            ? 'ช่วงโน้ตของแบบฝึกกว้างกว่าช่วงเสียงที่วัดไว้ ลองเลือกแบบฝึกที่ใช้ช่วงแคบลง'
            : 'คีย์ที่เลือกมีโน้ตอยู่นอกช่วงเสียงที่วัดไว้ กดคืนคีย์แนะนำเพื่อให้พอดีกับช่วงเสียง'}
        </p>
      )}
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
            <p>ตรวจพบเสียงร้อง {result.coverage}% ของช่วงที่ให้คะแนน คลาดไม่เกิน ±50 cents นับว่าตรงคีย์</p>
          </div>
        </div>
      )}
    </section>
  )
}
