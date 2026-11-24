import { exerciseById } from '../ear/advanced/catalog'
import { exerciseMetadata, gradeStars } from '../exerciseMetadata'
import type { ExerciseDifficulty } from '../exerciseMetadata'
import { pianoById } from '../instrument/mastery/curriculum'
import { vocalExerciseById } from '../vocal/catalog'
import { clefs, readingLevels } from '../instrument/mastery/sightReading'
import type { Clef } from '../instrument/mastery/sightReading'
import { fretInstruments } from '../instrument/mastery/fretboard'
import type { FretChallenge, FretInstrument, fretRegions } from '../instrument/mastery/fretboard'
import type { PianoHand } from '../instrument/songs'

type LibraryKind = 'echo' | 'progression' | 'rhythm' | 'intonation' | 'warmup' | 'etude' | 'piano'
export type Mission =
  | { kind: LibraryKind; id: string; hand?: PianoHand | 'both' }
  | { kind: 'guitar'; instrument: FretInstrument; mode: FretChallenge; region: keyof typeof fretRegions }
  | { kind: 'reading'; clef: Clef; difficulty: ExerciseDifficulty }

function ear(kind: 'echo' | 'progression' | 'rhythm' | 'intonation', id: string): Mission {
  return { kind, id: `${kind}-${id}` }
}
const sing = (id: string): Mission => ({ kind: 'warmup', id: `vocal-warmup-${id}` })
const etude = (id: string): Mission => ({ kind: 'etude', id: `vocal-etude-${id}` })
const piano = (id: string, hand?: PianoHand | 'both'): Mission => ({ kind: 'piano', id: `instrument-piano-${id}`, hand })
const reading = (clef: Clef, difficulty: ExerciseDifficulty): Mission => ({ kind: 'reading', clef, difficulty })
const guitar = (mode: FretChallenge, region: keyof typeof fretRegions, instrument: FretInstrument = 'guitar'): Mission =>
  ({ kind: 'guitar', instrument, mode, region })

const worldPlans: readonly { name: string; goal: string; missions: readonly Mission[] }[] = [
  { name: 'ก้าวแรก', goal: 'จับชีพจรเพลงและจดจำโน้ตใกล้มือ', missions: [
    ear('rhythm', 'four-quarters'), ear('echo', 'rise-step'), piano('five-fingers'), sing('scale'),
    reading('treble', 'beginner'), guitar('find', 'first'), ear('rhythm', 'alternating-rest'),
    ear('intonation', '50'), piano('left-fingers'), ear('progression', 'cadence'),
  ] },
  { name: 'ต่อวลี', goal: 'ฟังทางคอร์ด ฝึกพัก และวางจังหวะให้มั่นคง', missions: [
    ear('rhythm', 'pair-eighths'), ear('echo', 'third-home'), sing('lip-trill'), piano('twinkle'),
    reading('bass', 'beginner'), guitar('name', 'first', 'ukulele'), etude('amazing-grace'),
    ear('progression', 'doo-wop'), piano('c-major'), etude('after-the-rain'),
  ] },
  { name: 'ข้ามช่วงเสียง', goal: 'ประสานมือและฟังระยะเสียงจากวลียาวขึ้น', missions: [
    ear('echo', 'step-arch'), ear('rhythm', 'dotted-quarter'), sing('fifth-leap'), piano('pop-chords', 'left'),
    guitar('find', 'upper', 'bass'), reading('grand', 'intermediate'), ear('progression', 'two-five-one'),
    ear('intonation', '25'), etude('river-path'), piano('waltz', 'both'),
  ] },
  { name: 'ขัดจังหวะ', goal: 'อ่านเส้นน้อยและเล่นตามเสียงที่เปลี่ยนทิศ', missions: [
    ear('rhythm', 'offbeat-eighths'), ear('echo', 'octave-preview'), sing('arpeggio'), piano('offbeat-melody', 'right'),
    guitar('name', 'upper'), reading('treble', 'advanced'), ear('progression', 'royal-road'),
    ear('intonation', '18'), piano('fur-elise'), ear('rhythm', 'triplet-intro'),
  ] },
  { name: 'ขึ้นเวที', goal: 'ฟังรายละเอียดและเล่นวลีซับซ้อนอย่างมั่นใจ', missions: [
    sing('melisma'), ear('echo', 'chromatic-turn'), guitar('find', 'all'), reading('grand', 'advanced'),
    ear('progression', 'secondary-dominant'), ear('intonation', '8'), etude('velvet-pocket'),
    ear('rhythm', 'mixed-finale'), piano('countermotion', 'both'), piano('jazz-boogie', 'both'),
  ] },
]

