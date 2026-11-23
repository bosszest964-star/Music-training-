import { useId, useState } from 'react'
import { AudioLines, Guitar, KeyboardMusic, Timer, Trophy } from 'lucide-react'
import { formatDuration } from '../usePractice'
import AudioPlayer from './AudioPlayer'
import ChordTrainer from './ChordTrainer'
import PianoTrainer from './PianoTrainer'
import type { InstrumentStats } from './stats'

const tabs = {
  piano: { name: 'เปียโนและโน้ตไหล', icon: KeyboardMusic },
  chords: { name: 'คลังคอร์ด', icon: Guitar },
  audio: { name: 'แกะเพลง', icon: AudioLines },
} as const

type Tab = keyof typeof tabs
const dates = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' })

export function InstrumentHistory({ stats, open }: { stats: InstrumentStats; open?: () => void }) {
  const title = useId()
  const [limit, setLimit] = useState(open ? 3 : 8)
  const latestPiano = stats.rounds.find(round => round.activity === 'piano')
  const latestChords = stats.rounds.find(round => round.activity === 'chords')
  const total = stats.rounds.reduce((sum, round) => sum + round.duration, 0)
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
        <div><dt><Timer size={16} />เวลารอบที่ซ้อมจบ</dt><dd>{formatDuration(total)}</dd></div>
      </dl>
      {stats.rounds.length ? (
        <>
          <ul className="instrument-history-list">
            {stats.rounds.slice(0, limit).map(round => (
              <li key={round.id}>
                <div><strong>{round.label}</strong><time dateTime={new Date(round.date).toISOString()}>{dates.format(round.date)}</time></div>
                <span>{round.activity === 'piano' ? 'โน้ตไหล' : 'เปลี่ยนคอร์ด · ประเมินเอง'} · {formatDuration(round.duration)}</span>
                <strong>{round.accuracy}%</strong>
              </li>
            ))}
          </ul>
          {!open && limit < stats.rounds.length && <button className="subtle-button" onClick={() => setLimit(value => value + 8)}>ดูประวัติเพิ่ม</button>}
        </>
      ) : <p className="instrument-hint">ซ้อมให้จบรอบเพื่อบันทึกคะแนนและเวลา</p>}
      {stats.storageError && <p className="field-error" role="status">เบราว์เซอร์บันทึกคะแนนไม่ได้ ข้อมูลใหม่ยังแสดงในหน้านี้</p>}
    </section>
  )
}

export default function InstrumentStudio({ stats, onActiveChange }: { stats: InstrumentStats; onActiveChange: (active: boolean) => void }) {
  const [tab, setTab] = useState<Tab>('piano')

  return (
    <>
      <section className="hero instrument-hero">
        <div className="hero-copy">
          <h1>ห้องซ้อมเครื่องดนตรี</h1>
          <span>เล่นตามโน้ต ฝึกเปลี่ยนคอร์ด และแกะเพลงทีละท่อน</span>
        </div>
        <div className="instrument-hero-art" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></div>
      </section>
      <div className="instrument-tabs" role="group" aria-label="เลือกเครื่องมือฝึกและแกะเพลง">
        {(Object.keys(tabs) as Tab[]).map(id => {
          const { name, icon: Icon } = tabs[id]
          return <button key={id} className="subtle-button" aria-pressed={tab === id} onClick={() => setTab(id)}>
            <Icon size={18} />{name}
          </button>
        })}
      </div>
      {tab === 'piano' && <PianoTrainer save={stats.save} onActiveChange={onActiveChange} />}
      {tab === 'chords' && <ChordTrainer save={stats.save} onActiveChange={onActiveChange} />}
      {tab === 'audio' && <AudioPlayer onActiveChange={onActiveChange} />}
      <InstrumentHistory stats={stats} />
    </>
  )
}
