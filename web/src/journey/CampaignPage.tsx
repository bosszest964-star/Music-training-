import { useRef, useState } from 'react'
import { Flag, LockKeyhole, Map, Play, Trophy } from 'lucide-react'
import { MasteryStars } from '../instrument/mastery/MasteryControls'
import { isUnlocked, stageGrade, stages, worlds } from './campaign'
import type { Stage } from './campaign'
import { MissionRunner } from './ExerciseRunner'
import type { MissionResult, RunnerProps } from './ExerciseRunner'
import type { JourneyProgress } from './progress'
import { useForegroundPractice } from './useForegroundPractice'

function CampaignStage({ stage, best, onAward, back, next, sources, onActiveChange }: RunnerProps & {
  stage: Stage; best: number; onAward: (id: string, stars: number) => void; back: () => void; next?: () => void
}) {
  const batchSize = stage.mission.kind === 'progression' || stage.mission.kind === 'intonation' ? 5 : 1
  const batch = useRef<number[]>([])
  const [count, setCount] = useState(0)
  const [last, setLast] = useState<{ accuracy: number; stars: number } | null>(null)
  const earStage = ['echo', 'progression', 'rhythm', 'intonation'].includes(stage.mission.kind)
  useForegroundPractice(earStage, onActiveChange)

  function score(result: MissionResult) {
    batch.current.push(result.accuracy)
    setCount(batch.current.length)
    if (batch.current.length < batchSize) return
    const accuracy = batch.current.reduce((sum, value) => sum + value, 0) / batchSize
    const stars = stageGrade(stage, accuracy, result.maxStars)
    batch.current = []
    setLast({ accuracy: Math.round(accuracy), stars })
    onAward(stage.id, stars)
  }

  return (
    <>
      <header className="hero journey-hero journey-stage-hero">
        <div className="hero-copy">
          <button type="button" className="subtle-button journey-stage-back" onClick={back}>
            <Map size={17} />กลับแผนที่
          </button>
          <h1>{stage.label}</h1>
          <span>บท {stage.world} · {stage.boss ? 'บอส' : 'ด่าน'} {stage.number}/50 · {stage.skill}</span>
        </div>
        {stage.boss ? <Trophy size={95} className="journey-hero-mark" aria-hidden="true" />
          : <Flag size={95} className="journey-hero-mark" aria-hidden="true" />}
      </header>
      <section className="panel journey-panel">
        <header className="journey-heading">
          <div><h2>เป้าหมายด่าน</h2>
            <p>{stage.boss ? 'ผ่านที่ความแม่นยำ 60% ขึ้นไป' : 'ผ่านที่ความแม่นยำ 45% ขึ้นไป'}
              {batchSize > 1 && ' · คะแนนคิดจากชุดละ 5 ข้อ'}</p></div>
          <MasteryStars stars={best} max={stage.maxStars} />
        </header>
        {batchSize > 1 && <p className="journey-muted">ตอบชุดนี้แล้ว {count}/{batchSize} ข้อ</p>}
        {last && <div className="journey-finish" role="status">
          <div><strong>{last.stars ? 'ผ่านด่านแล้ว' : 'ยังไม่ผ่าน · ลองซ้อมใหม่'}</strong><span>ความแม่นยำ {last.accuracy}%</span></div>
          <MasteryStars stars={last.stars} max={stage.maxStars} />
          {best > 0 && next && <button className="primary-button" onClick={next}><Play size={16} />ไปด่านถัดไป</button>}
        </div>}
      </section>
      <div className="journey-exercise">
        <MissionRunner mission={stage.mission} sources={sources} onActiveChange={onActiveChange} onResult={score} />
      </div>
    </>
  )
}