const descriptors = { echo: 'ฝึกหู', progression: 'ทางคอร์ด', rhythm: 'จังหวะ', intonation: 'เสียงเพี้ยน',
  warmup: 'วอร์มเสียง', etude: 'ร้องทำนอง', piano: 'เปียโน', guitar: 'คอเครื่องสาย', reading: 'อ่านโน้ต' }

export function missionLabel(mission: Mission) {
  const category = descriptors[mission.kind]
  if (mission.kind === 'guitar') return `${category} · ${fretInstruments[mission.instrument].label}`
  if (mission.kind === 'reading') return `${clefs[mission.clef]} · ${readingLevels[mission.difficulty].label}`
  if (mission.kind === 'piano') {
    const title = pianoById.get(mission.id)?.title
    const hands = mission.hand === 'left' ? ' · มือซ้าย' : mission.hand === 'right' ? ' · มือขวา' : ''
    return `${title ?? category}${hands}`
  }
  if (mission.kind === 'progression') return 'ฟังและแยกทางเดินคอร์ด'
  const exercise = exerciseById.get(mission.id) ?? vocalExerciseById.get(mission.id)
  if (exercise && 'cents' in exercise) return `จับเสียงเพี้ยน ${exercise.cents} cents`
  return exercise && 'label' in exercise ? exercise.label : mission.kind === 'echo' ? 'ฟังทำนองแล้วเล่นตาม' : category
}

export const worlds = worldPlans.map(({ name, goal, missions }, worldIndex) => ({
  name, goal, number: worldIndex + 1,
  stages: missions.map((mission, index) => {
    const number = worldIndex * 10 + index + 1
    const difficulty = worldIndex < 2 ? 'beginner' : worldIndex < 4 ? 'intermediate' : 'advanced'
    return {
      ...exerciseMetadata('campaign', String(number), difficulty, { accessTier: worldIndex === 0 ? 'free' : 'pro' }),
      mission, number, world: worldIndex + 1, boss: index === 9, skill: descriptors[mission.kind], label: missionLabel(mission),
    }
  }),
}))
export const stages = worlds.flatMap(world => world.stages)
export const stageById = new Map(stages.map(stage => [stage.id, stage]))
export type Stage = typeof stages[number]
export type StageStars = Record<string, number>

export function isUnlocked(stage: Stage, stars: StageStars, unlockAll: boolean) {
  return unlockAll || stage.number === 1 || (stars[stages[stage.number - 2].id] ?? 0) > 0
}

export function stageGrade(stage: Stage, accuracy: number, limit = 3) {
  if (stage.boss && accuracy < 60) return 0
  return gradeStars(accuracy, 100, Math.min(stage.maxStars, limit))
}

export const tracks = { voice: 'ร้องเพลงและหู', instrument: 'เครื่องดนตรีและจังหวะ', balanced: 'สมดุลครบทุกทักษะ' } as const
export type Track = keyof typeof tracks
const schedules: Record<Track, readonly (readonly Mission['kind'][])[]> = {
  voice: [['warmup'], ['echo'], ['progression', 'intonation'], ['etude']],
  instrument: [['rhythm'], ['piano'], ['guitar'], ['reading']],
  balanced: [['echo', 'progression', 'intonation'], ['warmup'], ['rhythm'], ['piano', 'guitar', 'reading']],
}
export const workoutSeconds = [120, 150, 150, 180] as const
export const workoutTotal = workoutSeconds.reduce<number>((total, seconds) => total + seconds, 0)

export function dailyPlan(track: Track, day: string, stars: StageStars) {
  const dateSeed = day.split('-').reduce((seed, unit) => seed * 37 + Number(unit), 0)
  const cleared = Object.values(stars).filter(Boolean).length
  const maxWorld = Math.min(5, 2 + Math.floor(cleared / 10))
  return schedules[track].map((kinds, index) => {
    const candidates = stages.filter(stage => kinds.includes(stage.mission.kind) && stage.world <= maxWorld)
    const weakest = Math.min(...candidates.map(stage => stars[stage.id] ?? 0))
    const recommended = candidates.filter(stage => (stars[stage.id] ?? 0) === weakest)
    const stage = recommended[(dateSeed + index * 17) % recommended.length]
    return { ...stage, seconds: workoutSeconds[index] }
  })
}
