import { useState } from 'react'
import { Award, Dices, Flame, Map, Play, Timer } from 'lucide-react'
import { currentStreak } from '../ear/stats'
import { dayKey } from '../usePractice'
import { tracks } from './campaign'
import type { Track } from './campaign'

export function DailyCard({ daily, today, onStart, openMap, openGenerator, openProfile }: {
  daily: Record<string, Track>; today: Date; onStart: (track: Track) => void
  openMap: () => void; openGenerator: () => void; openProfile: () => void
}) {
  const [track, setTrack] = useState<Track>('balanced')
  const streak = currentStreak(new Set(Object.keys(daily)), today)

  return (
    <section className="panel journey-panel journey-daily-card" aria-labelledby="daily-start-title">
      <header className="journey-heading">
        <div className="journey-card-title"><span className="tool-icon purple"><Timer size={23} /></span>
          <div><h2 id="daily-start-title">ซ้อมด่วน 10 นาที</h2><p>4 ช่วงฝึกที่เปลี่ยนอัตโนมัติเมื่อหมดเวลา</p></div>
        </div>
        <span className="journey-streak"><Flame size={17} />{streak} วันติดกัน</span>
      </header>
      <div className="instrument-toolbar journey-track" role="group" aria-label="เลือกสายซ้อม">
        {Object.entries(tracks).map(([id, label]) => <button key={id} className="subtle-button" aria-pressed={track === id}
          onClick={() => setTrack(id as Track)}>{label}</button>)}
      </div>
      <div className="journey-actions">
        <button className="primary-button" onClick={() => onStart(track)}><Play size={18} />
          {daily[dayKey(today)] ? 'ซ้อมอีกรอบ' : 'เริ่มซ้อมวันนี้'}
        </button>
        {daily[dayKey(today)] && <span className="journey-muted">ซ้อมรายวันสำเร็จแล้ว</span>}
      </div>
      <div className="journey-shortcuts">
        <button className="subtle-button" onClick={openMap}><Map size={18} />แผนที่ 50 ด่าน</button>
        <button className="subtle-button" onClick={openGenerator}><Dices size={18} />สุ่มโจทย์ไม่จำกัด</button>
        <button className="subtle-button" onClick={openProfile}><Award size={18} />เลเวลและเหรียญ</button>
      </div>
    </section>
  )
}
