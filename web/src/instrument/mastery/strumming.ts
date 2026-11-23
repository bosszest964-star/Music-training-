import { exerciseMetadata } from '../../exerciseMetadata'
import type { ExerciseDifficulty } from '../../exerciseMetadata'
import { playNote } from '../../audio/noteSynth'
import { chordPitches } from '../chords'
import type { Chord, ChordInstrument } from '../chords'

export const strokes = {
  d: { mark: '↓', label: 'ตีลง', direction: 'down', accent: false },
  D: { mark: '↓', label: 'เน้นตีลง', direction: 'down', accent: true },
  u: { mark: '↑', label: 'ตีขึ้น', direction: 'up', accent: false },
  U: { mark: '↑', label: 'เน้นตีขึ้น', direction: 'up', accent: true },
  b: { mark: '↓', label: 'ดีดลงสายเบส', direction: 'bass', accent: false },
  x: { mark: '×', label: 'อุดสาย', direction: 'mute', accent: false },
  X: { mark: '×', label: 'เน้นอุดสาย', direction: 'mute', accent: true },
  '-': { mark: '·', label: 'พัก', direction: 'rest', accent: false },
} as const

type Stroke = keyof typeof strokes

function pattern(id: string, genre: string, label: string, difficulty: ExerciseDifficulty, bpm: number,
  meter: '4/4' | '6/8', subdivision: number, steps: string, tip: string) {
  return { ...exerciseMetadata('instrument-strum', id, difficulty, { maxStars: 0 }), genre, label, bpm, meter, subdivision,
    steps: Array.from(steps.replaceAll(' ', ''), step => strokes[step as Stroke]), tip }
}

export const strumPatterns = [
  pattern('pop-island', 'Pop', 'Pop มาตรฐาน', 'beginner', 86, '4/4', 2, 'D- du -u du', 'นับ “หนึ่ง และ สอง และ” ต่อเนื่อง แม้จังหวะที่มือผ่านสายโดยไม่ตี'),
  pattern('pop-backbeat', 'Pop', 'Pop เน้นจังหวะ 2 และ 4', 'beginner', 92, '4/4', 2, 'd- Du d- Du', 'เน้นลงจังหวะสองและสี่ ผ่อนแรงบนจังหวะอื่น'),
  pattern('folk-open', 'Folk / Acoustic', 'Folk เปิดคอร์ด', 'beginner', 82, '4/4', 2, 'D- d- du du', 'ปล่อยคอร์ดแรกให้กังวานก่อนเพิ่มจังหวะขึ้นลง'),
  pattern('folk-alternating', 'Folk / Acoustic', 'Folk เกาสลับขึ้นลง', 'intermediate', 96, '4/4', 2, 'Du -u du Du', 'ลองตีลงให้โดนสายต่ำก่อน แล้วตีขึ้นเฉพาะสายบน'),
  pattern('ballad-sway', 'Ballad', 'Ballad 6/8 โยกสองจังหวะ', 'beginner', 64, '6/8', 3, 'D-u d-u', 'นับ “หนึ่ง สอง สาม | สี่ ห้า หก” แล้วเน้นหนึ่งกับสี่'),
  pattern('ballad-flow', 'Ballad', 'Ballad 6/8 ไล่ปลายห้อง', 'intermediate', 72, '6/8', 3, 'Dud duU', 'เก็บจังหวะย่อยให้เท่ากันและยกเบา ๆ ก่อนเข้าห้องใหม่'),
  pattern('rock-down', 'Rock', 'Rock ตีลงเขบ็ต', 'beginner', 104, '4/4', 2, 'Dd dd Dd dd', 'ตีลงทุกจังหวะย่อยและเน้นหนึ่งกับสาม'),
  pattern('rock-mute', 'Rock', 'Rock ตัดเสียงตามจังหวะ', 'intermediate', 108, '4/4', 2, 'Dx du Dx dU', 'แตะสันมือให้สายหยุดสั้น ๆ ตรงเครื่องหมาย ×'),
  pattern('funk-chuck', 'Funk', 'Funk ตบสายเขบ็ตสองชั้น', 'advanced', 88, '4/4', 4, 'D-xu -uXu dx-u xU-x', 'แกว่งมือสม่ำเสมอและคลายมือซ้ายบนจังหวะอุดสาย'),
  pattern('funk-pocket', 'Funk', 'Funk เน้นจังหวะขัด', 'advanced', 94, '4/4', 4, 'dx-x -Ux- Dx-u --Xu', 'รักษาการแกว่งมือและให้เสียงคอร์ดเด่นออกมาจากเสียงตบสาย'),
  pattern('reggae-offbeat', 'Reggae', 'Reggae ยกจังหวะ', 'beginner', 76, '4/4', 2, '-U -U -U -U', 'ขึ้นพร้อมคำว่า “และ” แล้วคลายมือซ้ายให้คอร์ดสั้น'),
  pattern('reggae-double', 'Reggae', 'Reggae ยกคู่สลับ', 'intermediate', 82, '4/4', 4, '--U- --dU --U- -xDu', 'ฟังเขบ็ตตัวท้ายและคุมไม่ให้แนวจังหวะเอียง'),
  pattern('country-boom', 'Country', 'Country เบสสลับคอร์ด', 'beginner', 98, '4/4', 2, 'b- Du b- dU', 'จังหวะที่ไม่เน้นลงสายเบส จังหวะเน้นตีผ่านทุกสาย'),
  pattern('country-train', 'Country', 'Country จังหวะรถไฟ', 'intermediate', 106, '4/4', 2, 'dU D- dU Du', 'เน้นการตีขึ้นครั้งแรกของแต่ละครึ่งห้อง แล้วลงหนักที่จังหวะถัดไป'),
  pattern('bossa-basic', 'Bossa Nova', 'Bossa Nova เปลี่ยนคอร์ดหลังจังหวะ', 'intermediate', 84, '4/4', 2, 'D- -u d- -U', 'ลงให้เบาและเน้นจังหวะยกหลังจังหวะสองและสี่'),
  pattern('bossa-sync', 'Bossa Nova', 'Bossa Nova ซิงโคเปชัน', 'advanced', 92, '4/4', 4, 'D--u --d- d--U -u--', 'จับจังหวะเบสกับคอร์ดที่เยื้องกัน ใช้มือขวาแกว่งในระยะสั้น'),
]

