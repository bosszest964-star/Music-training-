import { exerciseMetadata } from '../exerciseMetadata'
import type { ExerciseDifficulty } from '../exerciseMetadata'
import type { PianoCue, Target, VocalPlan } from './music'

export const etudeGroups = {
  pop: 'Pop Ballad',
  soul: 'Soul / R&B',
  folk: 'Acoustic Folk',
  classics: 'เพลงคลาสสิกและเพลงพื้นบ้าน',
} as const

type Style = keyof typeof etudeGroups
type MelodyStep = number | readonly [offset: number | null, beats: number]

const harmonies = {
  I: [0, 4, 7], IV: [5, 9, 12], V: [7, 11, 14], vi: [9, 12, 16], ii: [2, 5, 9],
  Imaj7: [0, 4, 7, 11], ii7: [2, 5, 9, 12], IVmaj7: [5, 9, 12, 16], V7: [7, 11, 14, 17], vi7: [9, 12, 16, 19],
  i: [0, 3, 7], III: [3, 7, 10], bVII: [10, 14, 17], bVI: [8, 12, 15], iv: [5, 8, 12],
} satisfies Record<string, readonly number[]>

type Harmony = keyof typeof harmonies
type BackingBeat = readonly [beat: number, length: number, voicing: 'bass' | 'chord' | 'both']

const backingStyles: Record<Style, readonly BackingBeat[]> = {
  pop: [[0, 1.75, 'both'], [2, 1.75, 'chord']],
  soul: [[0, 0.88, 'bass'], [0.5, 0.9, 'chord'], [2, 0.78, 'bass'], [2.5, 0.48, 'chord'], [3.25, 0.58, 'chord']],
  folk: [[0, 0.9, 'bass'], [1, 0.68, 'chord'], [2, 0.8, 'chord']],
  classics: [[0, 0.95, 'bass'], [1, 0.72, 'chord'], [2, 0.82, 'chord']],
}

function etude(id: string, group: Style, difficulty: ExerciseDifficulty, label: string, coach: string,
  bpm: number, beatsPerBar: 3 | 4, bars: readonly (readonly [Harmony, ...MelodyStep[]])[]) {
  const span = Math.max(...bars.flatMap(([, ...steps]) =>
    steps.map(step => typeof step === 'number' ? step : step[0] ?? 0)))
  return { ...exerciseMetadata('vocal-etude', id, difficulty), group, label, coach, bpm, beatsPerBar, bars, span }
}

