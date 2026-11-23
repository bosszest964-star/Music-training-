import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Rocket, Square, Volume2 } from 'lucide-react'
import { playMetronomeClick } from '../audio/metronomeClick'
import { pianoReady, playPiano } from '../audio/pianoEngine'
import PianoLoadStatus from '../audio/PianoLoadStatus'
import { noteLabel } from '../audio/pitch'
import { useMicrophonePitch } from '../audio/useMicrophonePitch'
import { difficultyNames, gradeStars } from '../exerciseMetadata'
import { advanceFlight, createFlight, flyerLevels, readFlightPitch } from './flyer'
import type { Flight } from './flyer'
import FlyerCanvas from './FlyerCanvas'
import { KeyControls } from './KeyControls'
import { fittedRoot, limitRoot } from './music'
import type { VocalRange } from './music'
import type { VocalStats } from './stats'
import { VocalStars } from './VocalControls'

const emptyReadout = { hits: 0, combo: 0, note: null as number | null }

export default function PitchFlyer({ range, save, onActiveChange }: {
  range: VocalRange | null
  save: VocalStats['saveRound']
  onActiveChange: (active: boolean) => void
}) {
  const [level, setLevel] = useState(flyerLevels[0])
  const [transpose, setTranspose] = useState(0)
  const [phase, setPhase] = useState<'idle' | 'intro' | 'flying' | 'complete'>('idle')
  const [flight, setFlight] = useState<Flight | null>(null)
  const [readout, setReadout] = useState(emptyReadout)
  const base = fittedRoot(range, level.span)
  const root = limitRoot(base + transpose, level.span)
  const preview = useMemo(() => createFlight(level, root), [level, root])
  const mic = useMicrophonePitch()
  const busy = mic.state !== 'idle'

  useEffect(() => () => onActiveChange(false), [onActiveChange])

  function reset() {
    setPhase('idle')
    setFlight(null)
    setReadout(emptyReadout)
    onActiveChange(false)
  }

  function start() {
    reset()
    const current = createFlight(level, root)
    setFlight(current)
    let startTime = 0
    let flying = false
    let lastReadout = -Infinity

    void mic.start({
      onReady(context) {
        const intro = context.currentTime + 0.12
        const sampled = pianoReady(current.notes)
        current.notes.forEach((midi, index) => {
          playPiano(context, context.destination, { midi, time: intro + index * current.beat * 0.5,
            duration: current.beat * 0.34, level: 0.25, sampled })
        })
        const countAt = intro + (current.notes.length * 0.5 + 0.5) * current.beat
        const output = context.createGain()
        output.gain.value = 0.19
        output.connect(context.destination)
        playMetronomeClick(context, output, countAt, 'downbeat')
        playMetronomeClick(context, output, countAt + current.beat, 'regular')
        startTime = countAt + current.beat * 2
        setPhase('intro')
      },
      onFrame(time, sample) {
        const elapsed = time - startTime
        if (elapsed < 0) return
        if (!flying) {
          flying = true
          onActiveChange(true)
          setPhase('flying')
        }
        if (sample && sample.time >= startTime) readFlightPitch(current, sample.time - startTime, sample.midi)
        advanceFlight(current, elapsed)
        if (elapsed - lastReadout >= 0.12) {
          lastReadout = elapsed
          setReadout({ hits: current.hits, combo: current.combo, note: current.gates[current.next]?.note ?? null })
        }
        if (elapsed < current.duration) return
        mic.stop()
        onActiveChange(false)
        setReadout({ hits: current.hits, combo: current.combo, note: null })
        setPhase('complete')
        save({ kind: 'pitch', exercise: level.id, root, bpm: level.bpm, duration: current.duration,
          accuracy: Math.round(100 * current.hits / current.gates.length),
          coverage: Math.round(100 * current.voiced / current.gates.length), combo: current.bestCombo })
      },
      onLost: reset,
    })
  }

  function stop() {
    mic.stop()
    reset()
  }

  const prompt = mic.state === 'requesting' ? 'รออนุญาตไมโครโฟน' : mic.state === 'activation' ? 'แตะเพื่อเปิดระบบเสียง'
    : phase === 'intro' ? 'ฟังสเกลและจังหวะนับนำ' : phase === 'flying' ? 'ร้องเพื่อบังคับยาน'
      : phase === 'complete' ? 'จบด่าน' : 'พร้อมบิน'
  const target = readout.note ?? (phase === 'flying' || phase === 'complete' ? null : preview.gates[0].note)

  return (
    <section className="panel vocal-panel" aria-labelledby="flyer-title">
      <header className="panel-header">
        <span className="tool-icon purple"><Rocket size={22} /></span>
        <div><h2 id="flyer-title">ร้องพายานเก็บดาว</h2><p>ร้องสูงเพื่อบินขึ้น ร้องต่ำเพื่อบินลง</p></div>
        <span className="status vocal-phase" role="status">{prompt}</span>
      </header>
      <div className="vocal-exercises vocal-flyer-levels" role="group" aria-label="เลือกสเกลของด่าน">
        {flyerLevels.map(item => (
          <button key={item.id} aria-pressed={item.id === level.id} disabled={busy} onClick={() => {
            if (item.id === level.id) return
            reset()
            setLevel(item)
            setTranspose(0)
          }}><strong>{item.label}</strong><small>ระดับ{difficultyNames[item.difficulty]} · {item.bpm} BPM</small></button>
        ))}
      </div>
      <div className="vocal-settings">
        <KeyControls range={range} span={level.span} root={root} disabled={busy} onChange={next => {
          reset()
          setTranspose(next - base)
        }} />
      </div>
      <PianoLoadStatus notes={preview.notes} />
      <FlyerCanvas flight={flight ?? preview} running={phase === 'flying'} />
      <div className="vocal-readout">
        <div><span>โน้ตเป้าหมาย</span><strong>{target === null ? '—' : noteLabel(target)}</strong></div>
        <div><span>ดาวที่เก็บได้</span><strong>{readout.hits}/{preview.gates.length}</strong></div>
        <div><span>คอมโบ</span><strong>{readout.combo}×</strong></div>
      </div>
      <div className="vocal-actions">
        <button className="primary-button" onClick={mic.state === 'activation' ? mic.activate : busy ? stop : start}>
          {!busy || mic.state === 'activation' ? <Volume2 size={17} /> : <Square size={17} />}
          {mic.state === 'activation' ? 'เริ่มระบบเสียง' : mic.state === 'requesting' ? 'ยกเลิกขอใช้ไมโครโฟน'
            : busy ? 'หยุดด่าน' : phase === 'complete' ? 'เล่นอีกครั้ง' : 'เริ่มบิน'}
        </button>
        {mic.state === 'activation' && <button className="subtle-button" onClick={stop}>ยกเลิก</button>}
      </div>
      {mic.error && <p className="field-error" role="alert">{mic.error}</p>}
      {phase === 'complete' && flight && <div className="vocal-round-result" role="status">
        <CheckCircle2 size={22} />
        <div>
          <strong>เก็บได้ {flight.hits}/{flight.gates.length} ดาว · คอมโบสูงสุด {flight.bestCombo}×</strong>
          <VocalStars stars={gradeStars(flight.hits, flight.gates.length, level.maxStars)} max={level.maxStars} />
        </div>
      </div>}
    </section>
  )
}
