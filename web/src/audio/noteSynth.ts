import { midiToHz } from './pitch'

export type Voice = 'piano' | 'soft'
export type SynthVoice = Voice | 'guitar' | 'ukulele'

const partials = {
  piano: [
    { ratio: 1, level: 1, tail: 1 },
    { ratio: 2.001, level: 0.29, tail: 0.65 },
    { ratio: 3.004, level: 0.14, tail: 0.41 },
    { ratio: 4.011, level: 0.08, tail: 0.33 },
    { ratio: 5.023, level: 0.04, tail: 0.25 },
  ],
  soft: [{ ratio: 1, level: 1, tail: 1 }, { ratio: 2, level: 0.08, tail: 0.8 }],
  guitar: [
    { ratio: 1, level: 1, tail: 1 },
    { ratio: 2, level: 0.51, tail: 0.65 },
    { ratio: 3, level: 0.25, tail: 0.48 },
    { ratio: 4, level: 0.13, tail: 0.27 },
    { ratio: 6, level: 0.08, tail: 0.19 },
  ],
  ukulele: [
    { ratio: 1, level: 1, tail: 0.79 },
    { ratio: 2, level: 0.32, tail: 0.50 },
    { ratio: 3, level: 0.27, tail: 0.32 },
    { ratio: 5, level: 0.10, tail: 0.22 },
  ],
}

export function playNote(context: BaseAudioContext, output: AudioNode, midi: number, time: number, duration: number, voice: SynthVoice, level: number, onEnd?: () => void) {
  const frequency = midiToHz(midi)
  const oscillators = new Set<OscillatorNode>()
  for (const partial of partials[voice]) {
    const oscillator = context.createOscillator()
    oscillator.frequency.value = frequency * partial.ratio
    const envelope = context.createGain()
    const attack = voice === 'soft' ? 0.04 : voice === 'piano' ? 0.011 : 0.006
    const end = time + duration + 0.12
    const peak = level * partial.level
    envelope.gain.setValueAtTime(0.0001, time)
    envelope.gain.exponentialRampToValueAtTime(peak, time + attack)
    envelope.gain.exponentialRampToValueAtTime(peak * (voice === 'soft' ? 0.78 : 0.15), time + duration * partial.tail)
    envelope.gain.exponentialRampToValueAtTime(0.0001, end)
    oscillator.connect(envelope).connect(output)
    oscillator.onended = () => {
      oscillator.disconnect()
      envelope.disconnect()
      oscillators.delete(oscillator)
      if (oscillators.size === 0) onEnd?.()
    }
    oscillators.add(oscillator)
    oscillator.start(time)
    oscillator.stop(end + 0.01)
  }
  return (stopAt: number) => oscillators.forEach(oscillator => oscillator.stop(stopAt))
}
