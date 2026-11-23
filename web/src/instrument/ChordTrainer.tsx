import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Check, Guitar, Play, Square, Volume2 } from 'lucide-react'
import { noteLabel } from '../audio/pitch'
import { playNote } from '../audio/noteSynth'
import { chordLibrary, chordPitches, randomChords } from './chords'
import type { Chord, ChordInstrument } from './chords'
import type { SaveRound } from './stats'
import { useStudioSound } from './useStudioSound'

const roundLength = 8

function Fretboard({ chord, tuning }: { chord: Chord; tuning: readonly number[] }) {
  return (
    <div className="instrument-fretboard" style={{ '--strings': tuning.length } as CSSProperties}
      aria-label={`คอร์ด ${chord.name} ${chord.frets.map((fret, index) => `${noteLabel(tuning[index])} ${fret < 0 ? 'ไม่ดีด' : fret === 0 ? 'สายเปิด' : `เฟร็ต ${fret} นิ้ว ${chord.fingers[index]}`}`).join(', ')}`}
      role="img">
      {tuning.map((note, index) => {
        const fret = chord.frets[index]
        return <div className="instrument-string" key={index}>
          <span>{fret === 0 ? '○' : fret < 0 ? '×' : ' '}</span>
          <div className="instrument-frets">
            {[1, 2, 3, 4].map(number => (
              <div key={number}>{number === fret && <i>{chord.fingers[index]}</i>}</div>
            ))}
          </div>
          <span>{noteLabel(note).replace(/\d+$/, '')}</span>
        </div>
      })}
      <div className="instrument-fret-labels" aria-hidden="true">{[1, 2, 3, 4].map(number => <span key={number}>{number}</span>)}</div>
    </div>
  )
}

type Progression = {
  context: AudioContext
  chords: Chord[]
  start: number
  beat: number
  beatsPerChord: number
  ack: Set<number>
  frame: number
}

