import { exerciseMetadata } from '../exerciseMetadata'
import type { ExerciseDifficulty } from '../exerciseMetadata'
import type { Progression, RomanChord } from '../ear/advanced/progressions'
import type { RhythmPattern } from '../ear/advanced/rhythmPatterns'
import type { melodyQuestion } from '../ear/advanced/melodies'
import type { Sound } from '../ear/exercises'
import { buildSong } from '../instrument/songs'
import { allowedAccidentals, readingLevels, staffNote } from '../instrument/mastery/sightReading'
import type { StaffClef, StaffNote } from '../instrument/mastery/sightReading'

export const generatorKinds = {
  echo: 'ฟังทำนองแล้วเล่นตาม',
  progression: 'ทายทางเดินคอร์ด',
  rhythm: 'เคาะจังหวะ',
  reading: 'อ่านโน้ตและโน้ตไหล',
} as const

export const generatorMeters = { '2/4': 2, '3/4': 3, '4/4': 4, '6/8': 2 } as const
export const keyNames = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B']

export interface GeneratorSettings {
  kind: keyof typeof generatorKinds
  key: number
  tonality: 'major' | 'minor'
  meter: keyof typeof generatorMeters
  bpm: number
  difficulty: ExerciseDifficulty
}

export const defaultSettings: GeneratorSettings = { kind: 'echo', key: 0, tonality: 'major', meter: '4/4', bpm: 84, difficulty: 'beginner' }
export const counterPrefix = 'music-training.generator.v1:'
export const counterKeyPattern = /^music-training\.generator\.v1:(echo|progression|rhythm|reading):(?:[0-9]|1[01]):(major|minor):([234]\/4|6\/8):(?:[3-9]\d|1\d\d|2[0-3]\d|240):(beginner|intermediate|advanced)$/

const counters = new Map<string, bigint>()

export function parseCounter(raw: string | null) {
  return raw && /^\d{1,40}$/.test(raw) ? BigInt(raw) : null
}

export function generatorKey(settings: GeneratorSettings) {
  const { kind, key, tonality, meter, bpm, difficulty } = settings
  return `${counterPrefix}${kind}:${key}:${tonality}:${meter}:${bpm}:${difficulty}`
}

export async function nextExerciseIndex(settings: GeneratorSettings) {
  const key = generatorKey(settings)
  function reserve() {
    let index = counters.get(key) ?? 0n
    try {
      const stored = parseCounter(localStorage.getItem(key)) ?? 0n
      if (stored > index) index = stored
      localStorage.setItem(key, String(index + 1n))
    } catch {
      // A private or full store can still keep the sequence for the current page.
    }
    counters.set(key, index + 1n)
    return index
  }
  return navigator.locks?.request ? navigator.locks.request(key, reserve) : reserve()
}

const levels = ['beginner', 'intermediate', 'advanced'] as const
const scales = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] }
const mod = (value: number, base: number) => ((value % base) + base) % base

// Permute the low block before decoding it in base 4/8. All transforms on that
// block are reversible. High blocks add phrase cells instead of wrapping the sequence.
function choices(index: bigint, radix: 4 | 8, minimum: number, settings: GeneratorSettings) {
  const base = BigInt(radix)
  const block = base ** BigInt(minimum)
  const mask = block - 1n
  let salt = 0n
  for (const character of generatorKey(settings)) salt = (salt * 131n + BigInt(character.charCodeAt(0))) & mask
  let code = (index ^ salt) & mask
  code = ((code ^ (code >> 3n)) * 0x9e3779b97f4a7c15n) & mask
  code = ((code ^ (code >> 7n)) * 0xbf58476d1ce4e5b9n) & mask
  code ^= code >> 5n
  code += (index / block) * block
  const result: number[] = []
  do {
    result.push(Number(code % base))
    code /= base
  } while (code || result.length < minimum)
  return result
}

function scaleNotes(settings: GeneratorSettings, low: number, high: number) {
  return Array.from({ length: high - low + 1 }, (_, i) => i + low)
    .filter(note => scales[settings.tonality].includes(mod(note - settings.key, 12)))
}

function nearby(current: number, size: number, advanced: boolean) {
  const order = advanced ? [1, -2, 3, -3, -1, 2, 0, 4, -4] : [1, -1, 2, -2, 0, 3, -3]
  return order.map(delta => current + delta).filter(index => index >= 0 && index < size).slice(0, 4)
}

