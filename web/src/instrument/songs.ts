export type PianoHand = 'left' | 'right'

export interface PianoNote {
  midi: number
  duration: number
  hand?: PianoHand
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
    const { time, midi, duration, hand } = note
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
      cue.notes.push(hand ? { midi, duration: durationAtCue, hand } : { midi, duration: durationAtCue })
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

export function songForHand(song: PianoSong, hand: PianoHand | 'both'): PianoSong {
  if (hand === 'both' || !song.cues.some(cue => cue.notes.some(note => note.hand))) return song
  const cues = song.cues.flatMap(cue => {
    const notes = cue.notes.filter(note => note.hand === hand)
    return notes.length ? [{ time: cue.time, notes }] : []
  })
  const pitches = cues.flatMap(cue => cue.notes.map(note => note.midi))
  if (!pitches.length) return song
  const length = Math.max(...cues.flatMap(cue => cue.notes.map(note => cue.time + note.duration)))
  return { ...song, cues, low: Math.min(...pitches), high: Math.max(...pitches), total: pitches.length, length }
}

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
