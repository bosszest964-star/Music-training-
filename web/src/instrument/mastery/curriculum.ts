import { exerciseMetadata } from '../../exerciseMetadata'
import type { ExerciseDifficulty } from '../../exerciseMetadata'
import { buildSong } from '../songs'
import type { PianoHand, PianoNote } from '../songs'

export const pianoGroups = {
  basics: 'พื้นฐานวางนิ้ว',
  dexterity: 'ไล่นิ้วสไตล์ Hanon',
  scales: 'สเกลและอาร์เพจจิโอ',
  coordination: 'ฝึกสองมือ',
  repertoire: 'เพลงบรรเลงและคลาสสิก',
} as const

type Group = keyof typeof pianoGroups
type Step = number | readonly number[]
type Beat = readonly [notes: Step, beats: number]
type Chart = readonly (number | Beat)[]
type TimedNote = PianoNote & { time: number }

function phrase(chart: Chart, beat: number, hand?: PianoHand): TimedNote[] {
  let time = 0
  return chart.flatMap(step => {
    const [pitches, length] = typeof step === 'number' ? [step, 1] : step
    const onset = time
    time += length * beat
    return (typeof pitches === 'number' ? [pitches] : pitches).map(midi => ({
      midi, time: onset, duration: length * beat * 0.88, hand,
    }))
  })
}

function lesson(id: string, group: Group, difficulty: ExerciseDifficulty, title: string, credit: string, bpm: number,
  melody: Chart, bass?: Chart) {
  const notes = phrase(melody, 60 / bpm, bass ? 'right' : undefined)
  if (bass) notes.push(...phrase(bass, 60 / bpm, 'left'))
  return { ...buildSong(title, credit, notes), ...exerciseMetadata('instrument-piano', id, difficulty), group, bpm, hands: !!bass }
}

function steps(root: number, offsets: readonly number[]) {
  return offsets.map(offset => root + offset)
}

function scale(root: number, intervals: readonly number[]): Chart {
  const notes = steps(root, intervals)
  return [...notes.slice(0, -1), [notes[notes.length - 1], 2], ...notes.slice(1, -1).reverse(), [root, 2]]
}

function hanon(pattern: readonly number[], roots: readonly number[]): Chart {
  return roots.flatMap(root => steps(root, pattern).map(note => [note, .5] as const))
}

const twinkle: Chart = [
  60, 60, 67, 67, 69, 69, [67, 2], 65, 65, 64, 64, 62, 62, [60, 2],
  67, 67, 65, 65, 64, 64, [62, 2], 67, 67, 65, 65, 64, 64, [62, 2],
  60, 60, 67, 67, 69, 69, [67, 2], 65, 65, 64, 64, 62, 62, [60, 2],
]
const fourChords: Chart = [[[48, 52, 55], 4], [[43, 47, 50], 4], [[45, 48, 52], 4], [[41, 45, 48], 4]]

