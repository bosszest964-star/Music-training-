import { midiToHz } from './pitch'

export type Voice = 'piano' | 'soft'

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

export function playNote(context: AudioContext, output: AudioNode, midi: number, time: number, duration: number, voice: Voice, level: number) {
  const frequency = midiToHz(midi)
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
