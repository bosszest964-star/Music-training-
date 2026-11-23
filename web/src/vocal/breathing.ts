import { exerciseMetadata } from '../exerciseMetadata'
import type { ExerciseDifficulty } from '../exerciseMetadata'

type BreathAction = 'in' | 'hold' | 'out' | 'release' | 'reset'
type Phase = readonly [action: BreathAction, seconds: number]

function pattern(id: string, difficulty: ExerciseDifficulty, label: string, timing: string, coach: string, phases: readonly Phase[]) {
  const phasePlan = phases.map(([action, duration], index) => ({
    action, duration, start: phases.slice(0, index).reduce((total, [, seconds]) => total + seconds, 0),
  }))
  return {
    ...exerciseMetadata('vocal-breath', id, difficulty, { maxStars: 0 }), label, timing, coach, phases: phasePlan,
    cycle: phases.reduce((total, [, duration]) => total + duration, 0),
  }
}

export const breathingPatterns = [
  pattern('relax', 'beginner', 'ผ่อนคลาย', '4–4–6', 'หายใจเข้าให้ชายโครงขยายเบา ๆ ค้างอย่างสบาย แล้วปล่อยลมออกช้า ๆ', [['in', 4], ['hold', 4], ['out', 6]]),
  pattern('steady', 'beginner', 'คุมลมนิ่ง', '4–2–10', 'ตอนปล่อยลมให้ออกเสียง “ซสส” สม่ำเสมอจนจบรอบ ผ่อนหัวไหล่ไว้ตลอด', [['in', 4], ['hold', 2], ['out', 10]]),
  pattern('farinelli', 'advanced', 'Farinelli', '5–5–15', 'สูดเข้าเงียบ ๆ ค้างโดยคลายคอ แล้วผ่อนลมออกยาวผ่านริมฝีปากที่เปิดเล็กน้อย', [['in', 5], ['hold', 5], ['out', 15]]),
  pattern('catch', 'intermediate', 'Catch Breath', 'เข้า 1 วินาที · ออก 4 วินาที', 'รับลมเข้าทางปากเร็ว ๆ เหมือนช่วงพักในท่อนเพลง แล้วปล่อยเป็น “ฟู” ให้ต่อเนื่อง', [['in', 1], ['out', 4], ['reset', 2]]),
  pattern('staccato', 'intermediate', 'Staccato ฮ่า–ฮ่า–ฮ่า', 'เข้า 3 วินาที · ปล่อยสั้น 3 ครั้ง', 'สูดลมพอดี แล้วพูด “ฮ่า” เบา ๆ ทีละครั้งตามเสียงเคาะ คลายท้องระหว่างครั้ง', [
    ['in', 3], ['release', 0.35], ['hold', 0.65], ['release', 0.35], ['hold', 0.65], ['release', 0.35], ['reset', 2.65],
  ]),
]

export const breathLabels: Record<BreathAction, string> = {
  in: 'หายใจเข้า', hold: 'ค้างลม', out: 'ผ่อนลมออก', release: 'ฮ่า!', reset: 'พัก',
}

type Pattern = typeof breathingPatterns[number]

export function breathFrame(exercise: Pattern, elapsed: number) {
  const cycle = Math.floor(elapsed / exercise.cycle)
  const time = elapsed - cycle * exercise.cycle
  const phase = exercise.phases.find(item => time < item.start + item.duration) ?? exercise.phases[0]
  const progress = Math.min(1, Math.max(0, (time - phase.start) / phase.duration))
  const releases = exercise.phases.filter(item => item.action === 'release' && item.start < phase.start).length
  let expansion = 0
  if (phase.action === 'in') expansion = progress
  if (phase.action === 'hold') expansion = 1 - releases / 3
  if (phase.action === 'out') expansion = 1 - progress
  if (phase.action === 'release') expansion = 1 - (releases + progress) / 3
  return { cycle, label: breathLabels[phase.action], remaining: Math.max(1, Math.ceil(phase.duration * (1 - progress))),
    scale: 0.62 + 0.38 * expansion }
}

export function breathTicks(exercise: Pattern) {
  return exercise.phases.flatMap(({ start, duration, action }) => {
    if (action === 'reset' || (action === 'hold' && duration < 1)) return []
    return Array.from({ length: Math.ceil(duration) }, (_, index) => ({
      at: start + index,
      accent: index === 0,
    }))
  })
}
