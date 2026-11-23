import type { Sound } from './exercises'

export type Voice = 'piano' | 'soft'
export type EqSide = 'A' | 'B'

const partials = {
  piano: [
    { ratio: 1, level: 1, tail: 1 },
    { ratio: 2.001, level: 0.29, tail: 0.65 },
    { ratio: 3.004, level: 0.14, tail: 0.41 },
    { ratio: 4.011, level: 0.08, tail: 0.33 },
    { ratio: 5.023, level: 0.04, tail: 0.25 },
  ],
  soft: [{ ratio: 1, level: 1, tail: 1 }, { ratio: 2, level: 0.08, tail: 0.8 }],
}

function playNote(context: AudioContext, output: AudioNode, midi: number, time: number, duration: number, voice: Voice, level: number) {
  const frequency = 440 * 2 ** ((midi - 69) / 12)
  for (const partial of partials[voice]) {
    const oscillator = context.createOscillator()
    oscillator.frequency.value = frequency * partial.ratio
    const envelope = context.createGain()
    const attack = voice === 'piano' ? 0.011 : 0.04
    const end = time + duration + 0.12
    const peak = level * partial.level
    envelope.gain.setValueAtTime(0.0001, time)
    envelope.gain.exponentialRampToValueAtTime(peak, time + attack)
    envelope.gain.exponentialRampToValueAtTime(peak * (voice === 'piano' ? 0.15 : 0.78), time + duration * partial.tail)
    envelope.gain.exponentialRampToValueAtTime(0.0001, end)
    oscillator.connect(envelope).connect(output)
    oscillator.start(time)
    oscillator.stop(end + 0.01)
  }
}

function pinkNoise(context: AudioContext) {
  const buffer = context.createBuffer(1, Math.floor(context.sampleRate * 2.4), context.sampleRate)
  const samples = buffer.getChannelData(0)
  // Parallel filters approximate a -3 dB/octave spectrum at common browser sample rates.
  const poles = [0.99886, 0.99332, 0.969, 0.8665, 0.55, -0.7616]
  const coefficients = [0.0555179, 0.0750759, 0.153852, 0.3104856, 0.5329522, -0.016898]
  const state = new Float32Array(poles.length)
  let previous = 0
  let peak = 0
  for (let index = 0; index < samples.length; index += 1) {
    const white = Math.random() * 2 - 1
    let sample = white * 0.5362 + previous
    for (let pole = 0; pole < poles.length; pole += 1) {
      state[pole] = state[pole] * poles[pole] + coefficients[pole] * white
      sample += state[pole]
    }
    previous = white * 0.115926
    samples[index] = sample
    peak = Math.max(peak, Math.abs(sample))
  }
  if (peak > 0) {
    for (let index = 0; index < samples.length; index += 1) samples[index] /= peak
  }
  return buffer
}

export function createEarAudio() {
  let context: AudioContext | undefined
  let noise: AudioBuffer | undefined
  let output: GainNode | undefined
  let comparison: {
    filter: BiquadFilterNode
    start: number
    end: number
    boostedFrom: number | null
    boostedSeconds: number
  } | undefined
  let generation = 0

  function stop() {
    generation += 1
    comparison = undefined
    if (!output || !context) return
    const node = output
    output = undefined
    node.gain.cancelScheduledValues(context.currentTime)
    node.gain.setTargetAtTime(0, context.currentTime, 0.009)
    window.setTimeout(() => node.disconnect(), 45)
  }

  function boostedSeconds() {
    if (!context || !comparison) return 0
    const { boostedFrom, boostedSeconds, end } = comparison
    return boostedSeconds + (boostedFrom === null ? 0 : Math.max(0, Math.min(context.currentTime, end) - boostedFrom))
  }

  function setSide(side: EqSide) {
    if (!context || !comparison) return
    comparison.boostedSeconds = boostedSeconds()
    comparison.boostedFrom = side === 'B' ? Math.max(context.currentTime, comparison.start) : null
    comparison.filter.gain.setTargetAtTime(side === 'B' ? 10 : 0, context.currentTime, 0.018)
  }

  async function play(sound: Sound, voice: Voice, side: EqSide, onEnd: (boostedSeconds: number) => void) {
    stop()
    const playback = generation
    const audio = context ??= new AudioContext({ latencyHint: 'interactive' })
    await audio.resume()
    if (playback !== generation) return
    const bus = audio.createGain()
    bus.gain.value = 0.65
    bus.connect(audio.destination)
    output = bus
    const time = audio.currentTime + 0.055
    let end: number

    if ('frequency' in sound) {
      noise ??= pinkNoise(audio)
      const source = audio.createBufferSource()
      source.buffer = noise
      const eq = audio.createBiquadFilter()
      eq.type = 'peaking'
      eq.frequency.value = sound.frequency
      eq.Q.value = 1.15
      eq.gain.value = side === 'B' ? 10 : 0
      const envelope = audio.createGain()
      end = time + noise.duration
      comparison = { filter: eq, start: time, end, boostedFrom: side === 'B' ? time : null, boostedSeconds: 0 }
      envelope.gain.setValueAtTime(0, time)
      envelope.gain.linearRampToValueAtTime(0.35, time + 0.05)
      envelope.gain.setValueAtTime(0.35, end - 0.08)
      envelope.gain.linearRampToValueAtTime(0, end)
      source.connect(eq).connect(envelope).connect(bus)
      source.start(time)
    } else {
      end = time
      for (const cue of sound.cues) {
        const level = 0.38 / cue.notes.length
        for (const midi of cue.notes) playNote(audio, bus, midi, time + cue.at, cue.duration, voice, level)
        end = Math.max(end, time + cue.at + cue.duration + 0.14)
      }
    }

    const marker = audio.createConstantSource()
    marker.offset.value = 0
    marker.connect(bus)
    marker.onended = () => {
      if (playback !== generation) return
      bus.disconnect()
      output = undefined
      const listened = boostedSeconds()
      comparison = undefined
      onEnd(listened)
    }
    marker.start(time)
    marker.stop(end)
  }

  function dispose() {
    stop()
    void context?.close().catch(() => {})
    context = undefined
    noise = undefined
  }

  return { play, setSide, boostedSeconds, stop, dispose }
}
