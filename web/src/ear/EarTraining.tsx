import { useEffect, useRef, useState } from 'react'
import { AudioLines, CheckCircle2, Ear, ListMusic, Play, RotateCcw, SlidersHorizontal, Square, XCircle } from 'lucide-react'
import { createEarAudio } from './audio'
import type { EqSide, Voice } from './audio'
import EarStats from './EarStats'
import { makeQuestion } from './exercises'
import type { Difficulty, Game, HarmonyMode, Question } from './exercises'
import type { EarStatsData } from './stats'

const games = {
  degree: { label: 'หน้าที่โน้ตในคีย์', description: 'ฟังคอร์ดนำแล้วหาว่าโน้ตอยู่ตำแหน่งไหน', icon: Ear },
  harmony: { label: 'ขั้นคู่เสียงและคอร์ด', description: 'ฟังระยะห่างของโน้ตและสีของคอร์ด', icon: ListMusic },
  eq: { label: 'EQ Frequency Gym', description: 'ฟังเทียบ A/B แล้วหาย่านที่ถูกบูสต์', icon: SlidersHorizontal },
} as const

const difficulties: Record<Difficulty, string> = { beginner: 'เริ่มต้น (1, 3, 5)', diatonic: 'ครบ 7 โน้ต', chromatic: 'โครมาติก 12 โน้ต' }
const harmonyModes: Record<HarmonyMode, string> = {
  mixed: 'สุ่มทั้งสองแบบและคอร์ด', melodic: 'ขั้นคู่ทีละโน้ต', harmonic: 'ขั้นคู่พร้อมกัน', chord: 'ชนิดคอร์ด',
}
const voices: Record<Voice, string> = { piano: 'เปียโน', soft: 'โทนนุ่ม' }
const eqSides: Record<EqSide, string> = { A: 'A · ต้นฉบับ', B: 'B · ปรับ EQ' }

function Options<T extends string>({ label, options, value, onChange }: {
  label: string
  options: Record<T, string>
  value: T
  onChange: (option: T) => void
}) {
  return (
    <div className="ear-control">
      <span>{label}</span>
      <div className="segmented ear-options" role="group" aria-label={label}>
        {(Object.keys(options) as T[]).map(option =>
          <button key={option} type="button" aria-pressed={option === value} onClick={() => onChange(option)}>
            {options[option]}
          </button>,
        )}
      </div>
    </div>
  )
}

