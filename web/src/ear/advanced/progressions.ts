import { noteLabel } from '../../audio/pitch'
import { exerciseMetadata, sampleDistinct } from '../exerciseMetadata'
import type { ExerciseDifficulty } from '../exerciseMetadata'

const harmonies = {
  I: [0, [0, 4, 7], ''],
  ii: [2, [0, 3, 7], 'm'],
  iii: [4, [0, 3, 7], 'm'],
  IV: [5, [0, 4, 7], ''],
  V: [7, [0, 4, 7], ''],
  vi: [9, [0, 3, 7], 'm'],
  iv: [5, [0, 3, 7], 'm'],
  Imaj7: [0, [0, 4, 7, 11], 'maj7'],
  ii7: [2, [0, 3, 7, 10], 'm7'],
  iii7: [4, [0, 3, 7, 10], 'm7'],
  IVmaj7: [5, [0, 4, 7, 11], 'maj7'],
  V7: [7, [0, 4, 7, 10], '7'],
  vi7: [9, [0, 3, 7, 10], 'm7'],
  VI7: [9, [0, 4, 7, 10], '7'],
} as const

export type RomanChord = keyof typeof harmonies
type Pattern = readonly [id: string, chords: readonly RomanChord[], genre: string, hint: string]

function patterns(difficulty: ExerciseDifficulty, rows: readonly Pattern[]) {
  return rows.map(([id, chords, genre, hint]) => ({
    ...exerciseMetadata('progression', id, difficulty), chords, genre, hint, label: chords.join('–'),
  }))
}

export const progressions = [
  ...patterns('beginner', [
    ['pop', ['I', 'V', 'vi', 'IV'], 'Pop / Pop Rock', 'ฟัง V พาไป vi ก่อนจบที่ IV'],
    ['doo-wop', ['I', 'vi', 'IV', 'V'], 'Doo-wop / Pop ยุค 50s', 'vi ตามหลัง I ทันที และ V ปิดวลี'],
    ['cadence', ['I', 'IV', 'V', 'I'], 'Folk / เพลงพื้นบ้าน', 'คอร์ดหลัก IV–V ส่งกลับมาพักที่ I'],
    ['minor-start', ['vi', 'IV', 'I', 'V'], 'Pop / Alternative', 'เริ่มจาก vi ซึ่งให้สีไมเนอร์ในคีย์เมเจอร์'],
    ['folk', ['I', 'IV', 'I', 'V'], 'Folk / Country', 'สลับกลับมาที่ I ก่อนจบด้วย V'],
    ['gospel-pop', ['I', 'V', 'IV', 'I'], 'Gospel Pop / Rock', 'V ลงมาที่ IV ก่อนกลับบ้านที่ I'],
  ]),
  ...patterns('intermediate', [
    ['two-five-one', ['ii', 'V', 'I'], 'Acoustic / Jazz Standard', 'ii เตรียมแรงดึงของ V ก่อนคลายที่ I'],
    ['descending', ['I', 'V', 'vi', 'iii', 'IV'], 'Acoustic / Pop Ballad', 'หลัง vi จะผ่าน iii ก่อนถึง IV'],
    ['royal-road', ['IV', 'V', 'iii', 'vi'], 'J-Pop / ป๊อปญี่ปุ่น', 'IV และ V ส่งไป iii แล้วลงที่ vi'],
    ['rock', ['I', 'IV', 'vi', 'V'], 'Pop Rock / Alternative', 'IV มาถึงก่อน vi และ V ค้างท้ายวลี'],
    ['turnaround', ['I', 'vi', 'ii', 'V'], 'Acoustic Pop / Jazz', 'ii ตามหลัง vi ทำให้ช่วง ii–V เชื่อมกลับต้นวลีได้'],
    ['lift', ['IV', 'I', 'V', 'vi'], 'Indie Pop / Rock', 'เริ่มที่ IV แล้วลงท้ายด้วย vi หลัง V'],
  ]),
  ...patterns('advanced', [
    ['secondary-dominant', ['ii7', 'V7', 'Imaj7', 'VI7'], 'Jazz / Neo-soul', 'VI7 เป็นคอร์ดโดมิแนนต์รองที่พากลับไป ii7'],
    ['jazz-turnaround', ['Imaj7', 'vi7', 'ii7', 'V7'], 'Jazz / R&B', 'เสียงเซเว่นเชื่อมจาก Imaj7 ผ่าน vi7 และ ii7 ไป V7'],
    ['borrowed-four', ['Imaj7', 'IVmaj7', 'iv', 'Imaj7'], 'Soul / Indie Pop', 'ฟังตัวสามของ IV ลดครึ่งเสียงเป็น iv ยืมจากคีย์ไมเนอร์ขนาน'],
    ['secondary-turnaround', ['Imaj7', 'VI7', 'ii7', 'V7'], 'Swing / Jazz Standard', 'เปรียบเทียบ VI7 เมเจอร์โดมิแนนต์กับ vi7 ไมเนอร์'],
    ['cycle', ['iii7', 'VI7', 'ii7', 'V7'], 'Jazz / R&B', 'เบสเดิน iii–VI–ii–V เป็นวงคู่ห้า'],
    ['soul-step', ['IVmaj7', 'iii7', 'ii7', 'V7'], 'Soul / R&B', 'สามคอร์ดแรกไล่ลงทีละขั้นก่อนขึ้นไป V7'],
  ]),
]

export type Progression = typeof progressions[number]

export function chordVoicing(tonic: number, chord: RomanChord) {
  const [root, intervals, suffix] = harmonies[chord]
  const bass = tonic + root
  const upper = intervals.map(interval => 55 + (bass + interval - 55 + 24) % 12)
  const name = noteLabel(bass).replace(/\d+$/, '') + suffix
  return { name, notes: [bass - 12, ...upper.sort((a, b) => a - b)] }
}

export function progressionQuestion(difficulty: ExerciseDifficulty, previous?: Progression, previousTonic?: number) {
  const pool = progressions.filter(item => item.difficulty === difficulty)
  const [correct] = sampleDistinct(pool.filter(item => item !== previous), 1)
  const options = sampleDistinct([correct, ...sampleDistinct(pool.filter(item => item !== correct), 3)], 4)
  const keys = Array.from({ length: 12 }, (_, index) => 48 + index).filter(key => key !== previousTonic)
  const [tonic] = sampleDistinct(keys, 1)
  return { correct, options, tonic }
}
