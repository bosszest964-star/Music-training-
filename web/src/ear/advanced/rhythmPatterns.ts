import { exerciseMetadata } from '../exerciseMetadata'
import type { ExerciseDifficulty } from '../exerciseMetadata'

type RhythmRow = readonly [id: string, label: string, bpm: number, taps: readonly number[], bars?: number]
const triplet = 1 / 3

function patterns(difficulty: ExerciseDifficulty, rows: readonly RhythmRow[]) {
  return rows.map(([id, label, bpm, taps, bars = 1]) => ({
    ...exerciseMetadata('rhythm', id, difficulty), label, bpm, taps, beats: bars * 4,
  }))
}

export const rhythmPatterns = [
  ...patterns('beginner', [
    ['four-quarters', 'ตัวดำสี่จังหวะ', 62, [0, 1, 2, 3]],
    ['alternating-rest', 'ตัวดำสลับตัวหยุด', 64, [0, 2]],
    ['first-rest', 'ตัวหยุดนำและตัวดำ', 66, [1, 2, 3]],
    ['last-rest', 'หยุดจังหวะสุดท้าย', 70, [0, 1, 2]],
    ['pair-eighths', 'คู่เขบ็ตหนึ่งชั้น', 66, [0, 1, 2, 2.5, 3]],
    ['swapped-eighths', 'เขบ็ตหนึ่งชั้นต้นห้อง', 70, [0, 0.5, 1, 2, 3, 3.5]],
    ['even-eighths', 'เขบ็ตหนึ่งชั้นต่อเนื่อง', 72, [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]],
  ]),
  ...patterns('intermediate', [
    ['dotted-quarter', 'ตัวดำประจุดกับเขบ็ตหนึ่งชั้น', 72, [0, 1.5, 2, 3.5]],
    ['dotted-eighth', 'เขบ็ตหนึ่งชั้นประจุด', 68, [0, 0.75, 1, 2, 2.75, 3]],
    ['sixteenths', 'เขบ็ตสองชั้นหนึ่งกลุ่ม', 72, [0, 1, 1.25, 1.5, 1.75, 2, 3]],
    ['eighth-sixteenth', 'เขบ็ตหนึ่งชั้นผสมสองชั้น', 76, [0, 0.5, 0.75, 1, 2, 2.75, 3, 3.5]],
    ['dotted-silence', 'จังหวะประจุดสองห้อง', 78, [0, 1.5, 2, 3, 4, 4.75, 5, 6.5, 7.5], 2],
    ['offbeat-eighths', 'เขบ็ตหนึ่งชั้นบนจังหวะยก', 80, [0.5, 1.5, 2.5, 3.5]],
    ['sixteenth-rest', 'เขบ็ตสองชั้นกับช่องหยุด', 82, [0, 0.25, 0.75, 1.5, 2, 2.25, 3.25, 3.75]],
  ]),
  ...patterns('advanced', [
    ['triplet-intro', 'สามพยางค์สลับตัวดำ', 78, [0, 1, 1 + triplet, 1 + 2 * triplet, 2, 3]],
    ['triplet-stream', 'สามพยางค์ต่อเนื่อง', 82, Array.from({ length: 12 }, (_, index) => index * triplet)],
    ['eighth-triplet', 'สลับสามพยางค์กับเขบ็ตหนึ่งชั้น', 86, [0, triplet, 2 * triplet, 1, 1.5, 2, 2 + triplet, 2 + 2 * triplet, 3, 3.5]],
    ['syncopation', 'จังหวะขัดระหว่างจังหวะหลัก', 90, [0, 0.75, 1.5, 2.25, 2.75, 3.5]],
    ['syncopation-two', 'จังหวะขัดสองห้อง', 94, [0, 0.75, 1.5, 2, 2.75, 3.5, 4.25, 4.75, 5.5, 6, 6.75, 7.5], 2],
    ['mixed-finale', 'สามพยางค์ เขบ็ต และจังหวะขัด', 98, [0, 0.5, 1, 1 + triplet, 1 + 2 * triplet, 2.75, 3.25, 3.5, 4, 4.75, 5.5, 6, 6 + triplet, 6 + 2 * triplet, 7.5], 2],
  ]),
]

export type RhythmPattern = typeof rhythmPatterns[number]
