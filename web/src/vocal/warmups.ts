import { exerciseMetadata } from '../exerciseMetadata'
import type { ExerciseDifficulty } from '../exerciseMetadata'
import type { Target, VocalPlan } from './music'

export const warmupGroups = {
  foundation: 'เปิดคอและวอร์มพื้นฐาน',
  registers: 'เชื่อมช่วงเสียง',
  runs: 'Riffs & Runs',
  precision: 'ความแม่นยำและเสียงยาว',
} as const

type WarmupGroup = keyof typeof warmupGroups
type Step = number | readonly [offset: number, beats: number, endOffset?: number]

const fiveTone = [0, 2, 4, 5, 7, 5, 4, 2, 0]
const major = [0, 2, 4, 5, 7, 9, 11, 12, 11, 9, 7, 5, 4, 2, 0]
const minor = [0, 2, 3, 5, 7, 8, 10, 12, 10, 8, 7, 5, 3, 2, 0]

function warmup(id: string, group: WarmupGroup, difficulty: ExerciseDifficulty, label: string, coach: string,
  steps: readonly Step[], options: { beatLength?: number; gap?: number; bpm?: number } = {}) {
  const span = Math.max(...steps.flatMap(step => typeof step === 'number' ? [step] : [step[0], step[2] ?? step[0]]))
  return { ...exerciseMetadata('vocal-warmup', id, difficulty), group, label, coach, steps, span,
    bpm: options.bpm ?? 84, beatLength: options.beatLength ?? 1, gap: options.gap ?? 0 }
}

