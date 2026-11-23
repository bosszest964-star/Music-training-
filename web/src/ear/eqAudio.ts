import { pianoReady } from '../audio/pianoEngine'
import { loopPianoNotes, pinkLoop, renderMusicalLoop } from './eqLoops'
import type { EqSource } from './eqLoops'

type Filter = { hz: number; db: number }
type Playback = {
  source: AudioBufferSourceNode
  filter: BiquadFilterNode
  bus: GainNode
  starts: number
  boostStarted: number | null
  boostTotal: number
}

export function createEqAudio() {
  let context: AudioContext | undefined
  let playhead: Playback | undefined
  let settings: Filter = { hz: 1000, db: 0 }
  let generation = 0
  let fileBuffer: { file: File; audio: AudioBuffer } | undefined
  const loops = new Map<string, Promise<AudioBuffer>>()

  function boostedSeconds() {
    if (!context || !playhead) return 0
    const { boostStarted, boostTotal } = playhead
    return boostTotal + (boostStarted === null ? 0 : Math.max(0, context.currentTime - boostStarted))
  }

  function setFilter(next: Filter, reset = false) {
    settings = next
    if (!context || !playhead) return
    const now = context.currentTime
    playhead.boostTotal = reset ? 0 : boostedSeconds()
    playhead.boostStarted = next.db > 0 ? Math.max(now, playhead.starts) : null
    playhead.filter.frequency.cancelScheduledValues(now)
    playhead.filter.gain.cancelScheduledValues(now)
    playhead.filter.frequency.setTargetAtTime(next.hz, now, 0.018)
    playhead.filter.gain.setTargetAtTime(next.db, now, 0.018)
  }

  function stop() {
    generation += 1
    const active = playhead
    playhead = undefined
    if (!active || !context) return
    const now = context.currentTime
    active.bus.gain.setTargetAtTime(0, now, 0.012)
    active.source.onended = () => {
      active.source.disconnect()
      active.filter.disconnect()
      active.bus.disconnect()
    }
    active.source.stop(now + 0.06)
  }

  async function getLoop(audio: AudioContext, source: EqSource, sampled: boolean, file?: File) {
    if (source === 'file') {
      if (!file) throw new Error('เลือกไฟล์เพลงจากเครื่องก่อนเล่น')
      if (fileBuffer?.file === file) return fileBuffer.audio
      const decoded = await audio.decodeAudioData(await file.arrayBuffer())
      return decoded
    }
    if (source === 'noise') return pinkLoop(audio)
    const id = source === 'piano' ? `piano:${sampled ? 'sampled' : 'fallback'}` : source
    let loop = loops.get(id)
    if (!loop) {
      // Once the real notes are ready the temporary synth render can be freed.
      if (sampled) loops.delete('piano:fallback')
      loop = renderMusicalLoop(source, sampled).catch(error => {
        loops.delete(id)
        throw error
      })
      loops.set(id, loop)
    }
    return loop
  }

  async function play(type: EqSource, file?: File) {
    stop()
    const ticket = generation
    const audio = context ??= new AudioContext({ latencyHint: 'playback' })
    // This starts from the original button gesture, before any file decoding.
    await audio.resume()
    if (ticket !== generation) return null
    const sampled = type === 'piano' && pianoReady(loopPianoNotes)
    const buffer = await getLoop(audio, type, sampled, file)
    if (ticket !== generation) return null
    if (type === 'file' && file) fileBuffer = { file, audio: buffer }
    const source = audio.createBufferSource()
    const filter = audio.createBiquadFilter()
    const bus = audio.createGain()
    const starts = audio.currentTime + 0.042
    source.buffer = buffer
    source.loop = true
    filter.type = 'peaking'
    filter.Q.value = 1.12
    filter.frequency.value = settings.hz
    filter.gain.value = settings.db
    bus.gain.setValueAtTime(0, starts)
    bus.gain.linearRampToValueAtTime(type === 'file' ? 0.24 : 0.49, starts + 0.055)
    source.connect(filter).connect(bus).connect(audio.destination)
    source.start(starts)
    playhead = {
      source, filter, bus, starts, boostStarted: settings.db > 0 ? starts : null, boostTotal: 0,
    }
    return { pianoFallback: type === 'piano' && !sampled }
  }

  function dispose() {
    stop()
    void context?.close().catch(() => {})
    context = undefined
    fileBuffer = undefined
    loops.clear()
  }

  return { boostedSeconds, setFilter, play, stop, dispose }
}
