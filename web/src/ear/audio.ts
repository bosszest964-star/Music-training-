import { playNote } from '../audio/noteSynth'
import type { Voice } from '../audio/noteSynth'
import { pianoReady, playPiano } from '../audio/pianoEngine'
import type { Sound } from './exercises'

export function createEarAudio() {
  let context: AudioContext | undefined
  let output: GainNode | undefined
  let generation = 0

  function stop() {
    generation += 1
    if (!output || !context) return
    const node = output
    output = undefined
    node.gain.cancelScheduledValues(context.currentTime)
    node.gain.setTargetAtTime(0, context.currentTime, 0.009)
    window.setTimeout(() => node.disconnect(), 45)
  }

  async function play(sound: Sound, voice: Voice, onEnd: () => void, lead = 0.055) {
    stop()
    const playback = generation
    const audio = context ??= new AudioContext({ latencyHint: 'interactive' })
    await audio.resume()
    if (playback !== generation) return
    const bus = audio.createGain()
    bus.gain.value = 0.68
    bus.connect(audio.destination)
    output = bus
    const time = audio.currentTime + lead
    let end = time
    const sampled = voice === 'piano' && pianoReady(sound.cues.flatMap(cue => cue.notes))
    for (const cue of sound.cues) {
      const level = 0.38 / cue.notes.length
      for (const midi of cue.notes) {
        if (voice === 'piano') {
          playPiano(audio, bus, { midi, time: time + cue.at, duration: cue.duration, detuneCents: cue.cents, level, sampled })
        } else {
          playNote(audio, bus, midi + (cue.cents ?? 0) / 100, time + cue.at, cue.duration, voice, level)
        }
      }
      end = Math.max(end, time + cue.at + cue.duration + (voice === 'piano' ? 0.52 : 0.14))
    }

    const marker = audio.createConstantSource()
    marker.offset.value = 0
    marker.connect(bus)
    marker.onended = () => {
      if (playback !== generation) return
      bus.disconnect()
      output = undefined
      onEnd()
    }
    marker.start(time)
    marker.stop(end)
  }

  function dispose() {
    stop()
    void context?.close().catch(() => {})
    context = undefined
  }

  return { play, stop, dispose }
}
