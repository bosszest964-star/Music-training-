import { useCallback, useEffect, useRef, useState } from 'react'
import { dayKey } from '../usePractice'
import { stageById, stages, tracks } from './campaign'
import type { StageStars, Track } from './campaign'

export const journeyKey = 'music-training.journey.v1'
export const validDay = /^\d{4}-\d{2}-\d{2}$/

export function isCalendarDay(day: string) {
  if (!validDay.test(day)) return false
  const date = new Date(day + 'T12:00:00')
  return !Number.isNaN(date.getTime()) && dayKey(date) === day
}

interface JourneyData {
  stars: StageStars
  daily: Record<string, Track>
  unlockAll: boolean
  earRun: number
  bestEarRun: number
  generated: number
}

const empty: JourneyData = { stars: {}, daily: {}, unlockAll: false, earRun: 0, bestEarRun: 0, generated: 0 }

function count(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0
}

export function parseJourney(raw: string | null): JourneyData | null {
  try {
    const data = JSON.parse(raw ?? 'null')
    if (!data || typeof data !== 'object' || !data.stars || !data.daily
      || typeof data.stars !== 'object' || typeof data.daily !== 'object'
      || Array.isArray(data.stars) || Array.isArray(data.daily)) return null
    const stars: StageStars = {}
    const daily: JourneyData['daily'] = {}
    for (const [id, value] of Object.entries(data.stars)) {
      const stage = stageById.get(id)
      if (stage && count(value) > 0 && count(value) <= stage.maxStars) stars[id] = Number(value)
    }
    const today = dayKey(new Date())
    for (const [day, value] of Object.entries(data.daily)) {
      if (day <= today && isCalendarDay(day) && typeof value === 'string' && Object.hasOwn(tracks, value)) daily[day] = value as Track
    }
    const earRun = count(data.earRun)
    return { stars, daily, unlockAll: data.unlockAll === true, earRun, bestEarRun: Math.max(earRun, count(data.bestEarRun)),
      generated: count(data.generated) }
  } catch {
    return null
  }
}

export function mergeJourney(local: JourneyData, backup: JourneyData) {
  const stars = { ...local.stars }
  for (const [id, value] of Object.entries(backup.stars)) stars[id] = Math.max(stars[id] ?? 0, value)
  return { ...local, stars, daily: { ...backup.daily, ...local.daily },
    bestEarRun: Math.max(local.bestEarRun, backup.bestEarRun), generated: Math.max(local.generated, backup.generated) }
}

function read() {
  try { return parseJourney(localStorage.getItem(journeyKey)) } catch { return null }
}

export function useJourney() {
  const [progress, setProgress] = useState(() => read() ?? empty)
  const current = useRef(progress)
  const [storageError, setStorageError] = useState(false)

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== journeyKey && event.key !== null) return
      current.current = read() ?? empty
      setProgress(current.current)
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  const update = useCallback((change: (latest: JourneyData) => JourneyData) => {
    // Read the current stored value to retain progress written by another tab.
    const next = change(read() ?? current.current)
    current.current = next
    try {
      localStorage.setItem(journeyKey, JSON.stringify(next))
      setStorageError(false)
    } catch {
      setStorageError(true)
    }
    setProgress(next)
  }, [])

  const earAnswer = useCallback((correct: number, attempts: number) => {
    if (attempts !== 1) return
    update(previous => {
      const earRun = correct === 1 ? previous.earRun + 1 : 0
      return { ...previous, earRun, bestEarRun: Math.max(earRun, previous.bestEarRun) }
    })
  }, [update])

  const awardStage = useCallback((id: string, stars: number) => {
    if (!stars) return
    update(previous => ({ ...previous, stars: { ...previous.stars, [id]: Math.max(previous.stars[id] ?? 0, stars) } }))
  }, [update])

  const finishDaily = useCallback((day: string, track: Track) => {
    update(previous => previous.daily[day] ? previous : { ...previous, daily: { ...previous.daily, [day]: track } })
  }, [update])

  const recordGeneration = useCallback(() => {
    update(previous => ({ ...previous, generated: previous.generated + 1 }))
  }, [update])

  return { ...progress, storageError, earAnswer, awardStage, finishDaily, recordGeneration,
    setUnlockAll: (unlockAll: boolean) => update(previous => ({ ...previous, unlockAll })) }
}

export function musicianLevel(stars: number, milliseconds: number) {
  const xp = 20 * stars + 5 * Math.floor(milliseconds / 60_000)
  const level = 1 + Math.floor(xp / 100)
  const titles = ['นักดนตรีฝึกหัด', 'นักซ้อมประจำห้อง', 'นักฟังจังหวะ', 'นักดนตรีขึ้นเวที', 'นักดนตรีผู้เชี่ยวชาญ']
  return { xp, level, title: titles[Math.min(titles.length - 1, Math.floor((level - 1) / 5))] }
}

function longestDailyRun(daily: JourneyData['daily']) {
  let previous = 0
  let run = 0
  let best = 0
  for (const day of Object.keys(daily).sort()) {
    const timestamp = Date.parse(day)
    run = timestamp - previous === 86_400_000 ? run + 1 : 1
    best = Math.max(run, best)
    previous = timestamp
  }
  return best
}

export function badgeCollection(progress: JourneyData, totalStars: number, milliseconds: number) {
  const cleared = Object.keys(progress.stars).length
  const bosses = stages.filter(stage => stage.boss && progress.stars[stage.id]).length
  const full = Object.values(progress.stars).filter(value => value === 3).length
  const days = Object.keys(progress.daily).length
  const minutes = Math.floor(milliseconds / 60_000)
  return [
    ['ซ้อมวันแรก', 'ทำตารางซ้อมรายวันสำเร็จครั้งแรก', days, 1],
    ['ไฟไม่ดับ', 'ซ้อมรายวันครบ 7 วันติดกัน', longestDailyRun(progress.daily), 7],
    ['หูทองคำ', 'ตอบโจทย์ฝึกหูถูกติดกัน 10 ข้อ', progress.bestEarRun, 10],
    ['ผู้พิชิตบอส', 'ผ่านด่านบอสหนึ่งบท', bosses, 1],
    ['นักสำรวจ', 'ผ่านแผนที่ 10 ด่าน', cleared, 10],
    ['เดินทางครึ่งทาง', 'ผ่านแผนที่ 25 ด่าน', cleared, 25],
    ['นักเดินทางครบทุกด่าน', 'ผ่านแผนที่ทั้ง 50 ด่าน', cleared, 50],
    ['ดาวเต็มฟ้า', 'ได้ 3 ดาวในแผนที่ 10 ด่าน', full, 10],
    ['ร้อยดาว', 'สะสม 100 ดาวจากทุกหมวด', totalStars, 100],
    ['นักซ้อมหนึ่งชั่วโมง', 'บันทึกเวลาซ้อมรวม 60 นาที', minutes, 60],
    ['นักซ้อมห้าชั่วโมง', 'บันทึกเวลาซ้อมรวม 300 นาที', minutes, 300],
    ['นักค้นหาโจทย์', 'สร้างโจทย์ใหม่ 10 ครั้ง', progress.generated, 10],
  ].map(([name, description, value, target]) => ({ name: String(name), description: String(description),
    value: Math.min(Number(value), Number(target)), target: Number(target), earned: Number(value) >= Number(target) }))
}

export type JourneyProgress = ReturnType<typeof useJourney>
