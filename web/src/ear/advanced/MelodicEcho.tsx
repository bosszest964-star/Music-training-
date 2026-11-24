import { useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Check, RotateCcw, X } from 'lucide-react'
import { noteLabel } from '../../audio/pitch'
import PianoLoadStatus from '../../audio/PianoLoadStatus'
import { pianoKeys } from '../../instrument/pianoGame'
import type { ExerciseDifficulty } from '../exerciseMetadata'
import type { EarStatsData } from '../stats'
import { melodyQuestion } from './melodies'
import { ListenButton, RoundGrade, TrainingDifficulty } from './TrainingControls'
import { usePhrase } from './usePhrase'

const layout = pianoKeys(60, 83)
const octaves = [layout.keys.slice(0, 12), layout.keys.slice(12, 24)]

export default function MelodicEcho({ stats, preset }: { stats: EarStatsData; preset?: ReturnType<typeof melodyQuestion> }) {
  const [difficulty, setDifficulty] = useState<ExerciseDifficulty>('beginner')
  const [round, setRound] = useState(() => preset ?? melodyQuestion('beginner'))
  const [heard, setHeard] = useState(false)
  const [answers, setAnswers] = useState<number[]>([])
  const current = useRef<number[]>([])
  const audio = usePhrase()
  const finished = answers.length === round.notes.length

  function reset(next: ExerciseDifficulty) {
    audio.stop()
    setDifficulty(next)
    setRound(preset ?? melodyQuestion(next, round.exercise))
    setHeard(false)
    current.current = []
    setAnswers([])
  }

  function correctCount(values: number[]) {
    return values.filter((midi, index) => midi === round.notes[index]).length
  }

  function press(midi: number) {
    if (!heard || audio.playing === 'phrase' || current.current.length >= round.notes.length) return
    const next = [...current.current, midi]
    current.current = next
    setAnswers(next)
    audio.listen({ cues: [{ notes: [midi], at: 0, duration: 0.18 }] }, undefined, 'note')
    if (next.length === round.notes.length) stats.recordExercise(round.exercise, correctCount(next), round.notes.length)
  }

  return (
    <div className="advanced-body">
      <div className="advanced-heading"><div>
        <h2>ฟังทำนองแล้วเล่นตาม</h2>
        <p>เริ่มที่โน้ตที่บอกไว้ แล้วเล่นตามลำดับที่ได้ยิน</p>
      </div>{!preset && <TrainingDifficulty value={difficulty} change={next => { if (next !== difficulty) reset(next) }} />}</div>
      <PianoLoadStatus notes={layout.keys.map(key => key.midi)} />
      <div className="advanced-transport">
        <ListenButton playing={audio.playing === 'phrase'} heard={heard} listen={() => audio.listen(round.sound, () => setHeard(true))}
          stop={audio.stop} before="ฟังทำนอง" />
        <span>โน้ตแรก <strong>{noteLabel(round.notes[0])}</strong> · {round.notes.length} โน้ต</span>
      </div>
      {audio.error && <p className="field-error" role="alert">{audio.error}</p>}
      <ol className="echo-steps" aria-label="ผลทีละโน้ต">
        {round.notes.map((note, index) => {
          const played = answers[index]
          const result = played === undefined ? 'pending' : played === note ? 'correct' : 'incorrect'
          return <li key={index} aria-current={!finished && index === answers.length ? 'step' : undefined} data-result={result}
            aria-label={played === undefined ? `โน้ตที่ ${index + 1} ยังไม่ได้เล่น` :
              `โน้ตที่ ${index + 1} ${noteLabel(played)} ${result === 'correct' ? 'ถูก' : `ผิด โน้ตที่ถูกคือ ${noteLabel(note)}`}`}>
            {result === 'correct' ? <Check size={15} /> : result === 'incorrect' ? <X size={15} /> : null}
            {played === undefined ? (index === 0 ? noteLabel(note) : '—') : noteLabel(played)}
            {result === 'incorrect' && <small>เฉลย {noteLabel(note)}</small>}
          </li>
        })}
      </ol>
      <div className="echo-keyboard" role="group" aria-label="ลิ่มเปียโน C4 ถึง B5">
        {octaves.map((keys, octave) => (
          <div key={octave} className="instrument-keys echo-octave" style={{ '--white-count': 7 } as CSSProperties}>
            {keys.map(key => (
              <button key={key.midi} type="button" className={`instrument-key ${key.black ? 'black' : 'white'}`}
                style={{ '--center': key.center - 7 * octave } as CSSProperties}
                disabled={!heard || finished || audio.playing === 'phrase'} aria-label={noteLabel(key.midi)}
                data-target={!answers.length && key.midi === round.notes[0] || undefined}
                onPointerDown={event => { if (event.button === 0) press(key.midi) }}
                onClick={event => { if (event.detail === 0) press(key.midi) }}>
                {noteLabel(key.midi)}
              </button>
            ))}
          </div>
        ))}
      </div>
      {finished && <RoundGrade exercise={round.exercise} correct={correctCount(answers)} attempts={round.notes.length}>
        <button type="button" className="subtle-button" onClick={() => reset(difficulty)}><RotateCcw size={16} />{preset ? 'เล่นทำนองนี้อีกครั้ง' : 'ทำนองถัดไป'}</button>
      </RoundGrade>}
    </div>
  )
}
