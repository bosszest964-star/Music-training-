import { useEffect, useMemo, useRef, useState } from 'react'
import { Guitar, Play, Square } from 'lucide-react'
import type { CSSProperties } from 'react'
import { noteLabel } from '../../audio/pitch'
import type { SaveRound } from '../stats'
import { useStudioSound } from '../useStudioSound'
import { fretExercise, fretInstruments, fretPositions, fretQuestion, fretRegions, pitchNames, scales } from './fretboard'
import type { FretInstrument, FretPosition } from './fretboard'
import { MasterySelect } from './MasteryControls'
import { QuizFeedback, QuizResult } from './QuizStatus'
import { challengeSeconds, useNoteQuiz } from './useNoteQuiz'

const modes = { explore: 'ดูโน้ตและสเกล', find: 'แตะหาโน้ต', name: 'ทายชื่อโน้ต' } as const

export default function FretboardTrainer({ save, onActiveChange }: { save: SaveRound; onActiveChange: (active: boolean) => void }) {
  const [instrument, setInstrument] = useState<FretInstrument>('guitar')
  const [mode, setMode] = useState<keyof typeof modes>('explore')
  const [region, setRegion] = useState<keyof typeof fretRegions>('first')
  const [scale, setScale] = useState<keyof typeof scales>('chromatic')
  const [root, setRoot] = useState(0)
  const [played, setPlayed] = useState<FretPosition | null>(null)
  const { sound, error } = useStudioSound()
  const rows = useMemo(() => fretPositions(instrument, region), [instrument, region])
  const { label, voice, strings } = fretInstruments[instrument]
  const exercise = fretExercise(instrument, mode === 'name' ? 'name' : 'find', region)
  const quiz = useNoteQuiz<FretPosition>({
    next: previous => fretQuestion(rows, mode === 'name' ? 'name' : 'find', previous),
    timed: true, maxStars: exercise.maxStars, onActiveChange,
    onFinish: result => save({ activity: 'fretboard', label: `${modes[mode]} · ${label}`,
      accuracy: result.accuracy, duration: result.duration, stars: result.stars, exerciseId: exercise.id }),
  })
  const question = quiz.question
  const neck = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const viewport = neck.current
    const marked = viewport?.querySelector<HTMLElement>('[data-marked]')
    if (!viewport || !marked) return
    const bounds = viewport.getBoundingClientRect()
    const target = marked.getBoundingClientRect()
    if (target.left < bounds.left || target.right > bounds.right) {
      viewport.scrollLeft += (target.left + target.right - bounds.left - bounds.right) / 2
    }
  }, [question, mode])

  function play(position: FretPosition) {
    setPlayed(position)
    void sound([position.midi], voice, instrument === 'bass' ? .48 : .36)
  }

  function choose(position: FretPosition) {
    if (mode === 'explore' || mode === 'name') {
      play(position)
      return
    }
    if (!question || quiz.feedback) return
    play(position)
    const correct = position.string === question.string && position.midi % 12 === question.midi % 12
    const frets = rows[question.string - 1].filter(cell => cell.midi % 12 === question.midi % 12)
      .map(cell => cell.fret === 0 ? 'สายเปิด' : `เฟร็ต ${cell.fret}`)
    quiz.submit(correct, `สาย ${question.string} · ${frets.join(' หรือ ')}`)
  }

  const showAll = mode === 'explore' && scale === 'chromatic'

  return (
    <section className="panel instrument-panel" aria-labelledby="fretboard-title">
      <header className="panel-header">
        <span className="tool-icon purple"><Guitar size={22} /></span>
        <div><h2 id="fretboard-title">จำโน้ตบนคอเครื่องดนตรี</h2><p>สำรวจตำแหน่งโน้ต หรือเล่นโจทย์แข่งกับเวลา</p></div>
      </header>
      <div className="instrument-toolbar" role="group" aria-label="โหมดฝึกบนคอ">
        {Object.entries(modes).map(([id, title]) => <button key={id} className="subtle-button" aria-pressed={mode === id}
          disabled={quiz.active} onClick={() => {
            if (mode === id) return
            setMode(id as keyof typeof modes)
            setPlayed(null)
            quiz.reset()
          }}>{title}</button>)}
      </div>
      <div className="instrument-toolbar">
        <MasterySelect label="เครื่องดนตรี" value={instrument} disabled={quiz.active} onChange={next => {
          setInstrument(next as FretInstrument)
          setPlayed(null)
          quiz.reset()
        }}>
          {Object.entries(fretInstruments).map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}
        </MasterySelect>
        <MasterySelect label="ช่วงเฟร็ต" value={region} disabled={quiz.active} onChange={next => {
          setRegion(next as keyof typeof fretRegions)
          setPlayed(null)
          quiz.reset()
        }}>
          {Object.entries(fretRegions).map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}
        </MasterySelect>
        {mode === 'explore' && <>
          <MasterySelect label="สเกล" value={scale} onChange={next => setScale(next as keyof typeof scales)}>
            {Object.entries(scales).map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}
          </MasterySelect>
          {scale !== 'chromatic' && <MasterySelect label="โน้ตหลัก" value={root} onChange={next => setRoot(Number(next))}>
            {pitchNames.map((name, index) => <option key={name} value={index}>{name}</option>)}
          </MasterySelect>}
        </>}
      </div>
      <div className="mastery-quiz-banner">
        <strong>{mode === 'explore' ? played ? `${noteLabel(played.midi)} · สาย ${played.string}` : 'แตะช่องเฟร็ตเพื่อฟังเสียง'
          : question ? mode === 'name' ? `ชื่อโน้ตที่สาย ${question.string} · เฟร็ต ${question.fret} คืออะไร?`
            : `หา ${pitchNames[question.midi % 12]} บนสาย ${question.string} (${noteLabel(strings[strings.length - question.string])})`
            : `ตอบให้ได้มากที่สุดใน ${challengeSeconds} วินาที`}</strong>
        {quiz.active && <span>{quiz.remaining} วินาที · ถูก {quiz.tally.correct}/{quiz.tally.attempts}</span>}
      </div>
      <div ref={neck} className="mastery-neck-scroller" tabIndex={0} aria-label="แผนผังคอเครื่องดนตรี เลื่อนซ้ายขวาเพื่อดูเฟร็ต">
        <div className="mastery-neck" style={{ '--frets': rows[0].length } as CSSProperties}>
          <div className="mastery-neck-row mastery-neck-numbers">
            <span>สาย</span>{rows[0].map(({ fret }) => <span key={fret} data-dot={[3, 5, 7, 9, 12].includes(fret) || undefined}>{fret}</span>)}
          </div>
          {rows.map((row, index) => (
            <div className="mastery-neck-row" key={index} data-target-string={mode === 'find' && question?.string === index + 1 || undefined}>
              <span className="mastery-string-tuning">{index + 1} · {noteLabel(strings[strings.length - 1 - index])}</span>
              {row.map(position => {
                const { string, fret, midi } = position
                const pitch = midi % 12
                const inScale = mode === 'explore' && (scales[scale].intervals as readonly number[]).includes((pitch - root + 12) % 12)
                const marked = mode === 'name' && !!question && question.string === string && question.fret === fret
                const answer = mode === 'find' && !!quiz.feedback && question?.string === string && question.midi % 12 === pitch
                const isPlayed = played?.string === string && played.fret === fret && (mode === 'explore' || !!quiz.feedback)
                return <button key={fret} className="mastery-fret" disabled={mode === 'name' ? !marked : mode === 'find' && (!quiz.active || !!quiz.feedback)}
                  aria-label={`สาย ${string} เฟร็ต ${fret}${mode === 'explore' ? ` ${noteLabel(midi)}` : ''}`}
                  data-open={fret === 0 || undefined} data-scale={inScale || undefined}
                  data-root={inScale && !showAll && pitch === root || undefined} data-marked={marked || undefined}
                  data-answer={answer || undefined} data-played={isPlayed || undefined} onClick={() => choose(position)}>
                  <span>{answer || inScale ? pitchNames[pitch] : marked ? '?' : '·'}</span>
                </button>
              })}
            </div>
          ))}
        </div>
      </div>
      {mode === 'name' && question && (
        <div className="mastery-note-options" aria-label="เลือกชื่อโน้ต">
          {pitchNames.map((name, index) => <button key={name} className="subtle-button" disabled={!!quiz.feedback}
            onClick={() => {
              play(question)
              quiz.submit(question.midi % 12 === index, pitchNames[question.midi % 12])
            }}>{name}</button>)}
        </div>
      )}
      {mode !== 'explore' && <div className="instrument-toolbar">
        <button className="primary-button" onClick={() => {
          setPlayed(null)
          if (quiz.active) quiz.finish()
          else quiz.start()
        }}>{quiz.active ? <Square size={17} /> : <Play size={17} />}{quiz.active ? 'จบรอบ' : 'เริ่มจับเวลา'}</button>
      </div>}
      <QuizFeedback feedback={quiz.feedback} />
      <QuizResult result={quiz.score} maxStars={exercise.maxStars} />
      {error && <p className="field-error" role="alert">{error}</p>}
    </section>
  )
}
