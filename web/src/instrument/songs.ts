export interface PianoNote {
  midi: number
  duration: number
}

export interface PianoCue {
  time: number
  notes: PianoNote[]
}

export interface PianoSong {
  title: string
  credit: string
  cues: PianoCue[]
  length: number
  total: number
  low: number
  high: number
}

export function buildSong(title: string, credit: string, notes: (PianoNote & { time: number })[]): PianoSong {
  if (!notes.length) throw new Error('ไม่พบโน้ตที่เล่นได้ในไฟล์')
  if (notes.length > 30_000) throw new Error('ไฟล์มีโน้ตมากเกินกว่าที่กราฟจะแสดงได้')
  const cues: PianoCue[] = []
  let low = 127
  let high = 0
  let length = 0
  let total = 0
  for (const note of notes.sort((a, b) => a.time - b.time)) {
    const { time, midi, duration } = note
    if (!Number.isInteger(midi) || midi < 0 || midi > 127 || !Number.isFinite(time) || time < 0
      || !Number.isFinite(duration) || duration < 0) throw new Error('ไฟล์มีเวลาโน้ตที่อ่านไม่ได้')
    let cue = cues.at(-1)
    if (!cue || time - cue.time > 0.033) {
      cue = { time, notes: [] }
      cues.push(cue)
    }
    const durationAtCue = Math.max(0.09, time - cue.time + duration)
    const previous = cue.notes.find(entry => entry.midi === midi)
    if (previous) previous.duration = Math.max(previous.duration, durationAtCue)
    else {
      cue.notes.push({ midi, duration: durationAtCue })
      total += 1
    }
    low = Math.min(low, midi)
    high = Math.max(high, midi)
    length = Math.max(length, cue.time + durationAtCue)
  }
  if (length > 7200) throw new Error('รองรับเพลง MIDI ความยาวไม่เกิน 2 ชั่วโมง')
  const start = cues[0].time
  for (const cue of cues) {
    cue.time -= start
    cue.notes.sort((a, b) => a.midi - b.midi)
  }
  return { title, credit, cues, total, low, high, length: length - start }
}

type Beat = [notes: number | number[], beats?: number]

function lesson(title: string, credit: string, bpm: number, beats: Beat[]) {
  const seconds = 60 / bpm
  let time = 0
  const notes = beats.flatMap(([pitches, length = 1]) => {
    const onset = time
    time += length * seconds
    return [pitches].flat().map(midi => ({ midi, time: onset, duration: length * seconds * 0.88 }))
  })
  return buildSong(title, credit, notes)
}

export const songs = [
  lesson('Ode to Joy', 'Ludwig van Beethoven · ทำนองช่วงต้น', 96, [
    [64], [64], [65], [67], [67], [65], [64], [62], [60], [60], [62], [64], [64, 1.5], [62, .5], [62, 2],
    [64], [64], [65], [67], [67], [65], [64], [62], [60], [60], [62], [64], [62, 1.5], [60, .5], [60, 2],
  ]),
  lesson('Twinkle Twinkle', 'ทำนองดั้งเดิม · เรียบเรียงสำหรับฝึก', 100, [
    [60], [60], [67], [67], [69], [69], [67, 2], [65], [65], [64], [64], [62], [62], [60, 2],
    [67], [67], [65], [65], [64], [64], [62, 2], [67], [67], [65], [65], [64], [64], [62, 2],
    [60], [60], [67], [67], [69], [69], [67, 2], [65], [65], [64], [64], [62], [62], [60, 2],
  ]),
  lesson('Minuet in G', 'Christian Petzold · ทำนองช่วงต้น', 112, [
    [74], [67, .5], [69, .5], [71, .5], [72, .5], [74], [67], [67],
    [76], [72, .5], [74, .5], [76, .5], [78, .5], [79], [67], [67],
    [72], [74, .5], [72, .5], [71, .5], [69, .5], [71], [72, .5], [71, .5], [69, .5], [67, .5],
    [66], [67, .5], [69, .5], [71, .5], [67, .5], [69, 3],
  ]),
  lesson('ไล่สเกล C เมเจอร์', 'แบบฝึกหัดขึ้นและลงหนึ่งอ็อกเทฟ', 88, [
    [60], [62], [64], [65], [67], [69], [71], [72, 2], [71], [69], [67], [65], [64], [62], [60, 2],
  ]),
  lesson('ทางคอร์ดป๊อป I–V–vi–IV', 'แบบฝึกจับคอร์ด C · G · Am · F', 84, [
    [[60, 64, 67], 4], [[59, 62, 67], 4], [[60, 64, 69], 4], [[60, 65, 69], 4],
    [[60, 64, 67], 4], [[59, 62, 67], 4], [[60, 64, 69], 4], [[60, 65, 69], 4],
  ]),
]

export async function readMidi(file: File) {
  if (file.size > 8 * 1024 * 1024) throw new Error('รองรับไฟล์ MIDI ขนาดไม่เกิน 8 MB')
  const data = await file.arrayBuffer()
  const header = new DataView(data)
  if (header.byteLength < 14 || header.getUint32(0) !== 0x4d546864 || header.getUint32(4) !== 6) {
    throw new Error('ไฟล์นี้ไม่มีส่วนหัวมาตรฐาน MIDI')
  }
  const format = header.getUint16(8)
  if (format > 1 || header.getUint16(12) & 0x8000) {
    throw new Error('รองรับ MIDI ฟอร์แมต 0 และ 1 ที่ใช้หน่วย PPQ')
  }
  if (!header.getUint16(10) || !header.getUint16(12)) throw new Error('จำนวนแทร็กหรือหน่วยเวลา MIDI ไม่ถูกต้อง')
  const { Midi } = await import('@tonejs/midi')
  const midi = new Midi(data)
  // Channel 10 is the General MIDI percussion channel, which has no piano pitch.
  const notes = midi.tracks.filter(track => track.channel !== 9)
    .flatMap(track => track.notes.map(note => ({ midi: note.midi, time: note.time, duration: note.duration })))
  return buildSong(file.name.replace(/\.(mid|midi)$/i, ''), 'ไฟล์ MIDI จากเครื่อง', notes)
}
