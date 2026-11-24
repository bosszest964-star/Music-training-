import { useState } from 'react'
import { Award, Download, Settings2, Shield, Trophy, Upload } from 'lucide-react'
import { currentStreak } from '../ear/stats'
import { dayKey, formatDuration } from '../usePractice'
import { backupLimit, exportProgress, importProgress } from './backup'
import { badgeCollection, musicianLevel } from './progress'
import type { JourneyProgress } from './progress'

export function MusicianProfile({ progress, stars, milliseconds, openSettings }: {
  progress: JourneyProgress; stars: number; milliseconds: number; openSettings: () => void
}) {
  const { xp, level, title } = musicianLevel(stars, milliseconds)
  const badges = badgeCollection(progress, stars, milliseconds)
  const streak = currentStreak(new Set(Object.keys(progress.daily)), new Date())

  return (
    <>
      <section className="hero journey-hero journey-profile-hero">
        <div className="hero-copy"><h1>โปรไฟล์นักดนตรี</h1><span>{title} · เลเวล {level}</span></div>
        <Award size={100} className="journey-hero-mark" aria-hidden="true" />
      </section>
      <section className="panel journey-panel">
        <header className="journey-heading">
          <div><h2>เลเวล {level}</h2><p>ดาวละ 20 XP และเวลาซ้อมทุกนาทีได้ 5 XP</p></div>
          <button className="subtle-button" onClick={openSettings}><Settings2 size={17} />ตั้งค่าและสำรองข้อมูล</button>
        </header>
        <label className="journey-meter">
          <span><strong>{xp.toLocaleString('th-TH')} XP</strong><small>อีก {100 - xp % 100} XP ถึงเลเวล {level + 1}</small></span>
          <progress max={100} value={xp % 100} />
        </label>
        <dl className="journey-profile-totals">
          <div><dt>ดาวจากทุกหมวด</dt><dd>{stars}</dd></div>
          <div><dt>เวลาซ้อมสะสม</dt><dd>{formatDuration(milliseconds / 1000)}</dd></div>
          <div><dt>ซ้อมรายวันต่อเนื่อง</dt><dd>{streak} วัน</dd></div>
        </dl>
      </section>
      <section className="panel journey-panel">
        <header className="journey-heading"><div><h2>เหรียญรางวัล</h2><p>ปลดล็อกแล้ว {badges.filter(badge => badge.earned).length}/{badges.length} เหรียญ</p></div></header>
        <ul className="journey-badges">
          {badges.map(badge => <li key={badge.name} data-earned={badge.earned || undefined}>
            <span className="journey-badge-icon">{badge.earned ? <Trophy size={21} /> : <Award size={21} />}</span>
            <div><strong>{badge.name}</strong><p>{badge.description}</p>
              <small>{badge.earned ? 'ได้รับแล้ว' : badge.value + '/' + badge.target}</small>
            </div>
          </li>)}
        </ul>
      </section>
    </>
  )
}

export function ProgressSettings() {
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function download() {
    setError('')
    setStatus('')
    try {
      const file = new Blob([exportProgress(localStorage)], { type: 'application/json' })
      const url = URL.createObjectURL(file)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'music-training-' + dayKey(new Date()) + '.json'
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 15_000)
      setStatus('เตรียมไฟล์สำรองเรียบร้อย')
    } catch {
      setError('ส่งออกความคืบหน้าไม่ได้ ตรวจสอบว่าหน้านี้เข้าถึงพื้นที่จัดเก็บข้อมูลได้')
    }
  }

  async function restore(file: File) {
    setLoading(true)
    setStatus('')
    setError('')
    try {
      if (file.size > backupLimit) throw new Error('รองรับไฟล์สำรองขนาดไม่เกิน 10 MB')
      const writes = importProgress(await file.text(), localStorage)
      for (const { key, previous, value } of writes) {
        window.dispatchEvent(new StorageEvent('storage', { storageArea: localStorage, key, oldValue: previous, newValue: value }))
      }
      setStatus(writes.length ? 'นำเข้าแล้ว ' + writes.length + ' รายการ · เก็บความคืบหน้าที่สูงกว่าไว้' : 'ข้อมูลในเครื่องเป็นปัจจุบันแล้ว')
    } catch (cause) {
      setError(cause instanceof Error && /[ก-๙]/.test(cause.message) ? cause.message :
        'นำเข้าไม่ได้ ตรวจสอบว่าเป็นไฟล์ JSON จากห้องซ้อมและเบราว์เซอร์มีพื้นที่เพียงพอ')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <section className="hero journey-hero journey-profile-hero">
        <div className="hero-copy"><h1>ตั้งค่า</h1><span>สำรองและกู้คืนข้อมูลความคืบหน้า</span></div>
        <Shield size={100} className="journey-hero-mark" aria-hidden="true" />
      </section>
      <section className="panel journey-panel">
        <h2>ไฟล์สำรองความคืบหน้า</h2>
        <p className="journey-muted">บันทึกดาว สถิติ เวลาซ้อม ช่วงเสียง และลำดับตัวสุ่มเป็นไฟล์ JSON เก็บไว้ในเครื่อง เมื่อนำเข้าจะรวมกับข้อมูลที่มีอยู่</p>
        <div className="journey-actions">
          <button className="primary-button" disabled={loading} onClick={download}><Download size={18} />ส่งออกไฟล์ JSON</button>
          <label className="subtle-button instrument-file"><Upload size={18} />{loading ? 'กำลังตรวจไฟล์…' : 'นำเข้าไฟล์ JSON'}
            <input type="file" accept=".json,application/json" disabled={loading} onChange={event => {
              const file = event.currentTarget.files?.[0]
              event.currentTarget.value = ''
              if (file) void restore(file)
            }} />
          </label>
        </div>
        {status && <p className="instrument-result" role="status">{status}</p>}
        {error && <p className="field-error" role="alert">{error}</p>}
      </section>
    </>
  )
}
