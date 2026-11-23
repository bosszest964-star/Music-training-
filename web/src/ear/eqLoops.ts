import { playNote } from '../audio/noteSynth'
import { pianoReady, playPiano } from '../audio/pianoEngine'
import { midiToHz } from '../audio/pitch'

export const eqSources = {
  piano: 'แกรนด์เปียโนและเบส',
  drums: 'กลอง เบส และคอร์ด',
  guitar: 'เกาและตีคอร์ดกีตาร์',
  file: 'ไฟล์เพลงของคุณ',
  noise: 'Pink Noise',
} as const

export type EqSource = keyof typeof eqSources
type LoopSource = Exclude<EqSource, 'file' | 'noise'>
const chords = [
  { bass: 45, notes: [57, 60, 64, 67], guitar: [45, 52, 57, 60, 64], top: 79 },
  { bass: 41, notes: [57, 60, 65, 69], guitar: [41, 48, 53, 57, 60, 65], top: 81 },
  { bass: 36, notes: [55, 60, 64, 71], guitar: [48, 52, 55, 60, 64], top: 76 },
  { bass: 43, notes: [55, 59, 62, 65], guitar: [43, 47, 50, 55, 59, 67], top: 77 },
] as const
export const loopPianoNotes = chords.flatMap((chord, index) =>
  index % 2 ? [...chord.notes, chord.top, chord.top + 12] : [...chord.notes, chord.top])

function noiseBuffer(context: BaseAudioContext, seconds: number, pink: boolean) {
  const buffer = context.createBuffer(1, Math.round(context.sampleRate * seconds), context.sampleRate)
  const samples = buffer.getChannelData(0)
  let seed = 127
  let low = 0
  let middle = 0
  let high = 0
  for (let index = 0; index < samples.length; index += 1) {
    seed = (1664525 * seed + 1013904223) >>> 0
    const white = seed / 2 ** 31 - 1
    if (pink) {
      low = 0.99765 * low + white * 0.099046
      middle = 0.963 * middle + white * 0.2965164
      high = 0.57 * high + white * 1.0526913
      samples[index] = 0.24 * (low + middle + high + white * 0.1848)
    } else {
      samples[index] = white
    }
    if (pink) {
      const fade = context.sampleRate * 0.012
      samples[index] *= Math.min(1, index / fade, (samples.length - 1 - index) / fade)
    }
  }
  return buffer
}

function levelLoop(buffer: AudioBuffer) {
  let power = 0
  let peak = 0
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel)
    for (const sample of data) {
      power += sample * sample
      peak = Math.max(peak, Math.abs(sample))
    }
  }
  if (!peak) return buffer
  const rms = Math.sqrt(power / (buffer.length * buffer.numberOfChannels))
  const gain = Math.min(0.075 / rms, 0.64 / peak)
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel)
    for (let frame = 0; frame < data.length; frame += 1) data[frame] *= gain
  }
  return buffer
}

export function pinkLoop(context: BaseAudioContext) {
  return levelLoop(noiseBuffer(context, 4, true))
}

function tone(context: BaseAudioContext, output: AudioNode, hz: number, at: number, duration: number, level: number, endHz = hz) {
  const oscillator = context.createOscillator()
  oscillator.frequency.setValueAtTime(hz, at)
  if (endHz !== hz) oscillator.frequency.exponentialRampToValueAtTime(endHz, at + duration * 0.45)
  const envelope = context.createGain()
  envelope.gain.setValueAtTime(0.0001, at)
  envelope.gain.exponentialRampToValueAtTime(level, at + 0.009)
  envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration)
  oscillator.connect(envelope).connect(output)
  oscillator.start(at)
  oscillator.stop(at + duration + 0.005)
}

function noiseHit(context: BaseAudioContext, output: AudioNode, noise: AudioBuffer, at: number, duration: number,
  level: number, hz: number, type: BiquadFilterType) {
  const source = context.createBufferSource()
  source.buffer = noise
  const filter = context.createBiquadFilter()
  filter.frequency.value = hz
  filter.type = type
  filter.Q.value = 0.7
  const envelope = context.createGain()
  envelope.gain.setValueAtTime(0.0001, at)
  envelope.gain.exponentialRampToValueAtTime(level, at + 0.004)
  envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration)
  source.connect(filter).connect(envelope).connect(output)
  source.start(at)
  source.stop(at + duration + 0.005)
}