export const etudes = [
  etude('after-the-rain', 'pop', 'beginner', 'หลังสายฝน', 'ร้อง “ลา” แบบต่อเสียง ให้โน้ตท้ายวลียาวกว่าช่วงเดินโน้ต', 72, 4, [
    ['I', 4, 2, [0, 2]], ['V', 2, 4, [7, 2]], ['vi', 9, 7, [4, 2]], ['IV', 5, 4, [0, 2]],
  ]),
  etude('city-lights', 'pop', 'intermediate', 'แสงไฟริมทาง', 'ร้อง “นา” เบา ๆ รักษาลมตอนโน้ตยาวข้ามเสียงคอร์ดในห้องท้าย', 78, 4, [
    ['I', [null, 1], 4, 7, 9], ['vi', [7, 1.5], [4, 0.5], [4, 2]], ['IV', 5, 7, [9, 2]], ['V', 7, 4, [2, 2]],
    ['I', 4, 7, [12, 2]], ['vi', 9, 7, [4, 2]], ['IV', [5, 1.5], [4, 0.5], 2, 0], ['I', [0, 4]],
  ]),
  etude('new-morning', 'pop', 'intermediate', 'เช้าวันใหม่', 'ร้อง “อา” ให้ชัดตอนขึ้นโน้ตสูง ปล่อยลมต่อเนื่องในโน้ตจบ', 88, 4, [
    ['IV', 5, 7, 9, 12], ['I', [11, 0.5], [9, 0.5], 7, [4, 2]], ['ii', 5, 7, 9, 5], ['V', 7, 4, [2, 2]],
    ['IV', 5, [7, 0.5], [9, 0.5], [12, 2]], ['V', 11, 9, [7, 2]], ['I', [4, 1.5], [2, 0.5], [0, 2]], ['I', [0, 3], [null, 1]],
  ]),
  etude('blue-hour', 'soul', 'intermediate', 'Blue Hour', 'ร้อง “อู” ให้ตรงกับจังหวะเข้าหลังพักครึ่งจังหวะ แล้วค่อยเปลี่ยนเป็น “อา” ที่โน้ตท้าย', 76, 4, [
    ['Imaj7', [null, 0.5], [4, 0.5], 7, [9, 2]], ['vi7', [7, 0.5], [4, 0.5], [3, 0.5], [2, 0.5], [0, 2]],
    ['ii7', 2, [5, 0.5], [7, 0.5], [9, 2]], ['V7', [7, 1.5], [5, 0.5], [2, 2]],
  ]),
  etude('velvet-pocket', 'soul', 'advanced', 'Velvet Pocket', 'ร้อง “เย” คำเดียวในลูกเลี้ยวสั้น ๆ แล้วลงโน้ตหลักพร้อมคอร์ดสุดท้าย', 82, 4, [
    ['IVmaj7', [null, 0.5], [9, 0.5], [12, 1.5], [11, 0.5], 9], ['V7', [7, 1.5], [9, 0.5], [10, 0.5], [9, 0.5], 7],
    ['Imaj7', [4, 2], [7, 0.5], [9, 0.5], 11], ['vi7', [12, 1.5], [9, 0.5], 7, 4],
    ['ii7', 5, [7, 0.5], [9, 0.5], [12, 2]], ['V7', [10, 0.5], [9, 0.5], [7, 0.5], [5, 0.5], [2, 2]],
    ['Imaj7', 4, [3, 0.5], [2, 0.5], [0, 2]], ['Imaj7', [0, 4]],
  ]),
  etude('answer-me', 'soul', 'advanced', 'Answer Me', 'ร้อง “อา” ให้เป็นประโยคถาม–ตอบ ทิ้งช่องว่างหลังแต่ละวลีและเข้าตามจังหวะยก', 86, 4, [
    ['vi7', [null, 0.5], [7, 0.5], [9, 0.5], [12, 0.5], [9, 1.5], [null, 0.5]],
    ['IVmaj7', [null, 0.5], [5, 0.5], [7, 0.5], [9, 0.5], [7, 1.5], [null, 0.5]],
    ['ii7', 5, [4, 0.5], [5, 0.5], [7, 0.5], [9, 0.5], 12], ['V7', 11, 9, [7, 0.5], [5, 0.5], 2],
    ['Imaj7', [4, 1.5], [3, 0.5], 2, 0], ['Imaj7', [0, 4]],
  ]),
  etude('river-path', 'folk', 'beginner', 'ทางเลียบแม่น้ำ', 'ร้อง “ลา” แบบเล่าเรื่อง นับหนึ่งเบา ๆ ในใจทุกห้องของจังหวะสาม', 92, 3, [
    ['I', 0, 2, 4], ['IV', 5, [4, 2]], ['I', 4, 7, 4], ['V', 2, [7, 2]], ['IV', 9, 7, 5], ['I', 4, 2, 0], ['V', [2, 3]], ['I', [0, 3]],
  ]),
  etude('open-fields', 'folk', 'beginner', 'ทุ่งกว้าง', 'ฮัมก่อนหนึ่งรอบ แล้วร้อง “อา” ใช้เสียงเบาและเก็บลมให้พอสำหรับโน้ตจบ', 84, 4, [
    ['I', 0, 4, [7, 2]], ['IV', [9, 2], 7, 5], ['I', 4, 2, 0, 4], ['V', 2, [7, 3]],
    ['IV', 5, 7, [9, 2]], ['I', 7, 4, [2, 2]], ['V', [2, 3], [null, 1]], ['I', [0, 4]],
  ]),
  etude('amazing-grace', 'classics', 'beginner', 'Amazing Grace', 'ร้อง “อา” นุ่ม ๆ เริ่มก่อนจังหวะหนึ่งแล้วพาเสียงไปตามวลี', 76, 3, [
    ['I', [null, 2], 0], ['IV', [5, 2], 9], ['IV', [5, 2], 9], ['IV', [7, 2], 5],
    ['I', [2, 2], 0], ['IV', [5, 2], 9], ['IV', [5, 2], 9], ['I', [7, 3]],
  ]),
  etude('greensleeves', 'classics', 'intermediate', 'Greensleeves', 'ร้อง “ลู” ตามจังหวะประจุด ให้โน้ตสั้นหลังจังหวะประจุดคมชัด', 96, 3, [
    ['i', [null, 2], 0], ['III', [3, 2], 5], ['bVII', [7, 1.5], [8, 0.5], 7], ['iv', [5, 2], 2],
    ['i', [0, 1.5], [2, 0.5], 3], ['bVI', [5, 2], 0], ['i', [0, 1.5], [2, 0.5], 0], ['i', [0, 3]],
  ]),
  etude('scarborough-fair', 'classics', 'intermediate', 'Scarborough Fair', 'ร้อง “นา” ให้เสียงนิ่งในวลียาว แล้วไล่โน้ตลงอย่างนุ่มนวล', 94, 3, [
    ['i', [0, 2], 0], ['i', 7, 7, 7], ['iv', 2, 3, 2], ['i', [0, 3]],
    ['III', [7, 2], 10], ['bVII', 12, 10, 7], ['iv', 9, 5, 3], ['i', [0, 3]],
  ]),
  etude('ode-to-joy', 'classics', 'beginner', 'Ode to Joy', 'ร้อง “ลา” ให้โน้ตที่ซ้ำกันมีระดับเสียงเท่ากัน และระวังจังหวะประจุดท้ายวลี', 92, 4, [
    ['I', 4, 4, 5, 7], ['I', 7, 5, 4, 2], ['IV', 0, 0, 2, 4], ['V', [4, 1.5], [2, 0.5], [2, 2]],
    ['I', 4, 4, 5, 7], ['I', 7, 5, 4, 2], ['IV', 0, 0, 2, 4], ['I', [2, 1.5], [0, 0.5], [0, 2]],
  ]),
]

