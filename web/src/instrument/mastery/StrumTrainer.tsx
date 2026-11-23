import { useEffect, useRef, useState } from 'react'
import { Guitar, Play, Square } from 'lucide-react'
import { audibleTime } from '../../audio/audioClock'
import { playMetronomeClick } from '../../audio/metronomeClick'
import { difficultyNames } from '../../exerciseMetadata'
import { formatDuration } from '../../usePractice'
import { chordLibrary } from '../chords'
import type { ChordInstrument } from '../chords'
import type { SaveRound } from '../stats'
import { useStudioSound } from '../useStudioSound'
import { MasterySelect } from './MasteryControls'
import { chordLoops, scheduleStroke, strumPatterns } from './strumming'

const genres = [...new Set(strumPatterns.map(pattern => pattern.genre))]
type StrumSession = { frame: number; context?: AudioContext; start?: number }

export default function StrumTrainer({ save, onActiveChange }: { save: SaveRound; onActiveChange: (active: boolean) => void }) {
  const [pattern, setPattern] = useState(strumPatterns[0])
  const [instrument, setInstrument] = useState<ChordInstrument>('guitar')
  const [bpm, setBpm] = useState(pattern.bpm)
  const [chords, setChords] = useState(chordLoops[0].chords)
  const [clicks, setClicks] = useState(true)
  const [guide, setGuide] = useState(true)
  const [running, setRunning] = useState(false)
  const [view, setView] = useState({ step: -1, bar: -1 })
  const [done, setDone] = useState<number | null>(null)
  const session = useRef<StrumSession | null>(null)
  const { ready, stop: stopAudio, error } = useStudioSound()
  const library = chordLibrary[instrument]
  const stepsPerBar = pattern.steps.length

  useEffect(() => {
    function halt() {
      const current = session.current
      if (!current) return
      session.current = null
      cancelAnimationFrame(current.frame)
      stopAudio()
      onActiveChange(false)
    }
    function hide() {
      if (!document.hidden) return
      halt()
      setRunning(false)
      setView({ step: -1, bar: -1 })
    }
    document.addEventListener('visibilitychange', hide)
    return () => {
      document.removeEventListener('visibilitychange', hide)
      halt()
    }
  }, [onActiveChange, stopAudio])

  function pick(next: typeof pattern) {
    setPattern(next)
    setBpm(next.bpm)
    setDone(null)
  }

  function stop() {
    const current = session.current
    if (!current) return
    const duration = current.context && current.start !== undefined ? Math.max(0, current.context.currentTime - current.start) : 0
    session.current = null
    cancelAnimationFrame(current.frame)
    stopAudio()
    onActiveChange(false)
    setRunning(false)
    setView({ step: -1, bar: -1 })
    if (duration < 1) return
    save({ activity: 'strum', label: pattern.label, duration, exerciseId: pattern.id })
    setDone(duration)
  }

  async function start() {
    if (session.current) return
    const current: StrumSession = { frame: 0 }
    session.current = current
    setRunning(true)
    setDone(null)
    const active = await ready()
    if (session.current !== current) return
    if (!active || document.hidden) {
      stop()
      return
    }
    const { context, output } = active
    const sequence = chords.map(name => library.chords.find(chord => chord.name === name) ?? library.chords[0])
    const stepTime = 60 / (bpm * pattern.subdivision)
    const origin = context.currentTime + 0.09
    const startTime = origin + stepsPerBar * stepTime
    current.context = context
    current.start = startTime
    let next = 0
    let previous = -1
    let tracking = false
    const clockOut = context.createGain()
    clockOut.gain.value = 0.18
    clockOut.connect(output)

    function tick() {
      if (session.current !== current) return
      const now = context.currentTime
      if (context.state !== 'running') {
        stop()
        return
      }
      next = Math.max(next, Math.ceil((now - origin) / stepTime - 1e-6))
      while (origin + next * stepTime < now + .12) {
        const time = origin + next * stepTime
        const step = next % stepsPerBar
        const bar = Math.floor(next / stepsPerBar) - 1
        if ((clicks || bar < 0) && step % pattern.subdivision === 0) {
          playMetronomeClick(context, clockOut, time, step ? 'regular' : 'downbeat')
        }
        if (bar >= 0 && guide) scheduleStroke(context, output, instrument, library.strings,
          sequence[bar % sequence.length], pattern.steps[step], time, stepTime)
        next += 1
      }
      const frameTime = performance.now()
      const audible = audibleTime(frameTime, frameTime, now, context.outputLatency || context.baseLatency || 0,
        context.getOutputTimestamp?.())
      const absolute = Math.floor((Math.min(now, audible) - origin) / stepTime)
      if (absolute > previous) {
        previous = absolute
        const bar = Math.floor(absolute / stepsPerBar) - 1
        if (bar >= 0 && !tracking) {
          tracking = true
          onActiveChange(true)
        }
        setView({ bar, step: absolute % stepsPerBar })
      }
      current.frame = requestAnimationFrame(tick)
    }
    tick()
  }

  return (
    <section className="panel instrument-panel" aria-labelledby="strum-title">
      <header className="panel-header">
        <span className="tool-icon purple"><Guitar size={22} /></span>
        <div><h2 id="strum-title">ฝึกจังหวะตีคอร์ด</h2><p>ดูทิศทางมือขวาและเปลี่ยนคอร์ดเมื่อขึ้นห้องใหม่</p></div>
      </header>
      <div className="instrument-toolbar">
        <MasterySelect label="แนวเพลง" value={pattern.genre} disabled={running}
          onChange={genre => pick(strumPatterns.find(item => item.genre === genre) ?? strumPatterns[0])}>
          {genres.map(genre => <option key={genre}>{genre}</option>)}
        </MasterySelect>
        <MasterySelect label="แพตเทิร์น" value={pattern.id} disabled={running}
          onChange={id => pick(strumPatterns.find(item => item.id === id) ?? strumPatterns[0])}>
          {strumPatterns.filter(item => item.genre === pattern.genre).map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
        </MasterySelect>
        <MasterySelect label="เครื่องดนตรี" value={instrument} disabled={running} onChange={value => setInstrument(value as ChordInstrument)}>
          {Object.entries(chordLibrary).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
        </MasterySelect>
        <label className="instrument-field mastery-tempo">
          ความเร็ว <strong>{bpm} BPM</strong>
          <input type="range" min={30} max={240} value={bpm} disabled={running} onChange={event => setBpm(event.currentTarget.valueAsNumber)} />
        </label>
      </div>
      <p className="instrument-hint">{pattern.meter} · ระดับ{difficultyNames[pattern.difficulty]} · {pattern.tip}</p>
      <div className="instrument-toolbar">
        <MasterySelect label="ชุดคอร์ดวนลูป" value={chordLoops.findIndex(loop => loop.chords.join() === chords.join())} disabled={running}
          onChange={value => { const preset = chordLoops[Number(value)]; if (preset) setChords(preset.chords) }}>
          <option value={-1}>ชุดที่เลือกเอง</option>
          {chordLoops.map((loop, index) => <option value={index} key={loop.label}>{loop.label}</option>)}
        </MasterySelect>
        <label className="instrument-toggle"><input type="checkbox" checked={clicks} disabled={running}
          onChange={event => setClicks(event.currentTarget.checked)} />เมโทรนอม</label>
        <label className="instrument-toggle"><input type="checkbox" checked={guide} disabled={running}
          onChange={event => setGuide(event.currentTarget.checked)} />เสียงตีคอร์ดตัวอย่าง</label>
      </div>
      <div className="mastery-chord-loop" aria-label="คอร์ดที่เล่นตามลำดับ">
        {chords.map((name, index) => (
          <label key={index} className="mastery-chord-slot" data-active={view.bar >= 0 && view.bar % chords.length === index || undefined}>
            <span>ห้อง {index + 1}</span>
            <select aria-label={`คอร์ดห้อง ${index + 1}`} value={name} disabled={running} onChange={event => {
              const next = event.currentTarget.value
              setChords(previous => previous.map((chord, slot) => slot === index ? next : chord))
            }}>
              {library.chords.map(chord => <option key={chord.name}>{chord.name}</option>)}
            </select>
          </label>
        ))}
      </div>
      <div className="mastery-stroke-head">
        <strong>{view.bar >= 0 ? `รอบ ${Math.floor(view.bar / chords.length) + 1} · ${chords[view.bar % chords.length]}`
          : running ? 'นับนำหนึ่งห้อง' : 'แพตเทิร์นหนึ่งห้อง'}</strong>
        <span>↓ ลง · ↑ ขึ้น · × อุดสาย · › เน้น</span>
      </div>
      <div className="mastery-strum-grid">
        {Array.from({ length: stepsPerBar / pattern.subdivision }, (_, group) => (
          <div className="mastery-stroke-beat" key={group}>
            <span>{pattern.meter === '6/8' ? group * 3 + 1 : group + 1}</span>
            <div>{pattern.steps.slice(group * pattern.subdivision, (group + 1) * pattern.subdivision).map((stroke, index) => (
              <span key={index} aria-label={stroke.label} data-accent={stroke.accent || undefined}
                data-current={view.step === group * pattern.subdivision + index || undefined}>
                {stroke.accent && <small aria-hidden="true">›</small>}{stroke.mark}
              </span>
            ))}</div>
          </div>
        ))}
      </div>
      <div className="instrument-toolbar">
        <button className="primary-button" onClick={() => running ? stop() : void start()}>
          {running ? <Square size={17} /> : <Play size={17} />}{running ? 'หยุดและบันทึกเวลา' : 'เริ่มตีคอร์ด'}
        </button>
      </div>
      {error && <p className="field-error" role="alert">{error}</p>}
      {done !== null && <p className="instrument-result" role="status">บันทึกเวลาซ้อม {formatDuration(done)}</p>}
    </section>
  )
}
