import { useId } from 'react'
import { Ear, Flame, Target, Trophy } from 'lucide-react'
import { topics } from './exercises'
import type { Topic } from './exercises'
import { accuracy, currentStreak } from './stats'
import type { EarStatsData } from './stats'

export default function EarStats({ stats, open }: { stats: EarStatsData; open?: () => void }) {
  const title = useId()
  const streak = currentStreak(stats.days, new Date())
  return (
    <section className="panel ear-stats" aria-labelledby={title}>
      <header className="panel-header">
        <span className="tool-icon purple"><Ear size={22} aria-hidden="true" /></span>
        <div>
          <h2 id={title}>สถิติฝึกหู</h2>
          <p>ตอบถูก 1 ข้อได้ 1 คะแนน ตอบอย่างน้อยวันละ 1 ข้อเพื่อนับวันต่อเนื่อง</p>
        </div>
        {open && <button className="subtle-button ear-open" onClick={open}>ไปฝึกหู</button>}
      </header>
      <dl className="ear-metrics">
        <div><dt><Trophy size={17} aria-hidden="true" />คะแนนสะสม</dt><dd>{stats.total.correct}<small> คะแนน</small></dd></div>
        <div><dt><Target size={17} aria-hidden="true" />ความแม่นยำรวม</dt><dd>{accuracy(stats.total)}<small> · {stats.total.attempts} ข้อ</small></dd></div>
        <div><dt><Flame size={17} aria-hidden="true" />ซ้อมต่อเนื่อง</dt><dd>{streak}<small> วัน</small></dd></div>
      </dl>
      <dl className="ear-topic-stats" aria-label="ความแม่นยำแยกตามหัวข้อ">
        {(Object.keys(topics) as Topic[]).map(topic => {
          const count = stats.counts[topic]
          return <div key={topic}>
            <dt>{topics[topic]}</dt>
            <dd><strong>{accuracy(count)}</strong><span>{count.correct}/{count.attempts} ข้อ</span></dd>
          </div>
        })}
      </dl>
      {stats.storageError && <p className="field-error" role="status">เบราว์เซอร์บันทึกสถิติฝึกหูไม่ได้ คะแนนใหม่จะแสดงระหว่างเปิดหน้านี้</p>}
    </section>
  )
}
