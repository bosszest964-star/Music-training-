import { useId } from 'react'
import { Ear, Flame, Star, Target, Trophy } from 'lucide-react'
import { topics } from './exercises'
import type { Topic } from './exercises'
import { accuracy, currentStreak } from './stats'
import type { EarStatsData } from './stats'
import type { AdvancedCategory } from './exerciseMetadata'

export default function EarStats({ stats, open }: { stats: EarStatsData; open?: () => void }) {
  const title = useId()
  const streak = currentStreak(stats.days, new Date())
  return (
    <section className="panel ear-stats" aria-labelledby={title}>
      <header className="panel-header">
        <span className="tool-icon purple"><Ear size={22} aria-hidden="true" /></span>
        <div>
          <h2 id={title}>สถิติฝึกหู</h2>
          <p>คำตอบ โน้ต หรือจังหวะที่ถูกต้องได้ 1 คะแนน ดาวสะสมใช้คะแนนดีที่สุดของแต่ละด่าน ทำอย่างน้อยหนึ่งข้อหรือหนึ่งรอบต่อวันเพื่อนับวันต่อเนื่อง</p>
        </div>
        {open && <button className="subtle-button ear-open" onClick={open}>ไปฝึกหู</button>}
      </header>
      <dl className="ear-metrics ear-metrics-expanded">
        <div><dt><Trophy size={17} aria-hidden="true" />คะแนนสะสม</dt><dd>{stats.total.correct}<small> คะแนน</small></dd></div>
        <div><dt><Target size={17} aria-hidden="true" />ความแม่นยำรวม</dt><dd>{accuracy(stats.total)}<small> · {stats.total.attempts} ครั้ง</small></dd></div>
        <div><dt><Flame size={17} aria-hidden="true" />ซ้อมต่อเนื่อง</dt><dd>{streak}<small> วัน</small></dd></div>
        <div><dt><Star size={17} aria-hidden="true" />ดาวสะสม</dt><dd>{stats.totalStars}<small> ดาว</small></dd></div>
      </dl>
      <dl className="ear-topic-stats" aria-label="ความแม่นยำแยกตามหัวข้อ">
        {(Object.keys(topics) as Topic[]).map(topic => {
          const count = stats.counts[topic]
          const stars = stats.starsByCategory[topic as AdvancedCategory]
          return <div key={topic}>
            <dt>{topics[topic]}</dt>
            <dd><strong>{accuracy(count)}</strong><span>{count.correct}/{count.attempts}</span>{stars !== undefined && <span className="ear-topic-stars">{stars} ดาว</span>}</dd>
          </div>
        })}
      </dl>
      {stats.storageError && <p className="field-error" role="status">เบราว์เซอร์บันทึกสถิติฝึกหูไม่ได้ คะแนนใหม่จะแสดงระหว่างเปิดหน้านี้</p>}
    </section>
  )
}
