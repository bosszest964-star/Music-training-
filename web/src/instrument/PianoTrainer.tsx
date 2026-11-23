import { useEffect, useMemo, useRef, useState } from 'react'
import { FileMusic, Mic, Pause, Play, Square } from 'lucide-react'
import type { CSSProperties } from 'react'
import { noteLabel } from '../audio/pitch'
import PianoLoadStatus from '../audio/PianoLoadStatus'
import { useMicrophonePitch } from '../audio/useMicrophonePitch'
import { createPianoRound, pianoKeys } from './pianoGame'
import type { PianoRound } from './pianoGame'
import PianoRoll from './PianoRoll'
import { readMidi, songForHand } from './songs'
import type { PianoHand, PianoSong } from './songs'
import { difficultyNames, gradeStars } from '../exerciseMetadata'
import PianoKeyboard from './PianoKeyboard'
import { pianoById, pianoCurriculum, pianoGroups } from './mastery/curriculum'
import { MasterySelect, MasteryStars, MidiControl } from './mastery/MasteryControls'
import type { SaveRound } from './stats'
import { useMidiInput } from './useMidiInput'
import { useStudioSound } from './useStudioSound'

const handLabels = { both: 'สองมือ', left: 'มือซ้าย', right: 'มือขวา' } as const

const clock = () => performance.now() / 1000

