import { useId, useState } from 'react'
import { Activity, Clock3, Mic, Target } from 'lucide-react'
import { noteLabel } from '../audio/pitch'
import { warmups } from './music'
import RangeTest, { RangeResult } from './RangeTest'
import { formatDuration } from './stats'
import type { VocalStats } from './stats'
import WarmupSession from './WarmupSession'

const dateFormat = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' })

export function VocalHistory({ stats, open }: { stats: VocalStats; open?: () => void }) {
  const title = useId()
  const latest = stats.rounds[0]
  const practiceTime = stats.rounds.reduce((seconds, round) => seconds + round.duration, 0)
  const [limit, setLimit] = useState(open ? 3 : 8)

  return (
    <section className="panel vocal-panel vocal-history" aria-labelledby={title}>
      <header className="panel-header">
        <span className="tool-icon purple"><Mic size={22} /></span>
        <div><h2 id={title}>สถิติฝึกร้องเพลง</h2><p>คะแนนและเวลาร้องจากรอบที่ซ้อมจบ</p></div>
        {open && <button className="subtle-button vocal-open" onClick={open}>ไปฝึกร้องเพลง</button>}
      </header>
      <dl className="vocal-totals">
        <div><dt><Target size={16} />ความแม่นยำล่าสุด</dt><dd>{latest ? `${latest.accuracy}%` : '—'}</dd></div>
        <div><dt><Activity size={16} />รอบที่ซ้อมจบ</dt><dd>{stats.rounds.length}</dd></div>
        <div><dt><Clock3 size={16} />เวลาร้องสะสม</dt><dd>{formatDuration(practiceTime)}</dd></div>
      </dl>
      {open && stats.range && <RangeResult range={stats.range} />}
      {latest ? (
        <>
          <ul className="vocal-history-list">
            {stats.rounds.slice(0, limit).map(round => (
              <li key={round.id}>
                <div>
                  <strong>{warmups[round.exercise].label}</strong>
                  <time dateTime={new Date(round.finishedAt).toISOString()}>{dateFormat.format(round.finishedAt)}</time>
                </div>
                <span>{noteLabel(round.root)} · {round.bpm} BPM · {formatDuration(round.duration)}</span>
                <strong className="vocal-score" aria-label={`ความแม่นยำ ${round.accuracy}%`}>{round.accuracy}%</strong>
              </li>
            ))}
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

export default function VocalStudio({ stats, onActiveChange }: { stats: VocalStats; onActiveChange: (active: boolean) => void }) {
  const [tab, setTab] = useState<'warmup' | 'range'>('warmup')

  return (
    <>
      <section className="hero vocal-hero">
        <div className="hero-copy">
          <h1>สตูดิโอฝึกร้องเพลง</h1>
          <span>วัดช่วงเสียง วอร์มเสียง และดูว่าเสียงร้องตรงคีย์แค่ไหน</span>
        </div>
        <div className="vocal-hero-art" aria-hidden="true">
          <i /><i /><i /><i /><i /><i /><i />
        </div>
      </section>
      <div className="vocal-tabs" role="group" aria-label="เลือกเครื่องมือฝึกร้องเพลง">
        <button className="subtle-button" aria-pressed={tab === 'warmup'} onClick={() => setTab('warmup')}><Activity size={19} />วอร์มเสียง</button>
        <button className="subtle-button" aria-pressed={tab === 'range'} onClick={() => setTab('range')}><Mic size={19} />ทดสอบช่วงเสียง</button>
      </div>
      {tab === 'range'
        ? <RangeTest range={stats.range} save={stats.saveRange} />
        : <WarmupSession range={stats.range} save={stats.saveRound} onActiveChange={onActiveChange} />}
      <VocalHistory stats={stats} />
    </>
  )
}