function Exercise({ game, voice, difficulty, mode, record }: {
  difficulty: Difficulty
  mode: HarmonyMode
  game: Game
  voice: Voice
  record: EarStatsData['record']
}) {
  const [question, setQuestion] = useState(() => makeQuestion(game, difficulty, mode))
  const [heard, setHeard] = useState(false)
  const [answer, setAnswer] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState('')
  const [side, setSide] = useState<EqSide>('A')
  const [heardB, setHeardB] = useState(false)
  const [audio] = useState(createEarAudio)
  const sideRef = useRef<EqSide>('A')
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

  function changeSide(next: EqSide) {
    sideRef.current = next
    setSide(next)
    if (playing) {
      audio.setSide(next)
    } else {
      void play(question, next)
    }
  }

  function stop() {
    run.current += 1
    if (audio.boostedSeconds() >= 0.4) setHeardB(true)
    audio.stop()
    setPlaying(false)
  }

  async function play(current: Question, variant = sideRef.current) {
    const token = ++run.current
    setError('')
    setPlaying(true)
    try {
      await audio.play(current.sound, voice, variant, boosted => {
        if (token !== run.current) return
        if (game !== 'eq') setHeard(true)
        else if (boosted >= 0.4) setHeardB(true)
        setPlaying(false)
      })
      if (token !== run.current || game !== 'eq') return
      audio.setSide(sideRef.current)
    } catch {
      if (token !== run.current) return
      audio.stop()
      setPlaying(false)
      setError('เล่นเสียงไม่ได้ ตรวจสอบเสียงของอุปกรณ์แล้วลองอีกครั้ง')
    }
  }

  function guess(id: string) {
    if (answerLock.current || playing || !(game === 'eq' ? heardB : heard)) return
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
    setHeardB(false)
    if (game === 'eq') {
      sideRef.current = 'A'
      setSide('A')
    }
    playbackButton.current?.focus()
    void play(next)
  }

  const correct = answer === question.correct.id
  const ready = game === 'eq' ? heardB : heard
  const playLabel = playing ? 'หยุดเสียง'
    : game === 'eq' ? `ฟังเสียง ${side}` : heard ? 'ฟังอีกครั้ง' : 'ฟังโจทย์'

  return (
    <>
      <div className="ear-prompt">
        <div className={`ear-sound-icon ${playing ? 'is-playing' : ''}`} aria-hidden="true"><AudioLines size={32} /></div>
        <h2>{question.prompt}</h2>
        <p>{question.context}</p>
        <div className="ear-playback">
          <button ref={playbackButton} className="primary-button" onClick={playing ? stop : () => void play(question)}>
            {playing ? <Square size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
            {playLabel}
          </button>
          {game === 'eq' && <Options label="เทียบเสียง A/B" options={eqSides} value={side} onChange={changeSide} />}
        </div>
      </div>
      {error && <p className="field-error" role="alert">{error}</p>}
      <fieldset className="ear-answer-set">
        <legend>{ready ? 'เลือกคำตอบ' : game === 'eq' ? 'ฟังเสียง B ก่อนตอบ' : 'ฟังโจทย์ให้จบก่อนตอบ'}</legend>
        <div className="ear-answers">
          {question.choices.map(choice => {
            const correctChoice = answer !== null && choice.id === question.correct.id
            const incorrectChoice = answer === choice.id && !correctChoice
            return (
              <button type="button" key={choice.id} disabled={!ready || playing || answer !== null}
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
  const [difficulty, setDifficulty] = useState<Difficulty>('beginner')
  const [mode, setMode] = useState<HarmonyMode>('mixed')
  const [voice, setVoice] = useState<Voice>('piano')
  const settingsKey = `${game}:${difficulty}:${mode}`

  return (
    <>
      <section className="hero ear-hero">
        <div className="hero-copy">
          <h1>ฝึกหูและโสตทักษะ</h1>
          <span>ฝึกฟังตำแหน่งโน้ต ขั้นคู่ คอร์ด และย่านความถี่</span>
        </div>
        <div className="ear-hero-art" aria-hidden="true"><AudioLines /></div>
      </section>

      <div className="ear-games" role="group" aria-label="เลือกแบบฝึกหู">
        {(Object.keys(games) as Game[]).map(id => {
          const { label, description, icon: Icon } = games[id]
          return (
            <button key={id} className={`panel ear-game ear-${id}`} onClick={() => setGame(id)} aria-pressed={game === id}>
              <span className="ear-game-icon"><Icon size={21} aria-hidden="true" /></span>
              <span><strong>{label}</strong><small>{description}</small></span>
            </button>
          )
        })}
      </div>

      <section className={`panel ear-exercise ear-${game}`} aria-label={games[game].label}>
        <div className="ear-settings">
          {game === 'degree' && <Options label="ระดับความยาก" options={difficulties} value={difficulty} onChange={setDifficulty} />}
          {game === 'harmony' && <Options label="รูปแบบโจทย์" options={harmonyModes} value={mode} onChange={setMode} />}
          {game !== 'eq' && <Options label="เสียงที่ใช้" options={voices} value={voice} onChange={setVoice} />}
        </div>
        <Exercise key={settingsKey} game={game} voice={voice} difficulty={difficulty} mode={mode} record={stats.record} />
      </section>
      <EarStats stats={stats} />
    </>
  )
}