export default function ChordTrainer({ save, onActiveChange }: { save: SaveRound; onActiveChange: (active: boolean) => void }) {
  const [instrument, setInstrument] = useState<ChordInstrument>('guitar')
  const [selected, setSelected] = useState('C')
  const [bpm, setBpm] = useState(72)
  const [beats, setBeats] = useState(4)
  const [working, setWorking] = useState(false)
  const [show, setShow] = useState({ index: 0, beat: 0, progress: 0, done: false })
  const [result, setResult] = useState<number | null>(null)
  const { ready, stop: stopSound, sound, error } = useStudioSound()
  const generation = useRef(0)
  const round = useRef<Progression | null>(null)
  const current = chordLibrary[instrument]
  const chord = current.chords.find(item => item.name === selected) ?? current.chords[0]

  useEffect(() => {
    function hide() {
      if (!document.hidden) return
      generation.current += 1
      if (round.current) cancelAnimationFrame(round.current.frame)
      round.current = null
      stopSound()
      onActiveChange(false)
      setWorking(false)
    }
    document.addEventListener('visibilitychange', hide)
    return () => {
      generation.current += 1
      if (round.current) cancelAnimationFrame(round.current.frame)
      round.current = null
      document.removeEventListener('visibilitychange', hide)
      onActiveChange(false)
    }
  }, [onActiveChange, stopSound])

  function stop() {
    generation.current += 1
    if (round.current) cancelAnimationFrame(round.current.frame)
    round.current = null
    stopSound()
    onActiveChange(false)
    setWorking(false)
  }

  async function start() {
    const token = ++generation.current
    setResult(null)
    setWorking(true)
    setShow({ index: 0, beat: 0, progress: 0, done: false })
    const active = await ready()
    if (token !== generation.current) return
    if (!active) {
      setWorking(false)
      return
    }
    const { context, output } = active
    const game: Progression = {
      context, chords: randomChords(current.chords, roundLength), start: context.currentTime + 0.09,
      beat: 60 / bpm, beatsPerChord: beats, ack: new Set(), frame: 0,
    }
    round.current = game
    onActiveChange(true)
    const totalBeats = roundLength * beats
    const duration = totalBeats * game.beat
    let nextBeat = 0

    function update() {
      if (round.current !== game) return
      const now = context.currentTime
      const elapsed = Math.max(0, now - game.start)
      if (elapsed >= duration) {
        const score = Math.round(100 * game.ack.size / roundLength)
        stop()
        setResult(score)
        save({ activity: 'chords', label: current.label, duration, accuracy: score })
        return
      }
      // Schedule short cue tones against the audio clock.
      while (nextBeat < totalBeats && game.start + nextBeat * game.beat < now + 0.11) {
        const time = game.start + nextBeat * game.beat
        if (time >= now) playNote(context, output, nextBeat % beats === 0 ? 88 : 79, time, 0.065, 'soft', 0.2)
        nextBeat += 1
      }
      const index = Math.floor(elapsed / (game.beat * beats))
      setShow({ index, beat: Math.floor(elapsed / game.beat) % beats + 1,
        progress: elapsed / (game.beat * beats) - index, done: game.ack.has(index) })
      game.frame = requestAnimationFrame(update)
    }

    update()
  }

  function acknowledge() {
    const game = round.current
    if (!game) return
    const time = game.context.currentTime - game.start
    const index = Math.floor(time / (game.beat * game.beatsPerChord))
    if (index < 0 || index >= roundLength || game.ack.has(index)) return
    game.ack.add(index)
    setShow(previous => ({ ...previous, done: true }))
  }

  const activeChord = round.current?.chords[show.index]
  const nextChord = round.current?.chords[show.index + 1]
  const displayed = activeChord ?? chord

  return (
    <section className="panel instrument-panel" aria-labelledby="chords-title">
      <header className="panel-header">
        <span className="tool-icon purple"><Guitar size={22} /></span>
        <div><h2 id="chords-title">คลังคอร์ดและซ้อมเปลี่ยนคอร์ด</h2><p>ดูตำแหน่งนิ้ว ฟังตัวอย่าง แล้วซ้อมเปลี่ยนคอร์ดตามจังหวะ</p></div>
      </header>
      <div className="instrument-toolbar">
        <div className="segmented" role="group" aria-label="เลือกเครื่องดนตรี">
          {(Object.keys(chordLibrary) as ChordInstrument[]).map(id =>
            <button key={id} disabled={working} aria-pressed={instrument === id} onClick={() => {
              setInstrument(id)
              setResult(null)
            }}>{chordLibrary[id].label}</button>)}
        </div>
        <div className="segmented instrument-chord-list" role="group" aria-label="เลือกคอร์ด">
          {current.chords.map(item => <button key={item.name} disabled={working} aria-pressed={item.name === selected}
            onClick={() => setSelected(item.name)}>{item.name}</button>)}
        </div>
      </div>
      <div className="instrument-chord-workspace">
        <div className="instrument-chord-card">
          <strong className="instrument-chord-name">{displayed.name}</strong>
          <Fretboard chord={displayed} tuning={current.strings} />
          <p className="instrument-hint">○ สายเปิด · × ไม่ดีด · ตัวเลขคือหมายเลขนิ้ว</p>
          <button className="subtle-button" disabled={working} onClick={() => {
            void sound(chordPitches(chord, current.strings), instrument, 0.53, 0.038)
          }}><Volume2 size={17} />ฟังเสียงดีดคอร์ด</button>
        </div>
        <div className="instrument-progression">
          <h3>สุ่มซ้อมเปลี่ยนคอร์ด</h3>
          <label className="instrument-field">ความเร็ว <strong>{bpm} BPM</strong>
            <input type="range" min={40} max={160} value={bpm} disabled={working}
              onChange={event => setBpm(event.currentTarget.valueAsNumber)} />
          </label>
          <div className="instrument-toolbar">
            <span>จังหวะต่อคอร์ด</span>
            <div className="segmented" role="group" aria-label="จังหวะต่อคอร์ด">
              {[2, 4, 8].map(value => <button key={value} aria-pressed={value === beats} disabled={working}
                onClick={() => setBeats(value)}>{value}</button>)}
            </div>
          </div>
          {activeChord && <div className="instrument-round-cue">
            <strong>{show.index + 1}/{roundLength} · จังหวะ {show.beat}/{beats}</strong>
            <span>{nextChord ? `คอร์ดถัดไป ${nextChord.name}` : 'คอร์ดสุดท้าย'}</span>
            <progress aria-label="เวลาที่ใช้ไปในคอร์ด" max={1} value={show.progress} />
          </div>}
          <p className="instrument-hint">กด «ทำทัน» หลังจับคอร์ดได้ คะแนนส่วนนี้มาจากการประเมินของคุณ</p>
          <div className="instrument-toolbar">
            <button className="primary-button" onClick={working ? stop : () => void start()}>
              {working ? <Square size={17} /> : <Play size={17} />}{working ? 'หยุดซ้อมคอร์ด' : 'เริ่มสุ่มคอร์ด'}
            </button>
            {activeChord && <button className="subtle-button" disabled={show.done} onClick={acknowledge}>
              <Check size={17} />{show.done ? 'บันทึกแล้ว' : 'ทำทัน'}
            </button>}
          </div>
          {result !== null && <p className="instrument-result" role="status">ทำทันตามที่บันทึก <strong>{result}%</strong></p>}
          {error && <p className="field-error" role="alert">{error}</p>}
        </div>
      </div>
    </section>
  )
}