export default function PianoTrainer({ save, onActiveChange }: { save: SaveRound; onActiveChange: (active: boolean) => void }) {
  const [selection, setSelection] = useState(pianoCurriculum[0].id)
  const [group, setGroup] = useState<keyof typeof pianoGroups>(pianoCurriculum[0].group)
  const [hand, setHand] = useState<PianoHand | 'both'>('both')
  const [imported, setImported] = useState<PianoSong | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [wait, setWait] = useState(true)
  const [state, setState] = useState<'idle' | 'playing' | 'paused' | 'complete'>('idle')
  const [view, setView] = useState<ReturnType<PianoRound['snapshot']> | null>(null)
  const [score, setScore] = useState<number | null>(null)
  const [held, setHeld] = useState<ReadonlySet<number>>(new Set())
  const presses = useRef(new Map<string, number>())
  const sounding = useRef(new Map<string, { release?: () => void }>())
  const game = useRef<PianoRound | null>(null)
  const running = useRef(false)
  const elapsed = useRef(0)
  const started = useRef(0)
  const importId = useRef(0)
  const micSilentUntil = useRef(0)
  const scroller = useRef<HTMLDivElement>(null)
  const lesson = pianoById.get(selection)
  const fullSong = lesson ?? imported ?? pianoCurriculum[0]
  const song = useMemo(() => songForHand(fullSong, hand), [fullSong, hand])
  const layout = useMemo(() => pianoKeys(song.low, song.high), [song])
  const sound = useStudioSound()
  const mic = useMicrophonePitch()
  const playing = state === 'playing'

  function updateHeld() {
    setHeld(new Set(presses.current.values()))
  }

  function releaseKey(id: string) {
    const heldNote = sounding.current.get(id)
    if (!heldNote) return
    heldNote.release?.()
    sounding.current.delete(id)
    micSilentUntil.current = clock() + 0.65
  }

  function keyEvent(id: string, midi: number, down: boolean, velocity = 0.76) {
    if (!down) {
      releaseKey(id)
      if (presses.current.delete(id)) updateHeld()
      return
    }
    if (presses.current.has(id)) return
    presses.current.set(id, midi)
    updateHeld()
    if (!id.startsWith('mic:')) {
      const key: { release?: () => void } = {}
      sounding.current.set(id, key)
      void sound.piano(midi, velocity).then(release => {
        if (sounding.current.get(id) === key) key.release = release
        else release?.()
      })
    }
    if (!running.current) return
    game.current?.press(midi, clock())
    if (game.current) setView(game.current.snapshot())
  }

  const midiInput = useMidiInput({
    note: keyEvent,
    clear() {
      for (const id of presses.current.keys()) {
        if (id.startsWith('midi:')) {
          releaseKey(id)
          presses.current.delete(id)
        }
      }
      updateHeld()
    },
  })

  function micToggle() {
    if (mic.state === 'activation') {
      mic.activate()
      return
    }
    function clear() {
      for (const id of presses.current.keys()) if (id.startsWith('mic:')) presses.current.delete(id)
      updateHeld()
    }
    if (mic.state !== 'idle') {
      mic.stop()
      clear()
      return
    }
    // Pitch frames outlive a render. Follow the latest game and playback flag.
    let pending: number | null = null
    let pendingAt = 0
    let last: number | null = null
    void mic.start({
      onReady() {},
      onLost: clear,
      onFrame(_time, pitch) {
        if (!pitch) return
        const note = pitch.midi === null || sounding.current.size > 0 || clock() < micSilentUntil.current ? null : Math.round(pitch.midi)
        if (note !== pending) {
          pending = note
          pendingAt = pitch.time
          return
        }
        if (last === note || pitch.time - pendingAt < 0.08) return
        if (last !== null) presses.current.delete(`mic:${last}`)
        last = note
        if (note !== null) {
          presses.current.set(`mic:${note}`, note)
          if (running.current) game.current?.press(note, clock())
        }
        updateHeld()
      },
    })
  }

  useEffect(() => {
    if (!playing) return
    const round = game.current
    if (!round) return
    let frame = 0
    let lastPaint = 0

    function tick() {
      if (!round || !running.current) return
      const now = clock()
      round.advance(now)
      const snapshot = round.snapshot()
      if (now - lastPaint >= 0.055 || snapshot.finished) {
        lastPaint = now
        setView(snapshot)
      }
      if (snapshot.finished) {
        running.current = false
        onActiveChange(false)
        setScore(round.accuracy())
        setState('complete')
        save({
          activity: 'piano', label: lesson?.hands ? `${song.title} · ${handLabels[hand]}` : song.title,
          exerciseId: lesson?.id, duration: elapsed.current + now - started.current, accuracy: round.accuracy(),
        })
      } else {
        frame = requestAnimationFrame(tick)
      }
    }

    function pauseOnHide() {
      if (!document.hidden || !running.current) return
      running.current = false
      elapsed.current += clock() - started.current
      for (const key of sounding.current.values()) key.release?.()
      sounding.current.clear()
      presses.current.clear()
      setHeld(new Set())
      onActiveChange(false)
      setState('paused')
    }
    frame = requestAnimationFrame(tick)
    document.addEventListener('visibilitychange', pauseOnHide)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('visibilitychange', pauseOnHide)
    }
  }, [playing, onActiveChange, save, song, lesson, hand])

  useEffect(() => () => {
    importId.current += 1
    sounding.current.clear()
    onActiveChange(false)
  }, [onActiveChange])

  const cursor = view?.cursor ?? 0
  const target = view?.target ?? []
  const followingCue = playing ? song.cues[cursor] : undefined
  useEffect(() => {
    const element = scroller.current
    if (!followingCue || !element || !element.scrollWidth) return
    const centers = layout.keys.filter(key => followingCue.notes.some(note => note.midi === key.midi)).map(key => key.center)
    if (!centers.length) return
    const unit = element.scrollWidth / layout.whites
    const left = Math.min(...centers) * unit
    const right = Math.max(...centers) * unit
    if (left < element.scrollLeft + unit / 2 || right > element.scrollLeft + element.clientWidth - unit / 2) {
      element.scrollLeft = (left + right - element.clientWidth) / 2
    }
  }, [followingCue, layout])

  function begin() {
    void sound.ready()
    if (state !== 'paused') {
      game.current = createPianoRound(song, wait)
      elapsed.current = 0
      setView(game.current.snapshot())
      setScore(null)
    }
    started.current = clock()
    game.current?.restartClock(started.current)
    running.current = true
    setState('playing')
    onActiveChange(true)
  }

  function pause() {
    running.current = false
    const now = clock()
    elapsed.current += now - started.current
    // Freeze at the chart time of the last frame to retain any current cue.
    setState('paused')
    onActiveChange(false)
  }

  function reset() {
    running.current = false
    game.current = null
    setView(null)
    setScore(null)
    setState('idle')
    onActiveChange(false)
  }

  async function load(file: File) {
    const token = ++importId.current
    reset()
    setError('')
    setLoading(true)
    try {
      const next = await readMidi(file)
      if (token !== importId.current) return
      setImported(next)
      setSelection('file')
      setHand('both')
      if (scroller.current) scroller.current.scrollLeft = 0
    } catch (cause) {
      if (token === importId.current) {
        setError(cause instanceof Error && /[ก-๙]/.test(cause.message) ? cause.message : 'เปิดไฟล์ MIDI ไม่ได้ ตรวจสอบว่าไฟล์เป็น .mid ที่สมบูรณ์')
      }
    } finally {
      if (token === importId.current) setLoading(false)
    }
  }

  const inRound = playing || state === 'paused'
  const lessons = pianoCurriculum.filter(entry => entry.group === group)

  function select(id: string) {
    reset()
    setSelection(id)
    setHand('both')
    if (scroller.current) scroller.current.scrollLeft = 0
    setError('')
  }

  return (
    <section className="panel instrument-panel" aria-labelledby="piano-title">
      <header className="panel-header">
        <span className="tool-icon purple"><FileMusic size={22} /></span>
        <div><h2 id="piano-title">เปียโนและโน้ตไหล</h2><p>เล่นบนลิ่มนิ้ว ใช้ไมโครโฟน หรือเชื่อมต่อคีย์บอร์ด MIDI</p></div>
      </header>
      <div className="instrument-toolbar mastery-groups" role="group" aria-label="หมวดคลังเปียโน">
        {Object.entries(pianoGroups).map(([id, label]) => (
          <button key={id} className="subtle-button" aria-pressed={group === id && !!lesson} disabled={inRound || loading}
            onClick={() => {
              const first = pianoCurriculum.find(entry => entry.group === id)
              if (!first || (group === id && lesson)) return
              setGroup(first.group)
              select(first.id)
            }}>{label}</button>
        ))}
      </div>
      <div className="instrument-toolbar">
        <MasterySelect label="เพลงหรือแบบฝึกหัด" value={selection} disabled={inRound || loading} onChange={select}>
          {lessons.map(entry => <option value={entry.id} key={entry.id}>{entry.title}</option>)}
          {imported && <option value="file">{imported.title}</option>}
        </MasterySelect>
        <label className="subtle-button instrument-file">
          <FileMusic size={17} />{loading ? 'กำลังอ่าน MIDI…' : 'นำเข้า MIDI'}
          <input type="file" accept=".mid,.midi,audio/midi,audio/x-midi" disabled={inRound || loading} onChange={event => {
            const file = event.currentTarget.files?.[0]
            event.currentTarget.value = ''
            if (file) void load(file)
          }} />
        </label>
        <label className="instrument-toggle"><input type="checkbox" checked={wait} disabled={inRound}
          onChange={event => { reset(); setWait(event.currentTarget.checked) }} />โหมดรอโน้ต (Wait Mode)</label>
      </div>
      {lesson?.hands && <div className="instrument-toolbar" role="group" aria-label="เลือกมือที่จะซ้อม">
        {(Object.keys(handLabels) as (keyof typeof handLabels)[]).map(value => (
          <button className="subtle-button" key={value} disabled={inRound} aria-pressed={hand === value} onClick={() => {
            if (value === hand) return
            reset()
            setHand(value)
            if (scroller.current) scroller.current.scrollLeft = 0
          }}>{handLabels[value]}</button>
        ))}
      </div>}
      <p className="instrument-hint">{song.credit} · {song.total} โน้ต{lesson && ` · ระดับ${difficultyNames[lesson.difficulty]} · ${lesson.bpm} BPM`}</p>
      {lesson?.hands && hand === 'both' && <p className="instrument-hint mastery-hand-key"><i />มือซ้าย <i />มือขวา</p>}
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="instrument-toolbar instrument-inputs">
        <button className="subtle-button" onClick={micToggle}>
          <Mic size={17} />{mic.state === 'listening' ? 'ปิดไมโครโฟน' : mic.state === 'activation' ? 'เริ่มฟังเสียง' :
            mic.state === 'requesting' ? 'ยกเลิกขอใช้ไมค์' : 'เปิดไมโครโฟน'}
        </button>
        {mic.state === 'activation' && <button className="subtle-button" onClick={mic.stop}>ยกเลิก</button>}
        <MidiControl midi={midiInput} />
      </div>
      {mic.state === 'listening' && <p className="instrument-hint">ไมค์รับทีละโน้ต สำหรับคอร์ดในโหมดรอให้เล่นแยกทีละเสียง</p>}
      {(mic.error || midiInput.error || sound.error) && <p className="field-error" role="alert">{mic.error || midiInput.error || sound.error}</p>}
      <PianoLoadStatus notes={[...held, ...song.cues.slice(0, 8).flatMap(cue => cue.notes.map(note => note.midi))]} />
      <div className="instrument-piano" ref={scroller} tabIndex={0} aria-label="เปียโน เลื่อนซ้ายขวาเพื่อเปลี่ยนช่วงลิ่มนิ้ว">
        <div className="instrument-lanes" style={{ '--white-count': layout.whites } as CSSProperties}>
          <PianoRoll song={song} layout={layout} game={game} moving={playing} />
          <PianoKeyboard layout={layout} held={held} targets={target.map(note => note.midi)} onKey={keyEvent} />
        </div>
      </div>
      <div className="instrument-toolbar instrument-playbar">
        <button className="primary-button" disabled={loading} onClick={playing ? pause : begin}>
          {playing ? <Pause size={18} /> : <Play size={18} />}
          {playing ? 'พักเพลง' : state === 'paused' ? 'เล่นต่อ' : 'เริ่มฝึกตามโน้ต'}
        </button>
        {inRound && <button className="subtle-button" onClick={reset}><Square size={16} />จบรอบ</button>}
        <div className="instrument-note-status">
          <strong>{view?.count ?? 0}/{song.total} โน้ต</strong>
          {playing && view?.waiting && <span>รอโน้ต {target.map(note => noteLabel(note.midi)).join(' · ')}</span>}
          {inRound && <span>กดผิด {view?.wrong ?? 0} ครั้ง</span>}
        </div>
      </div>
      {score !== null && <div className="instrument-result mastery-result" role="status">
        <span>ความแม่นยำ <strong>{score}%</strong> · ถูก {view?.count}/{song.total} โน้ต · กดผิด {view?.wrong ?? 0} ครั้ง</span>
        {lesson && <MasteryStars stars={gradeStars(score, 100, lesson.maxStars)} max={lesson.maxStars} />}
      </div>}
    </section>
  )
}
