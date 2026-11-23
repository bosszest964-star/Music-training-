import { advancedCategories } from './exerciseMetadata'

export const topics = {
  degree: 'หน้าที่โน้ตในคีย์',
  interval: 'ขั้นคู่เสียง',
  chord: 'ชนิดคอร์ด',
  eq: 'ย่านความถี่ EQ',
  ...advancedCategories,
} as const

export type Topic = keyof typeof topics
export type PitchGame = 'degree' | 'harmony'
export type Difficulty = 'beginner' | 'diatonic' | 'chromatic'
export type HarmonyMode = 'mixed' | 'melodic' | 'harmonic' | 'chord'

export interface Choice {
  id: string
  label: string
  detail: string
  explanation: string
}

interface Cue {
  notes: readonly number[]
  at: number
  duration: number
  cents?: number
}

export type Sound = { cues: Cue[] }

export interface Question {
  topic: Topic
  choices: Choice[]
  correct: Choice
  prompt: string
  context: string
  sound: Sound
}

const degrees = [
  [0, '1', 'โด', 'โทนิก เป็นจุดพักและศูนย์กลางของคีย์'],
  [1, '♭2', 'เรแฟลต', 'อยู่สูงกว่าโดครึ่งเสียง ให้แรงดึงกลับลงหาโดชัดเจน'],
  [2, '2', 'เร', 'อยู่เหนือโดหนึ่งเสียงเต็ม ลองฟังแรงเคลื่อนลงหาโดหรือขึ้นหามี'],
  [3, '♭3', 'มีแฟลต', 'ลดขั้นที่ 3 ลงครึ่งเสียง ให้สีไมเนอร์ทับพื้นคีย์เมเจอร์'],
  [4, '3', 'มี', 'เป็นเสียงขั้นสามในคอร์ดโทนิกที่ให้สีเมเจอร์'],
  [5, '4', 'ฟา', 'เป็นรากของคอร์ด IV และอยู่สูงกว่ามีครึ่งเสียง'],
  [6, '♯4', 'ฟาชาร์ป', 'อยู่ต่ำกว่าซอลครึ่งเสียง และมักให้ความรู้สึกดึงขึ้นหาซอล'],
  [7, '5', 'ซอล', 'เป็นเสียงขั้นห้าของโทนิกและรากของคอร์ด V'],
  [8, '♭6', 'ลาแฟลต', 'ให้สีจากไมเนอร์และอยู่สูงกว่าซอลครึ่งเสียง'],
  [9, '6', 'ลา', 'อยู่เหนือซอลหนึ่งเสียงเต็ม และเป็นรากของคอร์ด vi'],
  [10, '♭7', 'ทีแฟลต', 'อยู่ต่ำกว่าโดหนึ่งเสียงเต็ม ให้สีแบบมิกโซลิเดียนในคีย์เมเจอร์'],
  [11, '7', 'ที', 'เป็นเสียงนำที่อยู่ต่ำกว่าโดครึ่งเสียง ลองฟังแรงดึงขึ้นหาโด'],
] as const

const intervals = [
  [1, 'm2', 'คู่สองไมเนอร์', 'ห่างครึ่งเสียง ฟังชิดและเสียดกันชัดเมื่อเล่นพร้อมกัน'],
  [2, 'M2', 'คู่สองเมเจอร์', 'ห่างหนึ่งเสียงเต็ม ลองนึกถึงการเดินจากโดไปเร'],
  [3, 'm3', 'คู่สามไมเนอร์', 'เป็นคู่เสียงที่ให้สีไมเนอร์ เช่น โดไปมีแฟลต'],
  [4, 'M3', 'คู่สามเมเจอร์', 'เป็นคู่เสียงที่ให้สีเมเจอร์ เช่น โดไปมี'],
  [5, 'P4', 'คู่สี่เพอร์เฟกต์', 'ให้เสียงเปิดและเหมือนค้างไว้ เช่น โดไปฟา'],
  [6, 'TT', 'ไตรโทน', 'ห่างสามเสียงเต็ม ให้แรงตึงเด่น เช่น โดไปฟาชาร์ป'],
  [7, 'P5', 'คู่ห้าเพอร์เฟกต์', 'ให้เสียงเปิดและมั่นคง เช่น โดไปซอล'],
  [8, 'm6', 'คู่หกไมเนอร์', 'กว้างกว่าคู่ห้าครึ่งเสียง เช่น โดไปลาแฟลต'],
  [9, 'M6', 'คู่หกเมเจอร์', 'กว้างกว่าคู่ห้าหนึ่งเสียงเต็ม เช่น โดไปลา'],
  [10, 'm7', 'คู่เจ็ดไมเนอร์', 'อยู่ต่ำกว่าคู่อ็อกเทฟหนึ่งเสียงเต็ม เช่น โดไปทีแฟลต'],
  [11, 'M7', 'คู่เจ็ดเมเจอร์', 'อยู่ต่ำกว่าคู่อ็อกเทฟครึ่งเสียง ให้เสียงตึงเมื่อดังพร้อมกัน'],
  [12, 'P8', 'อ็อกเทฟ', 'ชื่อโน้ตเดียวกันแต่สูงขึ้นหนึ่งช่วงแปด ความถี่เป็นสองเท่า'],
] as const

