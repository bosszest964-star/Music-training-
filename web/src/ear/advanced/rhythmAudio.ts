import { resumeAudio } from '../../audio/resumeAudio'
import { playMetronomeClick } from '../../audio/metronomeClick'
import { barPulses } from './rhythmPatterns'
import type { RhythmPattern } from './rhythmPatterns'
import { audibleTime, eventTime } from './rhythmScore'

type Session = { bus: GainNode; marker: ConstantSourceNode; start: number; stateChanged: () => void }

export function createRhythmAudio() {
  let context: AudioContext | undefined
  let active: Session | undefined
  let token = 0

  function stop() {
    token += 1
    const session = active
    active = undefined
    if (!session || !context) return
    const now = context.currentTime
    context.removeEventListener('statechange', session.stateChanged)
    session.marker.onended = null
    session.marker.stop(now)
    session.marker.disconnect()
    session.bus.gain.setTargetAtTime(0, now, 0.01)
    window.setTimeout(() => session.bus.disconnect(), 45)
  }

  async function start(pattern: RhythmPattern, demo: boolean, onEnd: () => void, onInterrupt: () => void) {
    stop()
    const id = token
    const audio = context ??= new AudioContext({ latencyHint: 'interactive' })
    await resumeAudio(audio)
    if (id !== token) return
    const beat = 60 / pattern.bpm
    const count = audio.currentTime + 0.075
    const pulses = barPulses(pattern)
    const start = count + beat * pulses
    const end = start + beat * pattern.beats
    const bus = audio.createGain()
    bus.gain.value = 0.52
    bus.connect(audio.destination)
    for (let index = 0; index < pulses; index += 1) {
      playMetronomeClick(audio, bus, count + index * beat, index === 0 ? 'downbeat' : 'regular')
    }
    if (demo) {
      for (const tap of pattern.taps) playMetronomeClick(audio, bus, start + tap * beat, 'secondary')
    } else {
      for (let index = 0; index < pattern.beats; index += 1) {
        playMetronomeClick(audio, bus, start + index * beat, index % pulses === 0 ? 'downbeat' : 'regular')
      }
    }
    const marker = audio.createConstantSource()
    marker.offset.value = 0
    marker.connect(bus)
    const session = { bus, marker, start, stateChanged }
    function stateChanged() {
      if (active === session && audio.state !== 'running') onInterrupt()
    }
    active = session
    marker.onended = () => {
      if (active !== session) return
      active = undefined
      audio.removeEventListener('statechange', stateChanged)
      marker.disconnect()
      bus.disconnect()
      onEnd()
    }
    marker.start(count)
    marker.stop(end + 0.23)
    audio.addEventListener('statechange', stateChanged)
  }

  function position(timestamp = performance.now()) {
    if (!context || !active || context.state !== 'running') return null
    const now = performance.now()
    const event = eventTime(timestamp, now, performance.timeOrigin)
    const latency = context.outputLatency || context.baseLatency || 0
    return audibleTime(now, event, context.currentTime, latency, context.getOutputTimestamp?.()) - active.start
  }

  function dispose() {
    stop()
    void context?.close().catch(() => {})
    context = undefined
  }

  return { position, start, stop, dispose }
}