export const pianoCurriculum = [
  lesson('five-fingers', 'basics', 'beginner', 'วางนิ้วขวา 5 โน้ต', 'วางนิ้วโป้งบน C4 แล้วใช้นิ้ว 1–2–3–4–5 ขึ้นและลง', 66,
    [60, 62, 64, 65, [67, 2], 65, 64, 62, [60, 2], 60, 64, 67, 64, [60, 2]]),
  lesson('left-fingers', 'basics', 'beginner', 'วางนิ้วซ้าย 5 โน้ต', 'วางนิ้วก้อยบน C3 แล้วใช้นิ้ว 5–4–3–2–1', 64,
    [48, 50, 52, 53, [55, 2], 53, 52, 50, [48, 2], 55, 52, 50, 48, [48, 2]]),
  lesson('repeat-and-rest', 'basics', 'beginner', 'โน้ตซ้ำและช่องพัก', 'ยกลิ่มให้สุดในแต่ละครั้งและรักษาจังหวะเมื่อมีช่องว่าง', 66,
    [60, 60, [[], 1], 62, 62, 64, [[], 1], [64, 2], 65, 65, [[], 1], 64, 62, [60, 2]]),
  lesson('black-keys', 'basics', 'beginner', 'รู้จักลิ่มดำ', 'ใช้กลุ่มลิ่มดำสองและสามตัวเป็นจุดสังเกตมือ', 64,
    [61, 63, 61, 60, 66, 68, 70, 68, 66, 65, 63, 61, [60, 2]]),
  lesson('two-note-shapes', 'basics', 'beginner', 'จับคู่เสียงด้วยมือขวา', 'ฝึกกดลิ่มสองตัวให้พร้อมกันโดยใช้มือเดียว', 68,
    [[[60, 64], 2], [[62, 65], 2], [[64, 67], 2], [[65, 69], 2], [[64, 67], 2], [[62, 65], 2], [[60, 64], 3]]),
  lesson('twinkle', 'basics', 'beginner', 'Twinkle Twinkle', 'ทำนองดั้งเดิม · ฝึกสลับนิ้วกับจังหวะโน้ตยาว', 86, twinkle),

  lesson('hanon-one', 'dexterity', 'intermediate', 'Hanon · กระโดดนิ้วแรก', 'เว้นขั้นจากนิ้วแรกแล้วไล่โน้ตต่อเนื่อง', 70, hanon([0, 4, 5, 7, 9, 7, 5, 4], [60, 62, 64, 62, 60])),
  lesson('hanon-two', 'dexterity', 'intermediate', 'Hanon · สลับนิ้ว 3–4', 'รักษาน้ำหนักโน้ตสลับให้เท่ากัน', 72, hanon([0, 2, 5, 4, 5, 7, 5, 4], [60, 62, 65, 62, 60])),
  lesson('hanon-three', 'dexterity', 'intermediate', 'Hanon · นิ้วนางและนิ้วก้อย', 'คลายข้อมือเมื่อต้องเล่นโน้ตสูงติดกัน', 68, hanon([0, 2, 4, 7, 9, 7, 9, 7], [55, 57, 60, 62, 60, 55])),
  lesson('hanon-four', 'dexterity', 'intermediate', 'Hanon · ไล่ย้อนมือซ้าย', 'ให้มือซ้ายเล่นสม่ำเสมอทั้งขาลงและขาขึ้น', 70, hanon([9, 7, 5, 2, 0, 2, 5, 7], [48, 50, 53, 50, 48])),
  lesson('hanon-five', 'dexterity', 'advanced', 'Hanon · วนกลุ่มสี่โน้ต', 'ใช้การเคลื่อนข้อมือเล็กน้อยเพื่อเปลี่ยนตำแหน่ง', 84, hanon([0, 2, 4, 5, 2, 4, 5, 7], [60, 62, 65, 67, 65, 62, 60])),
  lesson('hanon-six', 'dexterity', 'advanced', 'Hanon · ข้ามนิ้วและถอยกลับ', 'คุมเขบ็ตตอนข้ามตำแหน่งและลงกลับ', 88, hanon([0, 5, 2, 7, 4, 9, 7, 4], [60, 62, 64, 65, 67, 65, 64, 62, 60])),

  lesson('c-major', 'scales', 'beginner', 'ไล่สเกล C เมเจอร์', 'หนึ่งอ็อกเทฟ · ฝึกสอดนิ้วโป้งตอนขึ้นและตอนลง', 82, scale(60, [0, 2, 4, 5, 7, 9, 11, 12])),
  lesson('a-minor', 'scales', 'beginner', 'A Natural Minor', 'หนึ่งอ็อกเทฟ · ลองฟังสีเสียงของไมเนอร์ธรรมชาติ', 82, scale(57, [0, 2, 3, 5, 7, 8, 10, 12])),
  lesson('g-pentatonic', 'scales', 'intermediate', 'G Major Pentatonic', 'ฝึกขึ้นลงห้าเสียงแล้วจบที่โน้ตหลัก', 86, scale(55, [0, 2, 4, 7, 9, 12])),
  lesson('a-blues', 'scales', 'intermediate', 'A Blues Scale', 'ฟังเสียง ♭5 แล้วฝึกกลับลงอย่างต่อเนื่อง', 76, scale(57, [0, 3, 5, 6, 7, 10, 12])),
  lesson('major-arpeggio', 'scales', 'intermediate', 'C Major Arpeggio', 'กระจายนิ้วขึ้นสองอ็อกเทฟ วางมือก่อนเปลี่ยนช่วง', 74, scale(48, [0, 4, 7, 12, 16, 19, 24])),
  lesson('minor-arpeggio', 'scales', 'advanced', 'D Minor Arpeggio', 'กระจายคอร์ดไมเนอร์และฝึกกลับลงสองอ็อกเทฟ', 80, scale(50, [0, 3, 7, 12, 15, 19, 24])),

  lesson('pop-chords', 'coordination', 'beginner', 'ทางคอร์ดป๊อป I–V–vi–IV', 'ซ้ายคุม C–G–Am–F · ขวาเล่นวลีสี่ห้อง', 72,
    [64, 67, [72, 2], 71, 67, [62, 2], 64, 69, [72, 2], 69, 65, [60, 2]], fourChords),
  lesson('waltz', 'coordination', 'beginner', 'วอลทซ์ซ้ายสามจังหวะ', 'ซ้ายลงเบสแล้วกดคอร์ดซ้ำ ขวารักษาโน้ตยาว', 84,
    [64, 67, 72, [71, 3], 69, 67, 65, [64, 3]],
    [48, [[52, 55], 1], [[52, 55], 1], 43, [[50, 55], 1], [[50, 55], 1], 41, [[48, 53], 1], [[48, 53], 1], 48, [[52, 55], 1], [[52, 55], 1]]),
  lesson('minor-answer', 'coordination', 'intermediate', 'ทำนองถามตอบใน A minor', 'ซ้ายเปลี่ยนคอร์ดตรงจังหวะหนึ่ง ขวาเว้นช่องก่อนตอบ', 78,
    [69, 72, [76, 2], [[], 1], 74, 72, 69, 71, 68, [64, 2], [69, 4]],
    [[[45, 48, 52], 4], [[41, 45, 48], 4], [[40, 47, 56], 4], [[45, 48, 52], 4]]),
  lesson('broken-left', 'coordination', 'intermediate', 'ขวาลากเสียง ซ้ายกระจายคอร์ด', 'ให้มือซ้ายเดินสม่ำเสมอใต้ทำนองขวา', 82,
    [[72, 3], 74, [76, 3], 74, [72, 2], [69, 2], [67, 4]],
    [48, 52, 55, 52, 43, 50, 55, 50, 45, 48, 52, 48, 41, 48, 53, 48]),
  lesson('offbeat-melody', 'coordination', 'advanced', 'ซ้ายลงหนึ่ง ขวาขัดจังหวะ', 'รักษาคอร์ดให้ตรงจังหวะตอนทำนองเข้าครึ่งจังหวะ', 78,
    [[[], .5], [64, .5], [67, 1.5], [69, .5], 67, [[], .5], [62, .5], [67, 1.5], [71, .5], 69,
      [[], .5], [64, .5], [69, 1.5], [72, .5], 69, 65, 64, [60, 2]], fourChords),
  lesson('countermotion', 'coordination', 'advanced', 'สองมือสวนทางและลงคอร์ด', 'ซ้ายเดินเบสสวนทางกับขวาและลงคอร์ดพร้อมกันท้ายวลี', 80,
    [60, 62, 64, 65, 67, 69, 71, 72, 71, 69, 67, 65, 64, 62, [[60, 64], 2]],
    [55, 53, 52, 50, 48, 47, 45, 43, 45, 47, 48, 50, 52, 53, [[48, 55], 2]]),

  lesson('ode-to-joy', 'repertoire', 'beginner', 'Ode to Joy', 'Ludwig van Beethoven · ทำนองช่วงต้น', 96, [
    64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64, [64, 1.5], [62, .5], [62, 2],
    64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64, [62, 1.5], [60, .5], [60, 2],
  ]),
  lesson('fur-elise', 'repertoire', 'intermediate', 'Für Elise', 'Ludwig van Beethoven · เรียบเรียงท่อนหลัก', 72, [
    [76,.5], [75,.5], [76,.5], [75,.5], [76,.5], [71,.5], [74,.5], [72,.5], [69,1.5],
    [60,.5], [64,.5], [69,.5], [71,1.5], [64,.5], [68,.5], [71,.5], [72,1.5],
    [64,.5], [76,.5], [75,.5], [76,.5], [75,.5], [76,.5], [71,.5], [74,.5], [72,.5],
    [69,1.5], [60,.5], [64,.5], [69,.5], [71,1.5], [64,.5], [72,.5], [71,.5], [69,2],
  ]),
  lesson('canon', 'repertoire', 'intermediate', 'Canon in D', 'Johann Pachelbel · ฝึกทำนองกับทางเบส D–A–Bm–F♯m–G–D–G–A', 70,
    [[78, 2], [76, 2], [74, 2], [73, 2], [71, 2], [69, 2], [71, 2], [73, 2],
      74, 78, 76, 73, 74, 71, 73, 69, 71, 74, 69, 66, 67, 71, 69, 67],
    [[50, 2], [45, 2], [47, 2], [42, 2], [43, 2], [50, 2], [43, 2], [45, 2],
      [50, 2], [45, 2], [47, 2], [42, 2], [43, 2], [50, 2], [43, 2], [45, 2]]),
  lesson('minuet', 'repertoire', 'intermediate', 'Minuet in G', 'Christian Petzold · ทำนองช่วงต้น', 108,
    [74, [67,.5], [69,.5], [71,.5], [72,.5], 74, 67, 67, 76, [72,.5], [74,.5], [76,.5], [78,.5], 79, 67, 67,
      72, [74,.5], [72,.5], [71,.5], [69,.5], 71, [72,.5], [71,.5], [69,.5], [67,.5], 66, [67,.5], [69,.5], [71,.5], [67,.5], [69,3]]),
  lesson('moonlight', 'repertoire', 'advanced', 'Moonlight Sonata', 'Ludwig van Beethoven · อาร์เพจจิโอช่วงเปิดท่อนแรก', 52,
    [[56,1/3],[61,1/3],[64,1/3],[56,1/3],[61,1/3],[64,1/3],[56,1/3],[61,1/3],[64,1/3],[56,1/3],[61,1/3],[64,1/3],
      [56,1/3],[61,1/3],[64,1/3],[56,1/3],[61,1/3],[64,1/3],[56,1/3],[61,1/3],[64,1/3],[56,1/3],[61,1/3],[64,1/3],
      [57,1/3],[61,1/3],[64,1/3],[57,1/3],[61,1/3],[64,1/3],[57,1/3],[62,1/3],[66,1/3],[57,1/3],[62,1/3],[66,1/3]],
    [[[37,49],4], [[35,47],4], [[33,45],2], [[30,42],2]]),
  lesson('korobeiniki', 'repertoire', 'intermediate', 'Korobeiniki', 'เพลงพื้นบ้านรัสเซีย · เรียบเรียงจากทำนองดั้งเดิม', 108,
    [[76,2], [71,.5], [72,.5], 74, [72,.5], [71,.5], [69,2], [69,.5], [72,.5], [76,2], [74,.5], [72,.5],
      [71,1.5], [72,.5], [74,2], [76,2], [72,2], [69,2], [69,2]]),
  lesson('jazz-boogie', 'repertoire', 'advanced', 'Jazz Boogie', 'บทฝึกแต่งใหม่ · ซ้ายเดินเบส ขวาเล่นวลีบลูส์', 96,
    [67, [70,.67], [67,.33], 64, 67, 65, [68,.67], [65,.33], 60, 67, [70,.67], [72,.33], 70, 67, [64,.67], [63,.33], 60, [60,2]],
    [48,52,55,57,53,57,60,62,48,52,55,57,43,47,50,53,[48,2]]),
  lesson('pop-ballad-theme', 'repertoire', 'intermediate', 'Pop Ballad Theme', 'บทฝึกแต่งใหม่ · คงทำนองให้เด่นเหนือคอร์ดซ้าย', 74,
    [72, 74, [76, 2], [74, 1.5], [72, .5], [67, 2], 69, 72, [76, 2], 77, 76, [72, 2],
      72, 74, [76, 2], 79, 76, [74, 2], 72, 69, [72, 2], 69, 67, [72, 2]], [...fourChords, ...fourChords]),
]

export const pianoById = new Map(pianoCurriculum.map(exercise => [exercise.id, exercise]))
