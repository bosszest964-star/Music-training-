import { instruments } from '../audio/pitch'

export interface Chord {
  name: string
  frets: number[]
  fingers: number[]
}

function positions(tuning: keyof typeof tunings, items: Array<[string, number[], number[]]>) {
  return { ...tunings[tuning], chords: items.map(([name, frets, fingers]): Chord => ({ name, frets, fingers })) }
}

const tunings = {
  guitar: instruments.guitar,
  ukulele: instruments.ukulele,
} as const

export const chordLibrary = {
  guitar: positions('guitar', [
    ['C', [-1, 3, 2, 0, 1, 0], [0, 3, 2, 0, 1, 0]],
    ['G', [3, 2, 0, 0, 0, 3], [2, 1, 0, 0, 0, 3]],
    ['D', [-1, -1, 0, 2, 3, 2], [0, 0, 0, 1, 3, 2]],
    ['A', [-1, 0, 2, 2, 2, 0], [0, 0, 1, 2, 3, 0]],
    ['E', [0, 2, 2, 1, 0, 0], [0, 2, 3, 1, 0, 0]],
    ['F', [1, 3, 3, 2, 1, 1], [1, 3, 4, 2, 1, 1]],
    ['Am', [-1, 0, 2, 2, 1, 0], [0, 0, 2, 3, 1, 0]],
    ['Dm', [-1, -1, 0, 2, 3, 1], [0, 0, 0, 2, 3, 1]],
    ['Em', [0, 2, 2, 0, 0, 0], [0, 2, 3, 0, 0, 0]],
    ['Bm', [-1, 2, 4, 4, 3, 2], [0, 1, 3, 4, 2, 1]],
  ]),
  ukulele: positions('ukulele', [
    ['C', [0, 0, 0, 3], [0, 0, 0, 3]],
    ['G', [0, 2, 3, 2], [0, 1, 3, 2]],
    ['D', [2, 2, 2, 0], [1, 2, 3, 0]],
    ['A', [2, 1, 0, 0], [2, 1, 0, 0]],
    ['E', [4, 4, 4, 2], [2, 3, 4, 1]],
    ['F', [2, 0, 1, 0], [2, 0, 1, 0]],
    ['Am', [2, 0, 0, 0], [2, 0, 0, 0]],
    ['Dm', [2, 2, 1, 0], [2, 3, 1, 0]],
    ['Em', [0, 4, 3, 2], [0, 3, 2, 1]],
    ['Bm', [4, 2, 2, 2], [3, 1, 1, 1]],
  ]),
}

export type ChordInstrument = keyof typeof chordLibrary

export function chordPitches(chord: Chord, tuning: readonly number[]) {
  return chord.frets.flatMap((fret, index) => fret < 0 ? [] : [tuning[index] + fret])
}

export function randomChords(pool: Chord[], length: number) {
  const sequence: Chord[] = []
  for (let index = 0; index < length; index += 1) {
    const candidates = pool.filter(chord => chord !== sequence.at(-1))
    sequence.push(candidates[Math.floor(Math.random() * candidates.length)])
  }
  return sequence
}
