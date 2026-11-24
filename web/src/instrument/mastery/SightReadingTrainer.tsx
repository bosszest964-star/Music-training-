import { useMemo, useState } from 'react'
import { Music2, Play, Square } from 'lucide-react'
import type { CSSProperties } from 'react'
import PianoLoadStatus from '../../audio/PianoLoadStatus'
import { noteLabel } from '../../audio/pitch'
import { difficultyNames } from '../../exerciseMetadata'
import type { ExerciseDifficulty } from '../../exerciseMetadata'
import { pianoKeys } from '../pianoGame'
import PianoKeyboard from '../PianoKeyboard'
import type { SaveRound } from '../stats'
import { useMidiInput } from '../useMidiInput'
import { useStudioSound } from '../useStudioSound'
import { MasterySelect, MidiControl } from './MasteryControls'
import MusicStaff from './MusicStaff'
import { QuizFeedback, QuizResult } from './QuizStatus'
import { clefs, noteName, readingChoices, readingExercise, readingLevels, readingQuestion, staffNote } from './sightReading'
import type { Clef, StaffNote } from './sightReading'
import { challengeSeconds, useNoteQuiz } from './useNoteQuiz'

export default function SightReadingTrainer({ save, onActiveChange, preset }: {
  save: SaveRound; onActiveChange: (active: boolean) => void
  preset?: { clef: Clef; difficulty: ExerciseDifficulty; notes?: readonly StaffNote[]; meter?: string }
}) {
  const [clef, setClef] = useState<Clef>(preset?.clef ?? 'treble')
  const [level, setLevel] = useState<ExerciseDifficulty>(preset?.difficulty ?? 'beginner')
  const [timed, setTimed] = useState(!preset?.notes)
  const [input, setInput] = useState<'name' | 'keys'>('name')
  const [thai, setThai] = useState(false)
  const { piano, ready, error } = useStudioSound()
  const exercise = readingExercise(clef, level)
  const quiz = useNoteQuiz<StaffNote>({
    next: previous => {
      const notes = preset?.notes
      return notes?.length ? notes[(previous ? notes.indexOf(previous) + 1 : 0) % notes.length]
        : readingQuestion(clef, level, previous)
    }, timed, maxStars: exercise.maxStars, onActiveChange, questionLimit: preset?.notes?.length,
    onFinish: result => save({ activity: 'reading', label: `${clefs[clef]} · ${preset?.notes ? 'โจทย์สร้างใหม่' : timed ? 'จับเวลา' : 'ฝึกอิสระ'}`,
      accuracy: result.accuracy, attempts: result.attempts, duration: result.duration, stars: result.stars, exerciseId: exercise.id }),
  })
  const { question } = quiz
  const choicesLevel = preset?.notes?.some(note => note.accidental !== 0) ? 'advanced' : level
  const staff = question?.clef ?? (clef === 'bass' ? 'bass' : 'treble')
  const { low, high } = readingLevels[level]
  const layout = useMemo(() => pianoKeys(staffNote(staff, low).midi - 1, staffNote(staff, high).midi + 1), [staff, low, high])
  const answer = question ? noteName(question.letter, question.accidental, thai) : ''

  function keyEvent(_id: string, midi: number, down: boolean, velocity = 0.76) {
    if (!down) return
    void piano(midi, velocity, 0.25)
    if (question && !quiz.feedback) quiz.submit(midi === question.midi, `${answer} · ${question.octave}`)
  }

  const midi = useMidiInput({ note: keyEvent, clear() {} })

  return (
    <section className="panel instrument-panel" aria-labelledby="sight-title">
      <header className="panel-header">
        <span className="tool-icon purple"><Music2 size={22} /></span>
        <div><h2 id="sight-title">ฝึกอ่านโน้ตบรรทัดห้าเส้น</h2><p>เลือกชื่อโน้ต หรือเล่นระดับเสียงที่เห็นด้วยเปียโนหรือ MIDI</p></div>
      </header>
      {!preset && <div className="instrument-toolbar">
        <MasterySelect label="บรรทัดและกุญแจ" value={clef} disabled={quiz.active} onChange={next => {
          setClef(next as Clef)
          quiz.reset()
        }}>
          {Object.entries(clefs).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </MasterySelect>
        <MasterySelect label="ระดับ" value={level} disabled={quiz.active} onChange={next => {
          setLevel(next as ExerciseDifficulty)
          quiz.reset()
        }}>
          {(Object.keys(readingLevels) as ExerciseDifficulty[]).map(id =>
            <option key={id} value={id}>{difficultyNames[id]} · {readingLevels[id].label}</option>)}
        </MasterySelect>
        <label className="instrument-toggle"><input type="checkbox" checked={timed} disabled={quiz.active} onChange={event => {
          setTimed(event.currentTarget.checked)
          quiz.reset()
        }} />ท้าทาย {challengeSeconds} วินาที</label>
      </div>}
      <div className="instrument-toolbar">
        <div className="instrument-toolbar" role="group" aria-label="วิธีตอบโน้ต">
          <button className="subtle-button" aria-pressed={input === 'name'} onClick={() => setInput('name')}>ชื่อโน้ต</button>
          <button className="subtle-button" aria-pressed={input === 'keys'} onClick={() => setInput('keys')}>ลิ่มเปียโน</button>
        </div>
        <MidiControl midi={midi} />
      </div>
      <div className="mastery-quiz-banner">
        <strong>{quiz.active ? (input === 'keys' ? `เล่นโน้ตให้ตรงอ็อกเทฟบน${clefs[staff]}` : 'โน้ตบนบรรทัดชื่ออะไร?')
          : timed ? `ตอบให้ได้มากที่สุดใน ${challengeSeconds} วินาที` : 'ฝึกอิสระ · จบรอบเมื่อต้องการ'}</strong>
        {quiz.active && <span>{timed && `${quiz.remaining} วินาที · `}ถูก {quiz.tally.correct}/{quiz.tally.attempts}{preset?.notes && ' · ' + preset.notes.length + ' โน้ต'}</span>}
      </div>
      <MusicStaff clef={clef} note={question} meter={preset?.meter} />
      {input === 'name' ? (
        <>
          <div className="instrument-toolbar" role="group" aria-label="ภาษาแสดงชื่อโน้ต">
            <button className="subtle-button" aria-pressed={!thai} onClick={() => setThai(false)}>C–D–E</button>
            <button className="subtle-button" aria-pressed={thai} onClick={() => setThai(true)}>โด–เร–มี</button>
          </div>
          <div className="mastery-note-options" aria-label="คำตอบ">
            {readingChoices(choicesLevel).map(({ letter, accidental }) => (
              <button key={`${letter}:${accidental}`} className="subtle-button" disabled={!question || !!quiz.feedback}
                onClick={() => {
                  if (!question) return
                  const correct = letter === question.letter && accidental === question.accidental
                  void piano(staffNote(question.clef, question.position + letter - question.letter, accidental).midi, .68, .25)
                  quiz.submit(correct, answer)
                }}>{noteName(letter, accidental, thai)}</button>
            ))}
          </div>
        </>
      ) : (
        <>
          <PianoLoadStatus notes={layout.keys.map(key => key.midi)} />
          <div key={staff} className="instrument-piano mastery-reading-keys" tabIndex={0}
            aria-label="ลิ่มเปียโน เลื่อนซ้ายขวาเพื่อเปลี่ยนช่วงโน้ต">
            <div className="instrument-lanes" style={{ '--white-count': layout.whites } as CSSProperties}>
              <PianoKeyboard layout={layout} onKey={keyEvent} />
            </div>
          </div>
          {quiz.feedback && question && <p className="instrument-hint">ลิ่มที่ตรงกับโน้ตคือ {noteLabel(question.midi)}</p>}
        </>
      )}
      <div className="instrument-toolbar">
        <button className="primary-button" onClick={() => {
          if (quiz.active) quiz.finish()
          else {
            void ready()
            quiz.start()
          }
        }}>
          {quiz.active ? <Square size={17} /> : <Play size={17} />}
          {quiz.active ? 'จบรอบ' : timed ? 'เริ่มจับเวลา' : 'เริ่มฝึกอ่านโน้ต'}
        </button>
      </div>
      <QuizFeedback feedback={quiz.feedback} />
      <QuizResult result={quiz.score} maxStars={exercise.maxStars} />
      {(midi.error || error) && <p className="field-error" role="alert">{midi.error || error}</p>}
    </section>
  )
}