export default function CampaignPage({ progress, sources, onActiveChange }: RunnerProps & { progress: JourneyProgress }) {
  const [selected, select] = useState<Stage | null>(null)
  const [world, setWorld] = useState(() =>
    stages.find(stage => !(progress.stars[stage.id] ?? 0) && isUnlocked(stage, progress.stars, false))?.world ?? 1)
  const unlocked = (stage: Stage) => isUnlocked(stage, progress.stars, progress.unlockAll)
  const cleared = Object.keys(progress.stars).length
  const totalStars = Object.values(progress.stars).reduce((total, value) => total + value, 0)
  const chapter = worlds[world - 1]

  function open(stage: Stage) {
    if (!unlocked(stage)) return
    select(stage)
    setWorld(stage.world)
    window.scrollTo(0, 0)
  }

  if (selected) {
    const next = stages[selected.number]
    return <CampaignStage key={selected.id} stage={selected} best={progress.stars[selected.id] ?? 0}
      onAward={progress.awardStage} next={next && unlocked(next) ? () => open(next) : undefined}
      back={() => select(null)} sources={sources} onActiveChange={onActiveChange} />
  }

  return (
    <>
      <section className="hero journey-hero">
        <div className="hero-copy">
          <h1>แผนที่ฝึกดนตรี</h1><span>ผ่าน {cleared}/50 ด่าน · เก็บแล้ว {totalStars}/150 ดาว</span>
        </div>
        <Map size={105} className="journey-hero-mark" aria-hidden="true" />
      </section>
      <section className="panel journey-panel">
        <header className="journey-heading">
          <div><h2>เลือกบทเรียน</h2><p>ผ่านหนึ่งด่านเพื่อเปิดด่านถัดไป ทุกด่านเล่นฟรี</p></div>
          <label className="instrument-toggle journey-unlock">
            <input type="checkbox" role="switch" checked={progress.unlockAll} onChange={event => progress.setUnlockAll(event.currentTarget.checked)} />
            เปิดทุกด่าน (Unlock All)
          </label>
        </header>
        <div className="journey-worlds" role="group" aria-label="เลือกบทเรียน">
          {worlds.map(item => <button key={item.number} className="subtle-button" aria-pressed={world === item.number}
            onClick={() => setWorld(item.number)}>
            <span>บท {item.number}</span><strong>{item.name}</strong>
          </button>)}
        </div>
        <div className="journey-world-heading">
          <div><h3>{chapter.name}</h3><p>{chapter.goal}</p></div>
          <span>{chapter.stages.filter(stage => progress.stars[stage.id]).length}/10 ด่าน</span>
        </div>
        <ol className="journey-map" start={chapter.stages[0].number}>
          {chapter.stages.map(stage => {
            const canPlay = unlocked(stage)
            const stars = progress.stars[stage.id] ?? 0
            const titleId = stage.id + '-title'
            const requirementId = stage.id + '-requirement'
            return <li key={stage.id} data-boss={stage.boss || undefined}>
              <article className="journey-node" aria-labelledby={titleId}
                data-cleared={stars > 0 || undefined} data-locked={!canPlay || undefined}>
                <header className="journey-node-header">
                  <span className="journey-node-number" aria-hidden="true">
                    {stage.boss ? <Trophy size={20} /> : stage.number}
                  </span>
                  <div className="journey-node-title">
                    <small>{stage.boss ? 'บอส' : 'ด่าน'} {stage.number} · {stage.skill}</small>
                    <strong id={titleId}>{stage.label}</strong>
                  </div>
                  <MasteryStars stars={stars} max={stage.maxStars} />
                </header>
                <footer className="journey-node-footer">
                  {!canPlay && <p className="journey-muted" id={requirementId}>ต้องผ่านด่าน {stage.number - 1} ก่อน</p>}
                  <button type="button" className="primary-button journey-node-action"
                    disabled={!canPlay} aria-describedby={canPlay ? titleId : titleId + ' ' + requirementId}
                    onClick={() => open(stage)}>
                    {canPlay ? <Play size={17} /> : <LockKeyhole size={17} />}{canPlay ? 'เริ่มเล่น' : 'ยังล็อก'}
                  </button>
                </footer>
              </article>
            </li>
          })}
        </ol>
      </section>
      {progress.storageError && <p className="field-error" role="status">บันทึกความคืบหน้าในเบราว์เซอร์ไม่ได้</p>}
    </>
  )
}
