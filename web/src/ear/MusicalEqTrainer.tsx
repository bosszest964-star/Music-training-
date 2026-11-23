import { useEffect, useRef, useState } from 'react'
import { ChevronDown, FileAudio, Play, RotateCcw, Square, Waves } from 'lucide-react'
import PianoLoadStatus from '../audio/PianoLoadStatus'
import EarOptions from './EarOptions'
import { createEqAudio } from './eqAudio'
import { eqSources, loopPianoNotes } from './eqLoops'
import type { EqSource } from './eqLoops'
import { chooseBand, eqBands, eqLevels, quizBands } from './eqModel'
import type { Band, BandHz, EqLevel } from './eqModel'
import type { EarStatsData } from './stats'

const modes = { learn: 'ทดลองฟัง', quiz: 'ทายย่านเสียง' } as const
const sides = { A: 'เสียงปกติ', B: 'เสียงที่ปรับ EQ' } as const
const labels = {
  beginner: 'เริ่มต้น · 3 ย่าน',
  intermediate: 'กลาง · 5 ย่าน',
  expert: 'โปร · 7 ย่าน',
} satisfies Record<EqLevel, string>

export default function MusicalEqTrainer({ record }: { record: EarStatsData['record'] }) {
  const [mode, setMode] = useState<keyof typeof modes>('learn')
  const [source, setSource] = useState<EqSource>('piano')
  const [file, setFile] = useState<File>()
  const [level, setLevel] = useState<EqLevel>('beginner')
  const [learnBand, setLearnBand] = useState<Band | null>(null)
  const [band, setBand] = useState(() => chooseBand('beginner'))
  const [side, setSide] = useState<keyof typeof sides>('A')
  const [answer, setAnswer] = useState<BandHz | null>(null)
  const [heard, setHeard] = useState(false)
  const [state, setState] = useState<'idle' | 'preparing' | 'playing'>('idle')
  const [error, setError] = useState('')
  const [pianoFallback, setPianoFallback] = useState(false)
  const [audio] = useState(createEqAudio)
  const version = useRef(0)
  const answerLock = useRef(false)
  const nextButton = useRef<HTMLButtonElement>(null)
  const transport = useRef<HTMLButtonElement>(null)

  useEffect(() => () => {
    version.current += 1
    audio.dispose()
  }, [audio])

  useEffect(() => {
    if (mode !== 'quiz' || state !== 'playing' || heard) return
    const interval = window.setInterval(() => {
      if (audio.boostedSeconds() >= 0.4) setHeard(true)
    }, 90)
    return () => window.clearInterval(interval)
  }, [audio, mode, state, heard])

  useEffect(() => {
    if (answer !== null) nextButton.current?.focus()
  }, [answer])

  function stop() {
    version.current += 1
    if (mode === 'quiz' && audio.boostedSeconds() >= 0.4) setHeard(true)
    audio.stop()
    setState('idle')
  }

  async function play() {
    const run = ++version.current
    setState('preparing')
    setError('')
    try {
      const started = await audio.play(source, file)
      if (run === version.current) {
        setPianoFallback(started?.pianoFallback ?? false)
        setState(started ? 'playing' : 'idle')
      }
    } catch (cause) {
      if (run !== version.current) return
      setState('idle')
      setError(source === 'file' ? 'เปิดไฟล์เสียงไม่ได้ ลองเลือก MP3, WAV หรือ M4A ที่เบราว์เซอร์รองรับ'
        : cause instanceof Error && cause.message.includes('เลือกไฟล์เพลง') ? cause.message
          : 'เล่นลูปไม่ได้ ลองแตะเล่นอีกครั้ง')
    }
  }

  function resetQuestion(nextBand: Band) {
    answerLock.current = false
    setAnswer(null)
    setHeard(false)
    setBand(nextBand)
    setSide('A')
    audio.setFilter({ hz: nextBand.hz, db: 0 }, true)
  }

  function changeMode(next: keyof typeof modes) {
    if (mode === next) return
    setMode(next)
    if (next === 'quiz') resetQuestion(chooseBand(level, band))
    else audio.setFilter({ hz: learnBand?.hz ?? 1000, db: learnBand ? 9 : 0 }, true)
  }

  function changeSource(next: EqSource) {
    if (source === next) return
    stop()
    setError('')
    setSource(next)
    setHeard(false)
  }

  function explore(next: Band | null) {
    setLearnBand(next)
    audio.setFilter({ hz: next?.hz ?? 1000, db: next ? 9 : 0 })
  }

  function compare(next: keyof typeof sides) {
    setSide(next)
    audio.setFilter({ hz: band.hz, db: next === 'B' ? eqLevels[level].gain : 0 })
  }

  function guess(choice: Band) {
    if (!heard || answerLock.current) return
    answerLock.current = true
    setAnswer(choice.hz)
    record('eq', choice.hz === band.hz)
  }

  const quiz = mode === 'quiz'
  return (
    <div className="musical-eq">
      <div className="eq-toolbar">
        <EarOptions label="โหมดฝึก EQ" options={modes} value={mode} onChange={changeMode} />
        <label className="eq-source">
          <span>แหล่งเสียง</span>
          <span className="eq-select"><select value={source} onChange={event => changeSource(event.currentTarget.value as EqSource)}>
            {(Object.keys(eqSources) as EqSource[]).map(item => <option value={item} key={item}>{eqSources[item]}</option>)}
          </select><ChevronDown size={16} /></span>
        </label>
      </div>
      {source === 'file' && <div className="eq-upload">
        <label className="subtle-button eq-file"><FileAudio size={17} />เลือกไฟล์เพลงจากเครื่อง
          <input type="file" aria-label="เลือกไฟล์เพลงสำหรับ EQ" accept="audio/*,.mp3,.m4a,.wav,.flac,.ogg" onChange={event => {
            const chosen = event.currentTarget.files?.[0]
            event.currentTarget.value = ''
            if (!chosen) return
            stop()
            setHeard(false)
            if (chosen.size > 100 * 1024 * 1024) {
              setError('เลือกไฟล์ไม่เกิน 100 MB เพื่อถอดรหัสในเบราว์เซอร์')
              return
            }
            setError('')
            setFile(chosen)
          }} />
        </label>
        {file && <span>{file.name}</span>}
      </div>}
      <div className="eq-listen">
        <span className="eq-listen-icon"><Waves size={24} aria-hidden="true" /></span>
        <div>
          <h2>{quiz ? 'ย่านไหนถูกบูสต์?' : 'ลองฟังทีละย่าน'}</h2>
          <p>{quiz ? 'เปิดลูป แล้วสลับเสียงปกติกับเสียงที่ปรับ EQ ขณะเพลงเล่น' :
            'เปิดลูปแล้วเลือกย่านเพื่อฟังทันที กดเสียงปกติเพื่อกลับมาเทียบ'}</p>
        </div>
        <button ref={transport} type="button" className="primary-button" disabled={source === 'file' && !file}
          onClick={state === 'idle' ? () => void play() : stop}>
          {state === 'idle' ? <Play size={17} /> : <Square size={17} />}
          {state === 'preparing' ? 'ยกเลิกเตรียมเสียง' : state === 'playing' ? 'หยุดลูป' : 'เล่นลูป'}
        </button>
      </div>
      {state === 'preparing' && <p className="eq-preparing" role="status">กำลังเตรียมลูปเสียง…</p>}
      {source === 'piano' && <PianoLoadStatus notes={loopPianoNotes} playingFallback={pianoFallback && state === 'playing'} />}
      {error && <p className="field-error" role="alert">{error}</p>}
      {quiz ? (
        <>
          <div className="eq-toolbar eq-quiz-settings">
            <EarOptions label="ระดับคำถาม" options={labels} value={level} onChange={next => {
              if (next === level) return
              setLevel(next)
              resetQuestion(chooseBand(next, band))
            }} />
            <EarOptions label="เทียบเสียง A/B" options={sides} value={side} onChange={compare} />
            <span className="eq-gain">+{eqLevels[level].gain} dB</span>
          </div>
          <fieldset className="ear-answer-set">
            <legend>{heard ? 'เลือกย่านที่ได้ยิน' : 'ฟังเสียงที่ปรับ EQ ก่อนตอบ'}</legend>
            <div className="ear-answers">
              {quizBands(level).map(choice => {
                const correct = answer !== null && choice.hz === band.hz
                const wrong = answer === choice.hz && !correct
                return <button key={choice.hz} type="button" disabled={!heard || answer !== null}
                  className={`ear-choice${correct ? ' correct' : wrong ? ' incorrect' : ''}`} onClick={() => guess(choice)}>
                  <strong>{choice.label}</strong><span>{choice.name}</span>
                </button>
              })}
            </div>
          </fieldset>
          {answer !== null && <div className={`ear-feedback ${answer === band.hz ? 'correct' : 'incorrect'}`}>
            <div role="status">
              <strong>{answer === band.hz ? `ถูกต้อง +1 คะแนน · ${band.label}` : `เฉลย ${band.label} · ${band.name}`}</strong>
              <p>{band.detail}</p>
            </div>
            <button ref={nextButton} type="button" className="subtle-button" onClick={() => {
              resetQuestion(chooseBand(level, band))
              transport.current?.focus()
            }}><RotateCcw size={16} />ข้อต่อไป</button>
          </div>}
        </>
      ) : (
        <>
          <div className="eq-explore-head">
            <button type="button" className="subtle-button" aria-pressed={learnBand === null} onClick={() => explore(null)}>เสียงปกติ</button>
            <span className="eq-gain">{learnBand ? `${learnBand.label} · +9 dB` : '0 dB'}</span>
          </div>
          <div className="eq-bands" role="group" aria-label="เลือกย่านความถี่ทดลองฟัง">
            {eqBands.map(choice => <button key={choice.hz} type="button" className="eq-band" aria-pressed={learnBand?.hz === choice.hz}
              onClick={() => explore(choice)}>
              <strong>{choice.label} <span>{choice.name}</span></strong>
              <small>{choice.detail}</small>
            </button>)}
          </div>
        </>
      )}
    </div>
  )
}