export const warmups = [
  warmup('scale', 'foundation', 'beginner', 'ฮัมไล่ 5 โน้ต', 'ฮัม “อืม” เบา ๆ ปิดริมฝีปากหลวม ๆ เพื่อให้เสียงเดินต่อเนื่องตั้งแต่โน้ตแรกถึงโน้ตสุดท้าย', fiveTone),
  warmup('lip-trill', 'foundation', 'beginner', 'Lip Trill ไล่ 5 โน้ต', 'เป่า “บรื๊อ” ให้ริมฝีปากสั่นสม่ำเสมอ ช่วยฝึกให้ลมไหลเท่ากันตอนเปลี่ยนโน้ต', fiveTone),
  warmup('open-vowels', 'foundation', 'beginner', 'สระ อา–เอ–อี–โอ–อู', 'ร้อง “อา–เอ–อี–โอ–อู” ทีละสระ ผ่อนกรามและรักษาความดังให้ใกล้กันทุกเสียง', [0, 2, 4, 2, 0], { beatLength: 2, bpm: 76 }),
  warmup('major', 'foundation', 'beginner', 'ไล่สเกล Major', 'ร้อง “ลา” ทีละโน้ต ฟังระยะครึ่งเสียงตรง มี–ฟา และ ที–โด ให้ชัด', major, { beatLength: 0.75 }),
  warmup('natural-minor', 'foundation', 'intermediate', 'ไล่สเกล Natural Minor', 'ร้อง “นา” ทีละโน้ต จดจำเสียงขั้นที่ 3, 6 และ 7 ของไมเนอร์ธรรมชาติ', minor, { beatLength: 0.75 }),
  warmup('straw', 'foundation', 'beginner', 'วอร์มเสียงผ่านหลอด', 'เปล่ง “อู” เบา ๆ ผ่านหลอดสะอาด ถือระดับเสียงโดยปล่อยลมอย่างสม่ำเสมอ', [[0, 3], [2, 3], [4, 3], [2, 3], [0, 3]], { bpm: 76 }),
  warmup('siren', 'registers', 'intermediate', 'Octave Siren', 'ลาก “อู” จากต่ำขึ้นสูงแล้วกลับลงต่อเนื่อง ลดความดังเมื่อผ่านรอยต่อเสียงอกกับเสียงหัว', [[0, 4, 12], [12, 4, 0]], { bpm: 68 }),
  warmup('octave-jump', 'registers', 'intermediate', 'Octave Jump', 'ร้อง “ฮู” สลับโน้ตห่างหนึ่งอ็อกเทฟ เตรียมฟังโน้ตปลายทางในใจก่อนกระโดดขึ้นหรือลง', [0, 12, 0, 12, 0], { beatLength: 1.5, bpm: 76 }),
  warmup('fifth-leap', 'registers', 'intermediate', '5th Interval Leap', 'ร้อง “ยาห์” สลับคู่ห้า พักกรามให้คลายและเล็งโน้ตปลายทางให้ตรง', [0, 7, 0, 7, 0, 7, 0]),
  warmup('arpeggio', 'registers', 'intermediate', 'อาร์เพจจิโอ 1–3–5–8–5–3–1', 'ร้อง “มา” ตามโน้ตคอร์ด เปิดเสียงบนด้วยลมพอดี แล้วลงกลับมาที่โน้ตแรก', [0, 4, 7, 12, 7, 4, 0]),
  warmup('extended-ninth', 'registers', 'advanced', 'Extended 9th Arpeggio', 'ร้อง “นู” ไล่ข้ามอ็อกเทฟถึงขั้นที่ 9 ฝึกพาเสียงขึ้นโดยรักษารูปสระ', [0, 4, 7, 12, 14, 12, 7, 4, 0]),
  warmup('pentatonic', 'runs', 'intermediate', 'Pop Pentatonic Run', 'ร้อง “เย” ต่อกัน ใช้สระเดิมตลอดชุดโน้ตเพื่อให้ลูกวิ่งป๊อปฟังชัด', [0, 2, 4, 7, 9, 7, 4, 2, [0, 2]], { beatLength: 0.5, bpm: 88 }),
  warmup('soul-turn', 'runs', 'advanced', 'R&B Soul Turnaround', 'ร้อง “อาห์” คำเดียวให้เลี้ยวกลับผ่านโน้ตบลูส์ช้า ๆ ก่อนเร่งความเร็ว', [7, 9, 7, 4, 2, 3, 2, [0, 2]], { beatLength: 0.5, bpm: 80 }),
  warmup('blues', 'runs', 'advanced', 'Blues Scale Lick', 'ร้อง “แย” ให้ได้ยินตัวโน้ตบลูส์ชัดช่วง 5–♭5–4 และลงจบที่โน้ตหลัก', [0, 3, 5, 6, 7, 10, 7, 6, 5, 3, [0, 2]], { beatLength: 0.5, bpm: 80 }),
  warmup('melisma', 'runs', 'advanced', 'Agile Melisma Run', 'ร้อง “อา” คำเดียวหลายโน้ต ฟังทุกจุดเลี้ยวให้ชัดแล้วค่อยเพิ่ม BPM', [0, 2, 4, 5, 4, 7, 9, 7, 5, 4, 2, [0, 1.5]], { beatLength: 0.5, bpm: 80 }),
  warmup('chromatic', 'precision', 'advanced', 'Chromatic Half-Step', 'ร้อง “มี” ให้โน้ตขยับทีละครึ่งเสียงเท่ากัน ช่วยได้ยินความต่างของโน้ตที่อยู่ติดกัน', [0, 1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1, 0], { bpm: 76 }),
  warmup('staccato', 'precision', 'intermediate', 'Staccato Agility', 'ร้อง “ฮะ” สั้น ๆ ทีละตัว เว้นลมและคลายท้องในช่องว่างระหว่างโน้ต', fiveTone, { gap: 0.42, bpm: 72 }),
  warmup('hold', 'precision', 'beginner', 'ประคองโน้ตยาว 8 จังหวะ', 'ร้อง “อู” เบา ๆ จนครบ 8 จังหวะ คุมให้คีย์และความดังนิ่งตั้งแต่ต้นจนจบ', [[0, 8]], { bpm: 80 }),
]

export type Warmup = typeof warmups[number]

export function buildWarmup(exercise: Warmup, bpm: number, root: number): VocalPlan {
  const beat = 60 / bpm
  let time = 0
  const targets: Target[] = exercise.steps.map(step => {
    const [offset, beats, to = offset] = typeof step === 'number' ? [step, exercise.beatLength] : step
    const start = time
    time += beats * beat
    return { start, end: time - exercise.gap * beat, from: root + offset, to: root + to }
  })
  return { root, span: exercise.span, beat, beatsPerBar: 4, targets, backing: [], duration: time }
}
