import { useRef, useState } from 'react'
import { RotateCcw, Volume2 } from 'lucide-react'
import PianoLoadStatus from '../../audio/PianoLoadStatus'
import { noteLabel } from '../../audio/pitch'
import type { ExerciseDifficulty } from '../exerciseMetadata'
import type { EarStatsData } from '../stats'
import { chordVoicing, progressionQuestion } from './progressions'
import type { Progression } from './progressions'
import { ListenButton, RoundGrade, TrainingDifficulty } from './TrainingControls'
import { usePhrase } from './usePhrase'

type Question = ReturnType<typeof progressionQuestion> & { bpm?: number; keyName?: string; beatsPerBar?: number; home?: Progression['chords'][number] }

export default function ProgressionTrainer({ stats, preset, nextPreset }: {
  stats: EarStatsData; preset?: Question; nextPreset?: (previous: Question) => Question
}) {
  const [difficulty, setDifficulty] = useState<ExerciseDifficulty>('beginner')
  const [round, setRound] = useState<Question>(() => preset ?? progressionQuestion('beginner'))
  const [heard, setHeard] = useState(false)
  const [answer, setAnswer] = useState<Progression | null>(null)
  const answered = useRef(false)
  const audio = usePhrase()
  const tonic = chordVoicing(round.tonic, round.home ?? 'I')
  const chords = round.correct.chords.map(roman => ({ roman, ...chordVoicing(round.tonic, roman) }))
  const beat = round.bpm ? 60 / round.bpm : 0.76
  const start = round.beatsPerBar ? beat * round.beatsPerBar : 1.08
  const sound = { cues: [
    { notes: tonic.notes, at: 0, duration: beat * .7 },
    ...chords.map((chord, index) => ({
      notes: chord.notes, at: start + index * beat, duration: beat * (round.beatsPerBar && index % round.beatsPerBar === 0 ? .87 : .72),
    })),
  ] }

  function reset(next: ExerciseDifficulty) {
    audio.stop()
    setDifficulty(next)
    setRound(nextPreset?.(round) ?? preset ?? progressionQuestion(next, round.correct, round.tonic))
    setHeard(false)
    answered.current = false
    setAnswer(null)
  }

  function guess(option: Progression) {
    if (!heard || audio.playing === 'phrase' || answered.current) return
    answered.current = true
    setAnswer(option)
    stats.recordExercise(round.correct, Number(option === round.correct), 1)
  }

  return (
    <div className="advanced-body">
      <div className="advanced-heading"><div>
        <h2>ทายทางเดินคอร์ด</h2>
        <p>ฟังคอร์ดโทนิกหนึ่งครั้ง แล้วทายทางเดินคอร์ดที่ได้ยินต่อจากนั้น</p>
      </div>{!preset && <TrainingDifficulty value={difficulty} change={next => { if (next !== difficulty) reset(next) }} />}</div>
      <PianoLoadStatus notes={sound.cues.flatMap(cue => cue.notes)} />
      <div className="advanced-transport">
        <ListenButton playing={audio.playing === 'phrase'} heard={heard} listen={() => audio.listen(sound, () => setHeard(true))} stop={audio.stop} />
        <span>คีย์ {round.keyName ?? `${noteLabel(round.tonic).replace(/\d+$/, '')} เมเจอร์`}</span>
      </div>
      {audio.error && <p className="field-error" role="alert">{audio.error}</p>}
      <fieldset className="ear-answer-set">
        <legend>{heard ? 'เลือกทางเดินคอร์ด' : 'ฟังทางเดินคอร์ดให้จบก่อนตอบ'}</legend>
        <div className="ear-answers progression-options">
          {round.options.map(option => (
            <button key={option.id} type="button" disabled={!heard || audio.playing === 'phrase' || answer !== null}
              className={`ear-choice${answer && option === round.correct ? ' correct' : answer === option ? ' incorrect' : ''}`}
              onClick={() => guess(option)}>
              <strong>{option.label}</strong>
            </button>
          ))}
        </div>
      </fieldset>
      {answer && <>
        <RoundGrade exercise={round.correct} correct={Number(answer === round.correct)} attempts={1}>
          <button type="button" className="subtle-button" onClick={() => reset(difficulty)}><RotateCcw size={16} />{preset && !nextPreset ? 'เล่นข้อนี้อีกครั้ง' : 'ข้อต่อไป'}</button>
        </RoundGrade>
        <div className="advanced-explainer">
          <h3>{answer === round.correct ? 'ถูกต้อง' : 'เฉลย'} · {round.correct.label}</h3>
          <p>{round.correct.hint}</p>
          <p>นิยมใช้ใน {round.correct.genre}</p>
          <div className="advanced-chords" role="group" aria-label="ฟังคอร์ดแต่ละตัวในเฉลย">
            {chords.map(({ roman, name, notes }, index) =>
              <button key={index} type="button" className="subtle-button" onClick={() =>
                audio.listen({ cues: [{ notes, at: 0, duration: 0.79 }] }, undefined, 'note')}>
                <Volume2 size={16} />{roman} · {name}
              </button>)}
          </div>
        </div>
      </>}
    </div>
  )
}
