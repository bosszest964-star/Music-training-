import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { AudioLines, ChevronDown, Hand, Play, Square } from 'lucide-react'
import { difficultyNames } from '../exerciseMetadata'
import type { ExerciseDifficulty } from '../exerciseMetadata'
import type { EarStatsData } from '../stats'
import { createRhythmAudio } from './rhythmAudio'
import { barPulses, rhythmPatterns } from './rhythmPatterns'
import type { RhythmPattern } from './rhythmPatterns'
import { accuracyWindowMs, exactWindowMs, judgeTap, summarizeTaps, tapNames } from './rhythmScore'
import type { TapMark } from './rhythmScore'
import { RoundGrade } from './TrainingControls'

type Mode = 'demo' | 'round'
const levels = Object.keys(difficultyNames) as ExerciseDifficulty[]

export default function RhythmTapTrainer({ stats, preset }: { stats: EarStatsData; preset?: RhythmPattern }) {
  const [pattern, setPattern] = useState<RhythmPattern>(preset ?? rhythmPatterns[0])
  const [mode, setMode] = useState<Mode | null>(null)
  const [time, setTime] = useState<number | null>(null)
  const [taps, setTaps] = useState<TapMark[]>([])
  const [result, setResult] = useState<ReturnType<typeof summarizeTaps> | null>(null)
  const [error, setError] = useState('')
  const [player] = useState(createRhythmAudio)
  const current = useRef<TapMark[]>([])
  const used = useRef(new Set<number>())
  const run = useRef(0)
  const active = useRef<Mode | null>(null)
  const tapButton = useRef<HTMLButtonElement>(null)
  const flashTimer = useRef(0)
  const beat = 60 / pattern.bpm
  const duration = pattern.beats * beat
  const targets = pattern.taps.map(tap => tap * beat)
  const last = taps.at(-1)
  const pulses = barPulses(pattern)
  const next = !preset && rhythmPatterns[rhythmPatterns.indexOf(pattern) + 1]

  const clearPadFlash = useCallback(() => {
    window.clearTimeout(flashTimer.current)
    tapButton.current?.removeAttribute('data-tapped')
  }, [])

  useEffect(() => {
    function hide() {
      if (!document.hidden || !active.current) return
      run.current += 1
      active.current = null
      player.stop()
      clearPadFlash()
      setMode(null)
      setTime(null)
      setTaps([])
      setError('การเล่นหยุดเมื่อออกจากหน้านี้ กดเริ่มเพื่อซ้อมใหม่')
    }
    document.addEventListener('visibilitychange', hide)
    return () => {
      document.removeEventListener('visibilitychange', hide)
      run.current += 1
      active.current = null
      player.dispose()
      clearPadFlash()
    }
  }, [player, clearPadFlash])

  useEffect(() => {
    if (!mode) return
    if (mode === 'round') tapButton.current?.focus({ preventScroll: true })
    let frame = 0
    function render() {
      setTime(player.position())
      frame = requestAnimationFrame(render)
    }
    frame = requestAnimationFrame(render)
    return () => cancelAnimationFrame(frame)
  }, [mode, player])

  function stop() {
    run.current += 1
    active.current = null
    player.stop()
    clearPadFlash()
    setMode(null)
    setTime(null)
    setTaps([])
    setError('')
  }

  function change(nextPattern: RhythmPattern) {
    stop()
    setPattern(nextPattern)
    setResult(null)
  }

  function start(nextMode: Mode) {
    if (active.current) return
    const token = ++run.current
    active.current = nextMode
    setMode(nextMode)
    setTime(null)
    setTaps([])
    setResult(null)
    setError('')
    current.current = []
    used.current.clear()

    function fail(message: string) {
      if (run.current !== token) return
      stop()
      player.dispose()
      setError(message)
    }

    void player.start(pattern, nextMode === 'demo', () => {
      if (run.current !== token) return
      active.current = null
      clearPadFlash()
      setMode(null)
      setTime(null)
      if (nextMode === 'round') {
        const summary = summarizeTaps(pattern.taps.length, current.current)
        setResult(summary)
        stats.recordExercise(pattern, summary.correct, summary.attempts, current.current.length > 0)
      }
    }, () => fail('เสียงจังหวะถูกพัก ลองแตะเริ่มใหม่')).catch(() => {
      fail('เปิดเสียงจังหวะไม่ได้ ลองแตะเริ่มใหม่')
    })
  }

  function tap(timestamp: number) {
    if (active.current !== 'round') return
    window.clearTimeout(flashTimer.current)
    tapButton.current?.setAttribute('data-tapped', '')
    flashTimer.current = window.setTimeout(clearPadFlash, 115)

    const position = player.position(timestamp)
    if (position === null || position < -0.145 || position > duration + 0.02) return
    const mark = judgeTap(targets, used.current, position)
    if (mark.index >= 0) used.current.add(mark.index)
    current.current = [...current.current, mark]
    setTaps(current.current)
  }

  const progress = time === null ? 0 : Math.max(0, Math.min(100, time / duration * 100))
  const status = mode === null ? 'พร้อมเริ่ม' : time === null ? 'กำลังเปิดเสียง' :
    time < 0 ? `นับนำ ${Math.max(1, Math.min(pulses, Math.ceil(-time / beat)))}` :
      mode === 'demo' ? 'ฟังตัวอย่าง' : `ห้อง ${Math.min(pattern.beats / pulses, 1 + Math.floor(time / beat / pulses))}`

  return (
    <div className="advanced-body rhythm-trainer">
      <div className="advanced-heading"><div><h2>เคาะจังหวะ</h2>
        <p>ฟังนับนำ {pulses} จังหวะ แล้วเคาะเมื่อเส้นเวลาเดินถึงจุดของแพตเทิร์น</p></div>
        {!preset && <label className="eq-source"><span>เลือกด่าน</span><span className="eq-select">
          <select value={pattern.id} onChange={event => {
            const selected = rhythmPatterns.find(item => item.id === event.target.value)
            if (selected) change(selected)
          }}>
            {levels.map(level => (
              <optgroup label={`ระดับ${difficultyNames[level]}`} key={level}>
                {rhythmPatterns.filter(item => item.difficulty === level).map(item => (
                  <option value={item.id} key={item.id}>{rhythmPatterns.indexOf(item) + 1}. {item.label}</option>
                ))}
              </optgroup>
            ))}
          </select><ChevronDown size={16} /></span>
        </label>}
      </div>
      <div className="advanced-transport">
        {mode ? <button type="button" className="subtle-button" onClick={stop}><Square size={17} />หยุดรอบ</button> : <>
          <button type="button" className="primary-button" onClick={() => start('round')}><Play size={17} />เริ่มเคาะ</button>
          <button type="button" className="subtle-button" onClick={() => start('demo')}><AudioLines size={17} />ฟังตัวอย่าง</button>
        </>}
        <span>{pattern.bpm} BPM · {pattern.meter ?? '4/4'} · {pattern.beats / pulses} ห้อง · ดีที่สุด {stats.bestStars[pattern.id] ?? 0}/{pattern.maxStars} ดาว</span>
      </div>
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="rhythm-chart" role="img" aria-label={`จุดเคาะของแพตเทิร์น ${pattern.taps.length} จุด`}>
        <div className="rhythm-grid" style={{ '--units': pattern.beats } as CSSProperties}>
          {Array.from({ length: pattern.beats }, (_, index) => <span key={index}>{index % pulses + 1}</span>)}
        </div>
        {pattern.taps.map((at, index) => <i key={at} style={{ '--position': `${100 * at / pattern.beats}%` } as CSSProperties}
          data-grade={taps.find(tap => tap.index === index)?.grade ?? (result ? 'missed' : undefined)} />)}
        {time !== null && time >= 0 && <b style={{ '--position': `${progress}%` } as CSSProperties} aria-hidden="true" />}
      </div>
      <div className="rhythm-readout">
        <span>{status}</span>
        {last && <strong data-grade={last.grade}>{tapNames[last.grade]}
          {last.index >= 0 && ` · ${last.offset > 0 ? '+' : ''}${last.offset} ms`}</strong>}
      </div>
      <button type="button" ref={tapButton} className="rhythm-pad" disabled={mode !== 'round'} onPointerDown={event => {
        if (event.button === 0) tap(event.timeStamp)
      }} onKeyDown={event => {
        if (event.key !== ' ' && event.key !== 'Enter') return
        event.preventDefault()
        if (!event.repeat) tap(event.timeStamp)
      }} onClick={event => { if (event.detail === 0) tap(event.timeStamp) }}>
        <Hand size={27} />แตะเคาะ
      </button>
      <p className="rhythm-hint">ตรงเป๊ะภายใน ±{exactWindowMs} ms · คิดความแม่นยำภายใน ±{accuracyWindowMs} ms และนับการเคาะเกินด้วย</p>
      {result && <>
        <RoundGrade exercise={pattern} correct={result.correct} attempts={result.attempts}>
          {next && <button type="button" className="subtle-button" onClick={() => change(next)}>ด่านถัดไป</button>}
        </RoundGrade>
        <dl className="rhythm-summary">
          <div><dt>ตรงเป๊ะ</dt><dd>{result.exact}</dd></div>
          <div><dt>เร็วไป</dt><dd>{result.early}</dd></div>
          <div><dt>ช้าไป</dt><dd>{result.late}</dd></div>
          <div><dt>พลาด</dt><dd>{result.missed}</dd></div>
          <div><dt>เคาะเกิน</dt><dd>{result.extras}</dd></div>
          <div><dt>คลาดเฉลี่ย</dt><dd>{result.average === null ? '—' : `${result.average} ms`}</dd></div>
        </dl>
      </>}
    </div>
  )
}