function echo(settings: GeneratorSettings, index: bigint): ReturnType<typeof melodyQuestion> {
  const degree = levels.indexOf(settings.difficulty)
  const pulse = 60 / settings.bpm
  const pool = scaleNotes(settings, 60, 83)
  const first = 60 + settings.key
  const notes = [first]
  let current = pool.indexOf(first)
  const cues: ReturnType<typeof melodyQuestion>['sound']['cues'] = [{ notes: [first], at: 0, duration: pulse * .68 }]
  const pattern = choices(index, 8, 7 + degree, settings)
  const triplet = settings.meter === '6/8'
  let slot = 1
  for (const digit of pattern) {
    current = nearby(current, pool.length, degree === 2)[digit % 4]
    const midi = pool[current]
    const length = digit < 4 ? .8 : triplet ? 1 / 3 : .42
    const offset = digit < 4 ? 0 : triplet ? 1 / 3 : .5
    notes.push(midi)
    cues.push({ notes: [midi], at: (slot + offset) * pulse, duration: length * pulse })
    slot += 1
  }
  notes.push(first)
  cues.push({ notes: [first], at: Math.ceil(slot / generatorMeters[settings.meter]) * generatorMeters[settings.meter] * pulse,
    duration: pulse * .7 })
  return { exercise: { ...exerciseMetadata('echo', `generated-${settings.difficulty}`, settings.difficulty),
    steps: notes.map(note => note - first), rhythm: undefined }, notes, sound: { cues } }
}

function chords(settings: GeneratorSettings, index: bigint): Progression {
  const degree = levels.indexOf(settings.difficulty)
  const minor = settings.tonality === 'minor'
  const tonic: RomanChord = minor ? (degree === 2 ? 'im7' : 'i') : (degree === 2 ? 'Imaj7' : 'I')
  const cadence: RomanChord = degree === 0 && !minor ? 'V' : 'V7'
  const predominants: RomanChord[] = minor
    ? degree === 2 ? ['iiø7', 'iv', 'VImaj7', 'III'] : ['iv', 'VI', 'ii°', 'III']
    : degree === 2 ? ['ii7', 'IVmaj7', 'iv', 'vi7'] : ['IV', 'ii', 'vi', 'iii']
  const approach: RomanChord[] = minor
    ? degree === 2 ? ['V7', 'VII', 'iiø7', 'VImaj7'] : ['V', 'VII', 'iv', 'VI']
    : degree === 2 ? ['V7', 'VI7', 'ii7', 'IVmaj7'] : ['V', 'IV', 'vi', 'ii']
  const code = choices(index, 4, 4 + degree, settings)
  const sequence: RomanChord[] = [tonic]
  for (const [position, digit] of code.entries()) {
    const pool = position % 2 ? approach : predominants
    sequence.push(pool[digit])
  }
  sequence.push(cadence, tonic)
  return { ...exerciseMetadata('progression', `generated-${index}`, settings.difficulty), chords: sequence,
    label: sequence.join('–'), genre: minor ? 'ป๊อปไมเนอร์และเพลงประกอบ' : 'ป๊อป โฟล์ก และแจ๊ส',
    hint: `ฟังแรงดึงจาก ${cadence} เข้าหา ${tonic} ตอนท้าย แล้วแยกคอร์ดก่อนหน้าเป็นกลุ่มย่อย` }
}

function progression(settings: GeneratorSettings, index: bigint) {
  const correct = chords(settings, index)
  // Pull alternatives from the same word length even at the boundary between blocks.
  const minimum = 4 + levels.indexOf(settings.difficulty)
  let block = 4n ** BigInt(minimum)
  while (index >= block) block *= 4n
  const first = block === 4n ** BigInt(minimum) ? 0n : block / 4n
  const alternatives = [1n, 2n, 3n].map(offset => chords(settings, first + (index - first + offset) % (block - first)))
  const position = Number(index % 4n)
  alternatives.splice(position, 0, correct)
  return { correct, options: alternatives, tonic: 48 + settings.key,
    beatsPerBar: generatorMeters[settings.meter], bpm: settings.bpm, keyName: settingsLabel(settings), home: correct.chords[0] }
}