function bass(context: BaseAudioContext, output: AudioNode, midi: number, at: number, duration: number, velocity = 1) {
  const hz = midiToHz(midi)
  tone(context, output, hz, at, duration, 0.16 * velocity)
  tone(context, output, hz * 2, at, duration * 0.65, 0.063 * velocity)
  tone(context, output, hz * 4, at, duration * 0.37, 0.021 * velocity)
}

export async function renderMusicalLoop(source: LoopSource, sampled = pianoReady(loopPianoNotes)) {
  const sampleRate = 44_100
  const bpm = source === 'drums' ? 106 : source === 'guitar' ? 94 : 86
  const beatFrames = Math.round(sampleRate * 60 / bpm)
  const beat = beatFrames / sampleRate
  const frames = beatFrames * chords.length * 4
  const context = new OfflineAudioContext(2, 2 * frames, sampleRate)
  const output = context.createGain()
  output.gain.value = 0.83
  output.connect(context.destination)
  const noise = source === 'piano' ? null : noiseBuffer(context, 0.32, false)
  // Render two identical passes and keep the second, so tails cross the seam.
  for (let pass = 0; pass < 2; pass += 1) {
    chords.forEach((chord, index) => {
      const at = (pass * chords.length + index) * beat * 4
      if (source === 'piano') {
        bass(context, output, chord.bass, at, beat * 1.8)
        bass(context, output, chord.bass + 12, at + 2.5 * beat, beat * 1.25, 0.62)
        chord.notes.forEach((midi, voice) => {
          playPiano(context, output, { midi, time: at + 0.024 * voice, duration: beat * 2.4, level: 0.12, velocity: 0.68, sampled })
          playPiano(context, output, { midi, time: at + 2.75 * beat + 0.018 * voice, duration: beat * 0.65, level: 0.085, velocity: 0.52, sampled })
        })
        playPiano(context, output, { midi: chord.top, time: at + 1.5 * beat, duration: beat * 0.7, level: 0.15, velocity: 0.86, sampled })
        if (index % 2) {
          playPiano(context, output, {
            midi: chord.top + 12, time: at + 3.45 * beat, duration: beat * 0.38, level: 0.10, velocity: 0.91, sampled,
          })
        }
      } else if (source === 'drums' && noise) {
        for (const step of [0, 1.5, 2.5, 3.25]) {
          bass(context, output, chord.bass + (step === 2.5 ? 12 : 0), at + step * beat, beat * 0.75, 0.83)
        }
        for (const step of [0, 2, 2.75]) tone(context, output, 120, at + step * beat, 0.19, 0.30, 48)
        for (const step of [1, 3]) {
          noiseHit(context, output, noise, at + step * beat, 0.18, 0.14, 1940, 'bandpass')
          tone(context, output, 178, at + step * beat, 0.09, 0.075)
        }
        for (let eighth = 0; eighth < 8; eighth += 1) {
          noiseHit(context, output, noise, at + beat * eighth / 2, 0.082, eighth % 2 ? 0.072 : 0.13, 7100, 'highpass')
        }
        for (const step of [0.5, 2.5]) {
          for (const midi of chord.notes) playNote(context, output, midi, at + beat * step, beat * 0.48, 'soft', 0.074)
        }
      } else if (noise) {
        const pick = [0, 2, 3, 4, 3, 2]
        pick.forEach((finger, eighth) => {
          const time = at + beat * eighth / 2
          playNote(context, output, chord.guitar[finger], time, beat * 0.95, 'guitar', eighth % 2 ? 0.14 : 0.2)
          noiseHit(context, output, noise, time, 0.024, 0.085, 4600, 'highpass')
        })
        chord.guitar.forEach((midi, string) => {
          const time = at + beat * 3 + string * 0.023
          playNote(context, output, midi, time, beat * 0.77, 'guitar', 0.105)
          noiseHit(context, output, noise, time, 0.026, 0.06, 5300, 'highpass')
        })
      }
    })
  }
  const rendered = await context.startRendering()
  const loop = context.createBuffer(2, frames, sampleRate)
  for (let channel = 0; channel < 2; channel += 1) {
    loop.copyToChannel(rendered.getChannelData(channel).subarray(frames), channel)
  }
  return levelLoop(loop)
}
