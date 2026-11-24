import { useEffect, useRef, useState } from 'react'
import { AudioLines, CheckCircle2, Drum, Ear, Guitar, KeyboardMusic, ListMusic, Play, RotateCcw, SlidersHorizontal, Square, Star, Waves, XCircle } from 'lucide-react'
import { createEarAudio } from './audio'
import type { Voice } from '../audio/noteSynth'
import PianoLoadStatus from '../audio/PianoLoadStatus'
import EarOptions from './EarOptions'
import MusicalEqTrainer from './MusicalEqTrainer'
import EarStats from './EarStats'
import { makeQuestion } from './exercises'
import type { Difficulty, HarmonyMode, PitchGame, Question } from './exercises'
import type { EarStatsData } from './stats'
import { advancedCategories } from './exerciseMetadata'
import type { AdvancedCategory } from './exerciseMetadata'
import ProgressionTrainer from './advanced/ProgressionTrainer'
import MelodicEcho from './advanced/MelodicEcho'
import RhythmTapTrainer from './advanced/RhythmTapTrainer'
import IntonationTrainer from './advanced/IntonationTrainer'

const games = {
  degree: { label: 'หน้าที่โน้ตในคีย์', description: 'ฟังคอร์ดนำแล้วหาว่าโน้ตอยู่ตำแหน่งไหน', icon: Ear },
  harmony: { label: 'ขั้นคู่เสียงและคอร์ด', description: 'ฟังระยะห่างของโน้ตและสีของคอร์ด', icon: ListMusic },
  eq: { label: 'ฝึกฟัง EQ', description: 'ฟังย่านเสียงผ่านลูปดนตรีหรือเพลงของคุณ', icon: SlidersHorizontal },
  progression: { label: 'ทายทางเดินคอร์ด', description: 'ฟังคอร์ดในคีย์ที่สุ่มแล้วทายลำดับ', icon: Guitar },
  echo: { label: advancedCategories.echo, description: 'จำเสียงที่ได้ยินแล้วกดตามบนลิ่มเปียโน', icon: KeyboardMusic },
  rhythm: { label: advancedCategories.rhythm, description: 'ฝึกแตะตามแพตเทิร์นตั้งแต่ตัวดำถึงจังหวะขัด', icon: Drum },
  intonation: { label: advancedCategories.intonation, description: 'เทียบเสียงสองตัวที่ต่างกัน 5–50 cents', icon: Waves },
} as const

type Game = keyof typeof games
const groups: ReadonlyArray<{ id: string; label: string; games: readonly Game[] }> = [
  { id: 'pitch', label: 'โน้ตและการเทียบเสียง', games: ['degree', 'harmony', 'intonation'] },
  { id: 'music', label: 'ทำนองและทางคอร์ด', games: ['echo', 'progression'] },
  { id: 'rhythm', label: 'จังหวะ', games: ['rhythm'] },
  { id: 'eq', label: 'EQ', games: ['eq'] },
]

const difficulties: Record<Difficulty, string> = { beginner: 'เริ่มต้น (1, 3, 5)', diatonic: 'ครบ 7 โน้ต', chromatic: 'โครมาติก 12 โน้ต' }
const harmonyModes: Record<HarmonyMode, string> = {
  mixed: 'สุ่มทั้งสองแบบและคอร์ด', melodic: 'ขั้นคู่ทีละโน้ต', harmonic: 'ขั้นคู่พร้อมกัน', chord: 'ชนิดคอร์ด',
}
const voices: Record<Voice, string> = { piano: 'แกรนด์เปียโน', soft: 'โทนนุ่ม' }