function rhythm(settings: GeneratorSettings, index: bigint): RhythmPattern {
  const degree = levels.indexOf(settings.difficulty)
  const pulses = generatorMeters[settings.meter]
  const step = settings.meter === '6/8' ? 1 / 3 : .5
  const basic = [[], [0], [step], [0, step]]
  const subdivisions = step === .5 ? [[.25], [.75], [0, .75], [.25, .5, .75]] :
    [[2 / 3], [0, 2 / 3], [step, 2 / 3], [0, step, 2 / 3]]
  const advanced = step === .5 ? [[1 / 3, 2 / 3], [0, 1 / 3, 2 / 3], [.25, .75], [.5, .75]] : subdivisions
  const shapes = degree === 0 ? basic : [...basic, ...(degree === 1 ? subdivisions : advanced)]
  const digits = choices(index, degree === 0 ? 4 : 8, 8 + degree * 2, settings)
  const taps = [0, ...digits.flatMap((digit, cell) => shapes[digit].map(offset => cell + 1 + offset)), digits.length + 1]
  return { ...exerciseMetadata('rhythm', `generated-${settings.difficulty}`, settings.difficulty),
    label: 'แพตเทิร์นใหม่', bpm: settings.bpm, taps, beats: Math.ceil((digits.length + 2) / pulses) * pulses, meter: settings.meter }
}

function reading(settings: GeneratorSettings, index: bigint) {
  const degree = levels.indexOf(settings.difficulty)
  const beat = 60 / settings.bpm
  const pulses = generatorMeters[settings.meter]
  const clef: StaffClef = degree && index % 2n ? 'bass' : 'treble'
  const pitches = new Set(scales[settings.tonality].map(offset => (offset + settings.key) % 12))
  const { low, high } = readingLevels[settings.difficulty]
  const useFlats = [1, 3, 5, 8, 10].includes(settings.key)
  const byPitch = new Map<number, StaffNote>()
  for (let position = low; position <= high; position += 1) {
    const natural = staffNote(clef, position)
    const available = allowedAccidentals(natural.letter).filter(accidental => accidental === 0 || accidental === (useFlats ? -1 : 1))
    for (const accidental of available) {
      const note = staffNote(clef, position, accidental)
      if (pitches.has(note.midi % 12)) byPitch.set(note.midi, note)
    }
  }
  const pool = [...byPitch.values()].sort((left, right) => left.midi - right.midi)
  let current = pool.findIndex(note => note.midi % 12 === settings.key)
  if (current < 0) current = Math.floor(pool.length / 2)
  const digits = choices(index, 8, pulses * (degree + 2), settings)
  const onsets: number[] = []
  const spans: number[] = []
  const notes = digits.map((digit, cell): StaffNote => {
    current = nearby(current, pool.length, degree === 2)[digit % 4]
    const short = digit >= 4
    const fraction = settings.meter === '6/8' ? 1 / 3 : .5
    onsets.push((cell + (short && cell > 0 ? fraction : 0)) * beat)
    spans.push((short ? fraction : .82) * beat)
    return { ...pool[current], value: short ? 'eighth' : settings.meter === '6/8' ? 'dotted-quarter' : 'quarter' }
  })
  // At the first cell, preserve its rhythm bit in the duration. The length is
  // also audible in the preview when the notation view only shows one note.
  const chartNotes = notes.map((note, cell) => ({ midi: note.midi, time: onsets[cell], duration: spans[cell] }))
  const song = buildSong('โน้ตไหลที่สร้างใหม่', `${settingsLabel(settings)} · ${settings.meter} · ${settings.bpm} BPM`, chartNotes)
  const sound: Sound = { cues: chartNotes.map(({ midi, time, duration }) => ({ notes: [midi], at: time, duration })) }
  return { notes, clef, song, sound }
}

export function settingsLabel(settings: GeneratorSettings) {
  return `${keyNames[settings.key]} ${settings.tonality === 'major' ? 'เมเจอร์' : 'ไมเนอร์'}`
}

export function generateExercise(settings: GeneratorSettings, index: bigint) {
  switch (settings.kind) {
    case 'echo': return { kind: 'echo' as const, preset: echo(settings, index) }
    case 'progression': return { kind: 'progression' as const, preset: progression(settings, index) }
    case 'rhythm': return { kind: 'rhythm' as const, preset: rhythm(settings, index) }
    case 'reading': return { kind: 'reading' as const, preset: reading(settings, index) }
  }
}

export type GeneratedExercise = ReturnType<typeof generateExercise>
