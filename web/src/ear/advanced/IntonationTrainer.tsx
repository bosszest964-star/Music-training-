import { useRef, useState } from 'react'
import { ChevronDown, RotateCcw } from 'lucide-react'
import PianoLoadStatus from '../../audio/PianoLoadStatus'
import { difficultyNames } from '../exerciseMetadata'
import type { EarStatsData } from '../stats'
import { intonationQuestion, intonationStages, pitchChoices } from './intonation'
import type { IntonationStage, PitchChoice } from './intonation'
import { ListenButton, RoundGrade } from './TrainingControls'
import { usePhrase } from './usePhrase'

export default function IntonationTrainer({ stats, preset }: { stats: EarStatsData; preset?: IntonationStage }) {
  const [stage, setStage] = useState(preset ?? intonationStages[0])
  const [round, setRound] = useState(() => intonationQuestion(preset ?? intonationStages[0]))
  const [heard, setHeard] = useState(false)
  const [answer, setAnswer] = useState<PitchChoice | null>(null)
  const answered = useRef(false)
  const audio = usePhrase()

  function reset(next: IntonationStage) {
    audio.stop()
    setStage(next)
    setRound(intonationQuestion(next, round.midi))
    answered.current = false
    setAnswer(null)
    setHeard(false)
  }

  function guess(choice: PitchChoice) {
    if (!heard || answered.current || audio.playing === 'phrase') return
    answered.current = true
    setAnswer(choice)
    stats.recordExercise(stage, Number(choice === round.answer), 1)
  }

  return (
    <div className="advanced-body">
      <div className="advanced-heading"><div><h2>จับเสียงเพี้ยน</h2>
        <p>ฟังสองเสียงเทียบกัน แล้วบอกว่าเสียงที่สองสูงขึ้น ต่ำลง หรือตรงกับเสียงแรก</p></div>
        {!preset && <label className="eq-source"><span>ระดับความต่าง</span><span className="eq-select">
          <select value={stage.id} onChange={event => {
            const next = intonationStages.find(item => item.id === event.target.value)
            if (next) reset(next)
          }}>
            {intonationStages.map(item => <option value={item.id} key={item.id}>
              {difficultyNames[item.difficulty]} · {item.cents} cents
            </option>)}
          </select><ChevronDown size={16} /></span>
        </label>}
      </div>
      <PianoLoadStatus notes={[round.midi]} />
      <div className="advanced-transport">
        <ListenButton playing={audio.playing === 'phrase'} heard={heard} listen={() => audio.listen(round.sound, () => setHeard(true))}
          stop={audio.stop} before="ฟังเสียงสองตัว" />
        <span>ความต่างของข้อที่เพี้ยน ±{stage.cents} cents</span>
      </div>
      {audio.error && <p className="field-error" role="alert">{audio.error}</p>}
      <fieldset className="ear-answer-set">
        <legend>{heard ? 'เสียงที่สองเป็นอย่างไร' : 'ฟังทั้งสองเสียงก่อนตอบ'}</legend>
        <div className="ear-answers">
          {(Object.keys(pitchChoices) as PitchChoice[]).map(choice =>
            <button key={choice} type="button" disabled={!heard || audio.playing === 'phrase' || answer !== null}
              className={`ear-choice${answer !== null && choice === round.answer ? ' correct' : answer === choice ? ' incorrect' : ''}`}
              onClick={() => guess(choice)}><strong>{pitchChoices[choice]}</strong></button>)}
        </div>
      </fieldset>
      {answer && <>
        <RoundGrade exercise={stage} correct={Number(answer === round.answer)} attempts={1}>
          <button type="button" className="subtle-button" onClick={() => reset(stage)}><RotateCcw size={16} />ข้อต่อไป</button>
        </RoundGrade>
        <p className="advanced-explainer" role="status">
          {answer === round.answer ? 'ถูกต้อง' : 'เฉลย'} · {pitchChoices[round.answer]} · {round.cents > 0 ? '+' : ''}{round.cents} cents
        </p>
      </>}
    </div>
  )
}