function Exercise({ game, voice, difficulty, mode, record }: {
  difficulty: Difficulty
  mode: HarmonyMode
  game: PitchGame
  voice: Voice
  record: EarStatsData['record']
}) {
  const [question, setQuestion] = useState(() => makeQuestion(game, difficulty, mode))
  const [heard, setHeard] = useState(false)
  const [answer, setAnswer] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState('')
  const [audio] = useState(createEarAudio)
  const run = useRef(0)
  const answerLock = useRef(false)
  const nextButton = useRef<HTMLButtonElement>(null)
  const playbackButton = useRef<HTMLButtonElement>(null)

  useEffect(() => () => {
    run.current += 1
    audio.dispose()
  }, [audio])

  useEffect(() => {
    if (answer !== null) nextButton.current?.focus()
  }, [answer])

  function stop() {
    run.current += 1
    audio.stop()
    setPlaying(false)
  }

  async function play(current: Question) {
    const token = ++run.current
    setError('')
    setPlaying(true)
    try {
      await audio.play(current.sound, voice, () => {
        if (token !== run.current) return
        setHeard(true)
        setPlaying(false)
      })
    } catch {
      if (token !== run.current) return
      audio.dispose()
      setPlaying(false)
      setError('เล่นเสียงไม่ได้ ตรวจสอบเสียงของอุปกรณ์แล้วลองอีกครั้ง')
    }
  }

  function guess(id: string) {
    if (answerLock.current || playing || !heard) return
    answerLock.current = true
    setAnswer(id)
    record(question.topic, id === question.correct.id)
  }

  function nextQuestion() {
    if (!answerLock.current) return
    const next = makeQuestion(game, difficulty, mode, question)
    answerLock.current = false
    setQuestion(next)
    setAnswer(null)
    setHeard(false)
    playbackButton.current?.focus()
    void play(next)
  }

  const correct = answer === question.correct.id
  const playLabel = playing ? 'หยุดเสียง' : heard ? 'ฟังอีกครั้ง' : 'ฟังโจทย์'

  return (
    <>
      {voice === 'piano' && <PianoLoadStatus notes={question.sound.cues.flatMap(cue => cue.notes)} />}
      <div className="ear-prompt">
        <div className={`ear-sound-icon ${playing ? 'is-playing' : ''}`} aria-hidden="true"><AudioLines size={32} /></div>
        <h2>{question.prompt}</h2>
        <p>{question.context}</p>
        <div className="ear-playback">
          <button ref={playbackButton} className="primary-button" onClick={playing ? stop : () => void play(question)}>
            {playing ? <Square size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
            {playLabel}
          </button>
        </div>
      </div>
      {error && <p className="field-error" role="alert">{error}</p>}
      <fieldset className="ear-answer-set">
        <legend>{heard ? 'เลือกคำตอบ' : 'ฟังโจทย์ให้จบก่อนตอบ'}</legend>
        <div className="ear-answers">
          {question.choices.map(choice => {
            const correctChoice = answer !== null && choice.id === question.correct.id
            const incorrectChoice = answer === choice.id && !correctChoice
            return (
              <button type="button" key={choice.id} disabled={!heard || playing || answer !== null}
                className={correctChoice ? 'ear-choice correct' : incorrectChoice ? 'ear-choice incorrect' : 'ear-choice'}
                onClick={() => guess(choice.id)}>
                <strong>{choice.label}</strong>
                <span>{choice.detail}</span>
                {correctChoice && <CheckCircle2 size={16} className="choice-mark" aria-label="คำตอบที่ถูก" />}
                {incorrectChoice && <XCircle size={16} className="choice-mark" aria-label="คำตอบของคุณ" />}
              </button>
            )
          })}
        </div>
      </fieldset>
      {answer !== null && (
        <div className={correct ? 'ear-feedback correct' : 'ear-feedback incorrect'}>
          <div role="status">
            <strong>{correct ? 'ถูกต้อง! +1 คะแนน' : `เฉลย ${question.correct.label} · ${question.correct.detail}`}</strong>
            <p>{question.correct.explanation}</p>
          </div>
          <button ref={nextButton} className="subtle-button" onClick={nextQuestion}><RotateCcw size={16} />ข้อต่อไป</button>
        </div>
      )}
    </>
  )
}

export default function EarTraining({ stats }: { stats: EarStatsData }) {
  const [game, setGame] = useState<Game>('degree')
  const tabButtons = useRef<(HTMLButtonElement | null)[]>([])
  const [difficulty, setDifficulty] = useState<Difficulty>('beginner')
  const [mode, setMode] = useState<HarmonyMode>('mixed')
  const [voice, setVoice] = useState<Voice>('piano')
  const group = groups.find(item => item.games.includes(game)) ?? groups[0]
  const settingsKey = `${game}:${difficulty}:${mode}`

  return (
    <>
      <section className="hero ear-hero">
        <div className="hero-copy">
          <h1>ฝึกหูและโสตทักษะ</h1>
          <span>ฝึกฟังโน้ต ทำนอง ทางคอร์ด จังหวะ และย่านความถี่</span>
        </div>
        <div className="ear-hero-art" aria-hidden="true"><AudioLines /></div>
      </section>

      <div className="ear-category-tabs" role="tablist" aria-label="หมวดฝึกหูและจังหวะ">
        {groups.map((item, index) => (
          <button key={item.id} type="button" className="subtle-button" role="tab"
            id={`ear-tab-${item.id}`} aria-controls="ear-category-panel" aria-selected={item === group}
            tabIndex={item === group ? 0 : -1} ref={element => { tabButtons.current[index] = element }}
            onClick={() => { if (item !== group) setGame(item.games[0]) }}
            onKeyDown={event => {
              const next = event.key === 'ArrowRight' ? (index + 1) % groups.length :
                event.key === 'ArrowLeft' ? (index + groups.length - 1) % groups.length :
                  event.key === 'Home' ? 0 : event.key === 'End' ? groups.length - 1 : null
              if (next === null) return
              event.preventDefault()
              setGame(groups[next].games[0])
              tabButtons.current[next]?.focus()
            }}>{item.label}</button>
        ))}
      </div>
      <div id="ear-category-panel" role="tabpanel" aria-labelledby={`ear-tab-${group.id}`}>
        {group.games.length > 1 && <div className="ear-games ear-catalog" role="group" aria-label="เลือกแบบฝึกหู">
          {group.games.map(id => {
            const { label, description, icon: Icon } = games[id]
            const stars = stats.starsByCategory[id as AdvancedCategory]
            return (
              <button key={id} type="button" className={`panel ear-game ear-${id}`} onClick={() => setGame(id)} aria-pressed={game === id}>
                <span className="ear-game-icon"><Icon size={21} aria-hidden="true" /></span>
                <span><strong>{label}</strong><small>{description}</small></span>
                {stars > 0 && <span className="ear-card-stars" aria-label={`${stars} ดาว`}><Star size={14} fill="currentColor" />{stars}</span>}
              </button>
            )
          })}
        </div>}
        <section className={`panel ear-exercise ear-${game}`} aria-label={games[game].label}>
          {game === 'eq' && <MusicalEqTrainer record={stats.record} />}
          {game === 'progression' && <ProgressionTrainer stats={stats} />}
          {game === 'echo' && <MelodicEcho stats={stats} />}
          {game === 'rhythm' && <RhythmTapTrainer stats={stats} />}
          {game === 'intonation' && <IntonationTrainer stats={stats} />}
          {(game === 'degree' || game === 'harmony') && (
            <>
              <div className="ear-settings">
                {game === 'degree' && <EarOptions label="ระดับความยาก" options={difficulties} value={difficulty} onChange={setDifficulty} />}
                {game === 'harmony' && <EarOptions label="รูปแบบโจทย์" options={harmonyModes} value={mode} onChange={setMode} />}
                <EarOptions label="เสียงที่ใช้" options={voices} value={voice} onChange={setVoice} />
              </div>
              <Exercise key={settingsKey} game={game} voice={voice} difficulty={difficulty} mode={mode} record={stats.record} />
            </>
          )}
        </section>
      </div>
      <EarStats stats={stats} />
    </>
  )
}
