import { lazy, Suspense, useId, useRef, useState } from 'react'
import { AudioLines, Guitar, KeyboardMusic, ListMusic, Music2, Star, Timer, Trophy } from 'lucide-react'
import { formatDuration } from '../usePractice'
import AudioPlayer from './AudioPlayer'
import ChordTrainer from './ChordTrainer'
import PianoTrainer from './PianoTrainer'
import type { InstrumentStats } from './stats'
import { activityLabels, roundStars } from './stats'
import { MasteryStars } from './mastery/MasteryControls'
const FretboardTrainer = lazy(() => import('./mastery/FretboardTrainer'))
const SightReadingTrainer = lazy(() => import('./mastery/SightReadingTrainer'))
const StrumTrainer = lazy(() => import('./mastery/StrumTrainer'))

const tabs = {
  piano: { name: 'เปียโนและโน้ตไหล', icon: KeyboardMusic },
  chords: { name: 'คลังคอร์ด', icon: Guitar },
  strum: { name: 'ตีคอร์ดตามจังหวะ', icon: ListMusic },
  fretboard: { name: 'จำโน้ตบนคอ', icon: Guitar },
  reading: { name: 'อ่านโน้ต', icon: Music2 },
  audio: { name: 'แกะเพลง', icon: AudioLines },
} as const

type Tab = keyof typeof tabs
const tabIds = Object.keys(tabs) as Tab[]
const dates = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' })

export function InstrumentHistory({ stats, open }: { stats: InstrumentStats; open?: () => void }) {
  const title = useId()
  const [limit, setLimit] = useState(open ? 3 : 8)
  const latestPiano = stats.rounds.find(round => round.activity === 'piano')
  const latestChords = stats.rounds.find(round => round.activity === 'chords')
  const latestQuiz = stats.rounds.find(round => round.activity === 'reading' || round.activity === 'fretboard')
  return (
    <section className="panel instrument-panel instrument-history" aria-labelledby={title}>
      <header className="panel-header">
        <span className="tool-icon purple"><KeyboardMusic size={22} /></span>
        <div><h2 id={title}>สถิติฝึกเครื่องดนตรี</h2><p>คะแนนของรอบที่ซ้อมจบและเวลาซ้อมในรอบเหล่านั้น</p></div>
        {open && <button className="subtle-button instrument-open" onClick={open}>ไปฝึกเครื่องดนตรี</button>}
      </header>
      <dl className="instrument-metrics">
        <div><dt><Trophy size={16} />เปียโนล่าสุด</dt><dd>{latestPiano ? `${latestPiano.accuracy}%` : '—'}</dd></div>
        <div><dt><Guitar size={16} />เปลี่ยนคอร์ดทันล่าสุด</dt><dd>{latestChords ? `${latestChords.accuracy}%` : '—'}</dd></div>
        <div><dt><Music2 size={16} />เกมโน้ตล่าสุด</dt><dd>{latestQuiz ? `${latestQuiz.accuracy}%` : '—'}</dd></div>
        <div><dt><Star size={16} />ดาวสะสม</dt><dd>{stats.totals.stars}</dd></div>
        <div><dt><Timer size={16} />เวลาซ้อมสะสม</dt><dd>{formatDuration(stats.totals.duration)}</dd></div>
      </dl>
      {stats.rounds.length ? (
        <>
          <ul className="instrument-history-list">
            {stats.rounds.slice(0, limit).map(round => {
              const earned = roundStars(round)
              return <li key={round.id}>
                <div><strong>{round.label}</strong><time dateTime={new Date(round.date).toISOString()}>{dates.format(round.date)}</time></div>
                <span>{activityLabels[round.activity]} · {formatDuration(round.duration)}</span>
                {round.activity !== 'strum' && <div className="mastery-history-score">
                  <strong>{round.accuracy}%</strong>
                  {earned && <MasteryStars stars={earned.stars} max={earned.max} />}
                </div>}
              </li>
            })}
          </ul>
          {!open && limit < stats.rounds.length && <button className="subtle-button" onClick={() => setLimit(value => value + 8)}>ดูประวัติเพิ่ม</button>}
        </>
      ) : <p className="instrument-hint">ซ้อมให้จบรอบเพื่อบันทึกคะแนนและเวลา</p>}
      {stats.storageError && <p className="field-error" role="status">เบราว์เซอร์บันทึกคะแนนไม่ได้ ข้อมูลใหม่ยังแสดงในหน้านี้</p>}
    </section>
  )
}

const trainers = { piano: PianoTrainer, chords: ChordTrainer, strum: StrumTrainer, fretboard: FretboardTrainer, reading: SightReadingTrainer }

function InstrumentTrainer({ tab, ...props }: {
  tab: Exclude<Tab, 'audio'>
  save: InstrumentStats['save']
  onActiveChange: (active: boolean) => void
}) {
  const Trainer = trainers[tab]
  return <Trainer {...props} />
}

export default function InstrumentStudio({ stats, onActiveChange }: { stats: InstrumentStats; onActiveChange: (active: boolean) => void }) {
  const [tab, setTab] = useState<Tab>('piano')
  const tabList = useRef<HTMLDivElement>(null)
  const prefix = useId()

  return (
    <>
      <section className="hero instrument-hero">
        <div className="hero-copy">
          <h1>ห้องซ้อมเครื่องดนตรี</h1>
          <span>เล่นเปียโน ฝึกตีคอร์ด อ่านโน้ต และแกะเพลงทีละท่อน</span>
        </div>
        <div className="instrument-hero-art" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></div>
      </section>
      <div ref={tabList} className="instrument-tabs" role="tablist" aria-label="เลือกเครื่องมือฝึกและแกะเพลง"
        onKeyDown={event => {
          const index = tabIds.indexOf(tab)
          const next = event.key === 'ArrowRight' ? (index + 1) % tabIds.length
            : event.key === 'ArrowLeft' ? (index + tabIds.length - 1) % tabIds.length
              : event.key === 'Home' ? 0 : event.key === 'End' ? tabIds.length - 1 : -1
          if (next < 0) return
          event.preventDefault()
          setTab(tabIds[next])
          tabList.current?.querySelectorAll('button')[next].focus()
        }}>
        {tabIds.map(id => {
          const { name, icon: Icon } = tabs[id]
          return <button key={id} id={`${prefix}-${id}`} className="subtle-button" role="tab"
            aria-selected={tab === id} aria-controls={`${prefix}-panel-${id}`}
            tabIndex={tab === id ? 0 : -1} onClick={() => setTab(id)}><Icon size={18} />{name}</button>
        })}
      </div>
      {tabIds.map(id => <div key={id} id={`${prefix}-panel-${id}`} role="tabpanel" aria-labelledby={`${prefix}-${id}`}
        hidden={tab !== id} tabIndex={tab === id ? 0 : undefined}>
        {tab === id && <Suspense fallback={<div className="panel instrument-panel" role="status">กำลังเปิดแบบฝึก…</div>}>
          {id === 'audio' ? <AudioPlayer onActiveChange={onActiveChange} />
            : <InstrumentTrainer tab={id} save={stats.save} onActiveChange={onActiveChange} />}
        </Suspense>}
      </div>)}
      <InstrumentHistory stats={stats} />
    </>
  )
}
