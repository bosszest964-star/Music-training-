import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Play, Square, Wind } from 'lucide-react'
import { playMetronomeClick } from '../audio/metronomeClick'
import { difficultyNames } from '../exerciseMetadata'
import { breathFrame, breathingPatterns, breathTicks } from './breathing'
import type { VocalStats } from './stats'

const cycles = 3

interface Session {
  context: AudioContext
  frame: number
  removeListeners?: () => void
}

export default function BreathingPacer({ save, onActiveChange }: {
  save: VocalStats['saveRound']
  onActiveChange: (active: boolean) => void
}) {
  const [exercise, setExercise] = useState(breathingPatterns[0])
  const [sound, setSound] = useState(true)
  const [status, setStatus] = useState<'idle' | 'starting' | 'running' | 'complete'>('idle')
  const [cue, setCue] = useState({ cycle: 0, label: 'พร้อมเริ่ม', remaining: 0 })
  const [error, setError] = useState('')
  const circle = useRef<HTMLDivElement>(null)
  const session = useRef<Session | null>(null)
  const busy = status === 'starting' || status === 'running'

  useEffect(() => () => {
    if (session.current) {
      session.current.removeListeners?.()
      cancelAnimationFrame(session.current.frame)
      void session.current.context.close().catch(() => {})
      session.current = null
    }
    onActiveChange(false)
  }, [onActiveChange])

  function stop(complete = false) {
    const current = session.current
    session.current = null
    if (current) {
      current.removeListeners?.()
      cancelAnimationFrame(current.frame)
      void current.context.close().catch(() => {})
    }
    circle.current?.style.removeProperty('--breath-scale')
    setStatus(complete ? 'complete' : 'idle')
    setCue({ cycle: complete ? cycles - 1 : 0, label: complete ? 'จบการฝึก' : 'พร้อมเริ่ม', remaining: 0 })
    onActiveChange(false)
  }

  async function start() {
    if (session.current) return
    setError('')
    setStatus('starting')
    let current: Session | undefined
    try {
      const context = new AudioContext({ latencyHint: 'interactive' })
      current = { context, frame: 0 }
      const run = current
      session.current = run
      await context.resume()
      if (session.current !== run) return
      if (context.state !== 'running') throw new Error('Audio context is not running')
      const duration = exercise.cycle * cycles
      const startTime = context.currentTime + 0.12
      if (sound) {
        const output = context.createGain()
        output.gain.value = 0.14
        output.connect(context.destination)
        const ticks = breathTicks(exercise)
        for (let cycle = 0; cycle < cycles; cycle += 1) {
          for (const tick of ticks) {
            playMetronomeClick(context, output, startTime + cycle * exercise.cycle + tick.at, tick.accent ? 'secondary' : 'regular')
          }
        }
      }

      const onHidden = () => { if (document.hidden) stop() }
      const onLeave = () => stop()
      document.addEventListener('visibilitychange', onHidden)
      window.addEventListener('pagehide', onLeave)
      run.removeListeners = () => {
        document.removeEventListener('visibilitychange', onHidden)
        window.removeEventListener('pagehide', onLeave)
      }
      let lastCue = ''
      let started = false
      function animate() {
        if (session.current !== run) return
        if (document.hidden || context.state !== 'running') {
          stop()
          return
        }
        const elapsed = context.currentTime - startTime
        if (elapsed >= duration) {
          stop(true)
          save({ kind: 'breath', exercise: exercise.id, duration })
          return
        }
        if (elapsed >= 0) {
          if (!started) {
            started = true
            onActiveChange(true)
            setStatus('running')
          }
          const frame = breathFrame(exercise, elapsed)
          circle.current?.style.setProperty('--breath-scale', String(frame.scale))
          const key = `${frame.cycle}:${frame.label}:${frame.remaining}`
          if (key !== lastCue) {
            lastCue = key
            setCue(frame)
          }
        }
        run.frame = requestAnimationFrame(animate)
      }
      run.frame = requestAnimationFrame(animate)
    } catch {
      if (current && current !== session.current) return
      stop()
      setError('เริ่มระบบเสียงไม่ได้ แตะเริ่มอีกครั้งหลังตรวจอุปกรณ์เสียง')
    }
  }

  return (
    <section className="panel vocal-panel" aria-labelledby="breath-title">
      <header className="panel-header">
        <span className="tool-icon purple"><Wind size={22} /></span>
        <div><h2 id="breath-title">ฝึกควบคุมลมหายใจ</h2><p>หายใจตามวงกลมเพื่อเตรียมลมก่อนร้องเพลง</p></div>
      </header>
      <div className="vocal-exercises vocal-breath-options" role="group" aria-label="เลือกแบบฝึกหายใจ">
        {breathingPatterns.map(pattern => (
          <button key={pattern.id} aria-pressed={exercise.id === pattern.id} disabled={busy} onClick={() => {
            if (exercise.id !== pattern.id) {
              stop()
              setExercise(pattern)
              setError('')
            }
          }}>
            <strong>{pattern.label}</strong><small>{pattern.timing} · ระดับ{difficultyNames[pattern.difficulty]}</small>
          </button>
        ))}
      </div>
      <p className="vocal-coach">{exercise.coach} หายใจเท่าที่สบายและพักทันทีหากรู้สึกเวียนหัว</p>
      <div className="vocal-breath-stage">
        <div className="vocal-breath-orbit" aria-hidden="true"><div ref={circle} /></div>
        <div className="vocal-breath-count">
          <span role="status">{cue.label}</span>
          <strong aria-label={cue.remaining ? `เหลือ ${cue.remaining} วินาที` : undefined}>{cue.remaining || '–'}</strong>
          <small>รอบ {cue.cycle + 1} / {cycles}</small>
        </div>
      </div>
      <div className="vocal-actions">
        <button className="primary-button" onClick={() => busy ? stop() : void start()}>
          {busy ? <Square size={17} /> : <Play size={17} />}
          {busy ? 'หยุดฝึกลมหายใจ' : status === 'complete' ? 'ฝึกอีกครั้ง' : 'เริ่มฝึกลมหายใจ'}
        </button>
        <label className="vocal-sound"><input type="checkbox" checked={sound} disabled={busy}
          onChange={event => setSound(event.currentTarget.checked)} />เสียงเคาะเบา ๆ</label>
      </div>
      {error && <p className="field-error" role="alert">{error}</p>}
      {status === 'complete' && <div className="vocal-round-result" role="status">
        <CheckCircle2 size={22} /><strong>ฝึกครบ {cycles} รอบและบันทึกเวลาซ้อมแล้ว</strong>
      </div>}
    </section>
  )
}