export type Etude = typeof etudes[number]

export function buildEtude(exercise: Etude, bpm: number, root: number): VocalPlan {
  const beat = 60 / bpm
  const targets: Target[] = []
  const backing: PianoCue[] = []
  for (const [index, [chord, ...steps]] of exercise.bars.entries()) {
    const start = index * exercise.beatsPerBar * beat
    const notes = harmonies[chord].map(offset => {
      const belowMelody = root - 12 + offset % 12
      return belowMelody < 21 ? belowMelody + 12 : belowMelody
    })
    const bass = notes[0] - 12 < 21 ? notes[0] : notes[0] - 12
    const harmony = bass === notes[0] ? notes.slice(1) : notes
    for (const [onset, length, voicing] of backingStyles[exercise.group]) {
      backing.push({
        at: start + onset * beat, duration: length * beat,
        notes: voicing === 'bass' ? [bass] : voicing === 'chord' ? harmony : [bass, ...harmony],
      })
    }
    let time = start
    for (const step of steps) {
      const [offset, beats] = typeof step === 'number' ? [step, 1] : step
      const end = time + beats * beat
      if (offset !== null) targets.push({ start: time, end, from: root + offset, to: root + offset })
      time = end
    }
  }
  return { root, span: exercise.span, beat, beatsPerBar: exercise.beatsPerBar, targets, backing,
    duration: exercise.bars.length * exercise.beatsPerBar * beat }
}