const chords = [
  [[0, 4, 7], 'Major', 'เมเจอร์', 'คู่สามเมเจอร์และคู่ห้าเพอร์เฟกต์ให้เสียงมั่นคงและมักฟังสว่าง'],
  [[0, 3, 7], 'Minor', 'ไมเนอร์', 'คู่สามไมเนอร์กับคู่ห้าเพอร์เฟกต์ให้สีที่มักฟังนุ่มหรือหม่น'],
  [[0, 3, 6], 'Diminished', 'ดิมินิชด์', 'คู่สามไมเนอร์ซ้อนสองชั้น เกิดไตรโทนระหว่างรากกับโน้ตบนสุด'],
  [[0, 4, 8], 'Augmented', 'ออกเมนเต็ด', 'คู่สามเมเจอร์ซ้อนสองชั้น เกิดคู่ห้าออกเมนเต็ดที่ฟังลอยและตึง'],
  [[0, 4, 7, 11], 'Maj7', 'เมเจอร์เซเว่น', 'คอร์ดเมเจอร์เติมคู่เจ็ดเมเจอร์ ให้เสียงนุ่มและมีความตึงจากครึ่งเสียงใต้คู่อ็อกเทฟ'],
  [[0, 3, 7, 10], 'm7', 'ไมเนอร์เซเว่น', 'คอร์ดไมเนอร์เติมคู่เจ็ดไมเนอร์ เสียงมักฟังกลมและผ่อนคลาย'],
  [[0, 4, 7, 10], 'Dom7', 'โดมิแนนต์เซเว่น', 'คอร์ดเมเจอร์เติมคู่เจ็ดไมเนอร์ คู่สามกับคู่เจ็ดเกิดไตรโทนที่ชวนให้คลี่คลาย'],
] as const

type Item<T> = readonly [T, string, string, string]

function pick<T extends Item<unknown>>(items: readonly T[], previousId?: string) {
  const candidates = items.filter(([, id]) => id !== previousId)
  return candidates[Math.floor(Math.random() * candidates.length)]
}

function toChoice([, id, detail, explanation]: Item<unknown>): Choice {
  return { id, label: id, detail, explanation }
}

export function makeQuestion(game: PitchGame, difficulty: Difficulty, mode: HarmonyMode, previous?: Question): Question {
  const previousId = previous?.correct.id
  const root = 55 + Math.floor(Math.random() * 12)
  const notes = (offsets: readonly number[]) => offsets.map(offset => root + offset)
  if (game === 'degree') {
    const items = degrees.filter(([, id]) => difficulty === 'chromatic'
      || (difficulty === 'diatonic' ? /^\d$/.test(id) : ['1', '3', '5'].includes(id)))
    const item = pick(items, previousId)
    const progression = [[-12, 0, 4, 7], [-7, 0, 5, 9], [-5, -1, 2, 7], [-12, 0, 4, 7]]
    return {
      topic: 'degree', choices: items.map(toChoice), correct: toChoice(item),
      prompt: 'โน้ตเดี่ยวท้ายสุดอยู่ลำดับใดในคีย์?',
      context: 'ฟังคอร์ด I–IV–V–I ก่อน แล้วทายตำแหน่งของโน้ตตัวสุดท้าย',
      sound: {
        cues: [
          ...progression.map((offsets, index) => ({ notes: notes(offsets), at: index * 0.48, duration: 0.41 })),
          { notes: notes([item[0]]), at: 2.14, duration: 0.68 },
        ],
      },
    }
  }
  const styles = ['melodic', 'harmonic', 'chord'] as const
  const style = mode === 'mixed' ? styles[Math.floor(Math.random() * styles.length)] : mode
  if (style === 'chord') {
    const item = pick(chords, previousId)
    return {
      topic: 'chord', choices: chords.map(toChoice), correct: toChoice(item),
      prompt: 'คอร์ดที่ได้ยินเป็นชนิดใด?',
      context: 'ฟังสีของโน้ตที่ดังพร้อมกัน โดยรากคอร์ดจะเปลี่ยนไปในแต่ละข้อ',
      sound: { cues: [{ notes: notes(item[0]), at: 0, duration: 0.98 }] },
    }
  }
  const item = pick(intervals, previousId)
  return {
    topic: 'interval', choices: intervals.map(toChoice), correct: toChoice(item),
    prompt: 'โน้ตสองตัวนี้ห่างกันเป็นขั้นคู่ใด?',
    context: style === 'melodic' ? 'ฟังโน้ตต่ำแล้วตามด้วยโน้ตสูง' : 'ฟังระยะห่างระหว่างโน้ตที่ดังพร้อมกัน',
    sound: {
      cues: style === 'melodic'
        ? [{ notes: [root], at: 0, duration: 0.42 }, { notes: notes([item[0]]), at: 0.52, duration: 0.56 }]
        : [{ notes: notes([0, item[0]]), at: 0, duration: 0.89 }],
    },
  }
}