type Pattern = typeof strumPatterns[number]

export const chordLoops = [
  { label: 'C–G–Am–F', chords: ['C', 'G', 'Am', 'F'] },
  { label: 'G–D–Em–C', chords: ['G', 'D', 'Em', 'C'] },
  { label: 'Am–F–C–G', chords: ['Am', 'F', 'C', 'G'] },
  { label: 'Dm–G–C–Am', chords: ['Dm', 'G', 'C', 'Am'] },
]

const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>()

function mutedStroke(context: BaseAudioContext, output: AudioNode, time: number, accent: boolean) {
  let buffer = noiseBuffers.get(context)
  if (!buffer) {
    buffer = context.createBuffer(1, Math.ceil(context.sampleRate * 0.072), context.sampleRate)
    const samples = buffer.getChannelData(0)
    for (let i = 0; i < samples.length; i += 1) samples[i] = (Math.random() * 2 - 1) * (1 - i / samples.length) ** 4
    noiseBuffers.set(context, buffer)
  }
  const source = context.createBufferSource()
  source.buffer = buffer
  const filter = context.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 900
  filter.Q.value = 0.76
  const gain = context.createGain()
  gain.gain.value = accent ? .34 : .23
  source.connect(filter).connect(gain).connect(output)
  source.onended = () => {
    source.disconnect()
    filter.disconnect()
    gain.disconnect()
  }
  source.start(time)
}

export function scheduleStroke(context: BaseAudioContext, output: AudioNode, voice: ChordInstrument, tuning: readonly number[],
  chord: Chord, stroke: Pattern['steps'][number], time: number, stepSeconds: number) {
  if (stroke.direction === 'rest') return
  if (stroke.direction === 'mute') {
    mutedStroke(context, output, time, stroke.accent)
    return
  }
  const chordNotes = chordPitches(chord, tuning)
  const pitches = stroke.direction === 'bass' ? [Math.min(...chordNotes)] : chordNotes
  if (stroke.direction === 'up') pitches.reverse()
  const sustain = Math.max(0.09, Math.min(.44, stepSeconds * (stroke.accent ? 1.8 : 1.25)))
  pitches.forEach((midi, index) => {
    playNote(context, output, midi, time + index * .008, sustain, voice,
      (stroke.accent ? .25 : .17) / Math.sqrt(pitches.length))
  })
}
