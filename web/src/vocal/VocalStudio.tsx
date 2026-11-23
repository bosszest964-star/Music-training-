import { useId, useRef, useState } from 'react'
import { Activity, Clock3, Mic, Music2, Rocket, Star, Target, Wind } from 'lucide-react'
import { noteLabel } from '../audio/pitch'
import { gradeStars } from '../exerciseMetadata'
import { vocalExerciseById } from './catalog'
import BreathingPacer from './BreathingPacer'
import PitchFlyer from './PitchFlyer'
import SingingSession from './SingingSession'
import { VocalStars } from './VocalControls'
import RangeTest, { RangeResult } from './RangeTest'
import { formatDuration } from '../usePractice'
import type { VocalStats } from './stats'

const dateFormat = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' })

export function VocalHistory({ stats, open }: { stats: VocalStats; open?: () => void }) {
  const title = useId()
  const latest = stats.rounds[0]
  const { latestPitch, practiceTime, stars } = stats.summary
  const [limit, setLimit] = useState(open ? 3 : 8)

  return (
    <section className="panel vocal-panel vocal-history" aria-labelledby={title}>
      <header className="panel-header">
        <span className="tool-icon purple"><Mic size={22} /></span>
        <div><h2 id={title}>สถิติฝึกร้องเพลง</h2><p>คะแนนและเวลาร้องจากรอบที่ซ้อมจบ</p></div>
        {open && <button className="subtle-button vocal-open" onClick={open}>ไปฝึกร้องเพลง</button>}
      </header>
      <dl className="vocal-totals">
        <div><dt><Target size={16} />ความแม่นยำล่าสุด</dt><dd>{latestPitch ? `${latestPitch.accuracy}%` : '—'}</dd></div>
        <div><dt><Activity size={16} />รอบที่ซ้อมจบ</dt><dd>{stats.rounds.length}</dd></div>
        <div><dt><Star size={16} />ดาวสะสม</dt><dd>{stars}</dd></div>
        <div><dt><Clock3 size={16} />เวลาร้องสะสม</dt><dd>{formatDuration(practiceTime)}</dd></div>
      </dl>
      {open && stats.range && <RangeResult range={stats.range} />}
      {latest ? (
        <>
          <ul className="vocal-history-list">
            {stats.rounds.slice(0, limit).map(round => {
              const exercise = vocalExerciseById.get(round.exercise)
              const pitch = round.kind === 'pitch' ? round : null
              return (
                <li key={round.id}>
                  <div>
                    <strong>{exercise?.label ?? 'แบบฝึกร้องเพลง'}</strong>
                    <time dateTime={new Date(round.finishedAt).toISOString()}>{dateFormat.format(round.finishedAt)}</time>
                  </div>
                  <span>
                    {pitch && `${noteLabel(pitch.root)} · ${pitch.bpm} BPM · `}
                    {formatDuration(round.duration)}
                    {pitch?.combo !== undefined && ` · คอมโบ ${pitch.combo}×`}
                  </span>
                  {pitch && exercise && <div className="vocal-score">
                    <strong aria-label={`ความแม่นยำ ${pitch.accuracy}%`}>{pitch.accuracy}%</strong>
                    <VocalStars stars={gradeStars(pitch.accuracy, 100, exercise.maxStars)} max={exercise.maxStars} />
                  </div>}
                </li>
              )
            })}
          </ul>
          {!open && limit < stats.rounds.length && (
            <button className="subtle-button" onClick={() => setLimit(value => value + 8)}>ดูประวัติเพิ่ม</button>
          )}
        </>
      ) : <p className="vocal-help">เมื่อซ้อมจบรอบ คะแนนและเวลาจะปรากฏที่นี่</p>}
      {stats.storageError && <p className="field-error" role="status">เบราว์เซอร์บันทึกข้อมูลฝึกร้องไม่ได้ ข้อมูลใหม่จะแสดงระหว่างเปิดหน้านี้</p>}
    </section>
  )
}

const tabs = [
  { id: 'warmup', label: 'วอร์มเสียง', Icon: Activity },
  { id: 'breath', label: 'ฝึกลมหายใจ', Icon: Wind },
  { id: 'etude', label: 'ร้องทำนอง', Icon: Music2 },
  { id: 'flyer', label: 'เกมร้องเก็บดาว', Icon: Rocket },
  { id: 'range', label: 'ทดสอบช่วงเสียง', Icon: Mic },
] as const

export default function VocalStudio({ stats, onActiveChange }: { stats: VocalStats; onActiveChange: (active: boolean) => void }) {
  const [tab, setTab] = useState<typeof tabs[number]['id']>('warmup')
  const tablist = useRef<HTMLDivElement>(null)
  const tabPrefix = useId()

  return (
    <>
      <section className="hero vocal-hero">
        <div className="hero-copy">
          <h1>สตูดิโอฝึกร้องเพลง</h1>
          <span>ฝึกลม วอร์มเสียง และร้องกับเปียโนในคีย์ที่เหมาะกับคุณ</span>
        </div>
        <div className="vocal-hero-art" aria-hidden="true">
          <i /><i /><i /><i /><i /><i />
        </div>
      </section>
      <div ref={tablist} className="vocal-tabs" role="tablist" aria-label="เลือกเครื่องมือฝึกร้องเพลง"
        onKeyDown={event => {
          const index = tabs.findIndex(item => item.id === tab)
          const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length
            : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length
              : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1
          if (next < 0) return
          event.preventDefault()
          setTab(tabs[next].id)
          tablist.current?.querySelectorAll('button')[next].focus()
        }}>
        {tabs.map(({ id, label, Icon }) => (
          <button key={id} id={`${tabPrefix}-${id}`} type="button" className="subtle-button" role="tab"
            aria-selected={tab === id} aria-controls={`${tabPrefix}-panel-${id}`}
            tabIndex={tab === id ? 0 : -1} onClick={() => setTab(id)}><Icon size={19} />{label}</button>
        ))}
      </div>
      {tabs.map(({ id }) => (
        <div key={id} id={`${tabPrefix}-panel-${id}`} role="tabpanel" aria-labelledby={`${tabPrefix}-${id}`}
          hidden={tab !== id} tabIndex={tab === id ? 0 : undefined}>
          {tab === id && (
            id === 'range' ? <RangeTest range={stats.range} save={stats.saveRange} />
              : id === 'breath' ? <BreathingPacer save={stats.saveRound} onActiveChange={onActiveChange} />
                : id === 'flyer' ? <PitchFlyer range={stats.range} save={stats.saveRound} onActiveChange={onActiveChange} />
                  : <SingingSession mode={id} range={stats.range} save={stats.saveRound} onActiveChange={onActiveChange} />
          )}
        </div>
      ))}
      <VocalHistory stats={stats} />
    </>
  )
}
