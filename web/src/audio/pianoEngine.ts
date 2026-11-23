import { playNote } from './noteSynth'

type Sample = { state: 'loading' | 'failed' } | { state: 'ready'; buffer: AudioBuffer }
const bank = new Map<number, Sample>()
const listeners = new Set<() => void>()
let revision = 0
let decoder: OfflineAudioContext | undefined
let decodedSize = 0
const decodedLimit = 40 * 1024 * 1024
const pianoLow = 21
const pianoHigh = 108
const roomLength = 0.38
const releaseSeconds = 0.31

export function pianoAnchor(midi: number) {
  return pianoLow + 3 * Math.max(0, Math.min(29, Math.round((midi - pianoLow) / 3)))
}

function filename(anchor: number) {
  const name = { 0: 'C', 3: 'Ds', 6: 'Fs', 9: 'A' }[anchor % 12]
  return `${name}${Math.floor(anchor / 12) - 1}.mp3`
}

function supported(midi: number) {
  return midi >= pianoLow && midi <= pianoHigh
}

export function pianoAnchors(notes: readonly number[]) {
  return [...new Set(notes.filter(supported).map(pianoAnchor))].sort((a, b) => a - b)
}

export function subscribePiano(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function pianoRevision() {
  return revision
}

function changed() {
  revision += 1
  listeners.forEach(listener => listener())
}

function size(buffer: AudioBuffer) {
  return buffer.length * buffer.numberOfChannels * Float32Array.BYTES_PER_ELEMENT
}

function remember(anchor: number, buffer: AudioBuffer) {
  const bytes = size(buffer)
  if (decodedSize + bytes > decodedLimit) {
    for (const [key, sample] of bank) {
      if (sample.state !== 'ready') continue
      bank.delete(key)
      decodedSize -= size(sample.buffer)
      if (decodedSize + bytes <= decodedLimit) break
    }
  }
  bank.delete(anchor)
  bank.set(anchor, { state: 'ready', buffer })
  decodedSize += bytes
}

function shorten(context: BaseAudioContext, buffer: AudioBuffer) {
  // The distribution files retain the full recording. Trim very long decoded
  // tails in memory to limit the cost of warm-up on mobile devices.
  const end = Math.round(buffer.sampleRate * 6.5)
  if (buffer.length <= end) return buffer
  const result = context.createBuffer(buffer.numberOfChannels, end, buffer.sampleRate)
  const fade = Math.round(buffer.sampleRate * 0.27)
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    result.copyToChannel(buffer.getChannelData(channel).subarray(0, end), channel)
    const samples = result.getChannelData(channel)
    for (let frame = end - fade; frame < end; frame += 1) samples[frame] *= (end - 1 - frame) / fade
  }
  return result
}

export function preloadPianoAnchors(anchors: readonly number[], retry = false) {
  const pending = anchors.filter(anchor => !bank.has(anchor) || (retry && bank.get(anchor)?.state === 'failed'))
  if (!pending.length) return
  pending.forEach(anchor => bank.set(anchor, { state: 'loading' }))
  changed()
  for (const anchor of pending) void load(anchor)
}

async function load(anchor: number) {
  const timeout = new AbortController()
  const timer = globalThis.setTimeout(() => timeout.abort(), 9000)
  try {
    const response = await fetch(`/audio/salamander/${filename(anchor)}`, { signal: timeout.signal })
    if (!response.ok) throw new Error(`Sample HTTP ${response.status}`)
    const bytes = await response.arrayBuffer()
    decoder ??= new OfflineAudioContext(2, 1, 44_100)
    remember(anchor, shorten(decoder, await decoder.decodeAudioData(bytes)))
  } catch {
    bank.set(anchor, { state: 'failed' })
  } finally {
    globalThis.clearTimeout(timer)
    changed()
  }
}

export function pianoStatus(anchors: readonly number[]) {
  return {
    ready: anchors.filter(anchor => bank.get(anchor)?.state === 'ready').length,
    failed: anchors.filter(anchor => bank.get(anchor)?.state === 'failed').length,
  }
}

export function pianoReady(notes: readonly number[]) {
  return notes.length > 0 && notes.every(note => supported(note) && bank.get(pianoAnchor(note))?.state === 'ready')
}

const rooms = new WeakMap<AudioNode, ConvolverNode>()
const impulses = new WeakMap<BaseAudioContext, AudioBuffer>()

function studioRoom(context: BaseAudioContext, output: AudioNode) {
  let room = rooms.get(output)
  if (room) return room
  let impulse = impulses.get(context)
  if (!impulse) {
    const length = Math.floor(context.sampleRate * roomLength)
    impulse = context.createBuffer(2, length, context.sampleRate)
    let seed = 117
    for (let channel = 0; channel < 2; channel += 1) {
      const samples = impulse.getChannelData(channel)
      for (let frame = Math.round(context.sampleRate * 0.01); frame < length; frame += 1) {
        seed = (1664525 * seed + 1013904223) >>> 0
        samples[frame] = (seed / 2 ** 31 - 1) * (1 - frame / length) ** 4.8
      }
      samples[Math.round(context.sampleRate * (channel ? 0.018 : 0.015))] += 0.45
    }
    impulses.set(context, impulse)
  }
  room = context.createConvolver()
  room.buffer = impulse
  const wet = context.createGain()
  wet.gain.value = 0.14
  room.connect(wet).connect(output)
  rooms.set(output, room)
  return room
}

interface PianoNote {
  midi: number
  time: number
  level: number
  velocity?: number
  duration?: number
  sampled?: boolean
  detuneCents?: number
}

export function playPiano(context: BaseAudioContext, output: AudioNode, note: PianoNote) {
  const { midi, time, level, duration, sampled = true } = note
  const velocity = Math.max(0.02, Math.min(1, note.velocity ?? 0.76))
  const anchor = pianoAnchor(midi)
  const pitch = midi + (note.detuneCents ?? 0) / 100
  const weight = (0.16 + 0.84 * velocity ** 1.5) / (0.16 + 0.84 * 0.76 ** 1.5)
  const sample = sampled && supported(midi) ? bank.get(anchor) : undefined
  if (supported(midi)) preloadPianoAnchors([anchor])

  const envelope = context.createGain()
  envelope.connect(output)
  envelope.connect(studioRoom(context, output))
  let stopAt: (when: number) => void
  let strength = 1

  if (sample?.state === 'ready') {
    // Retain useful decoded notes when another octave is loaded.
    bank.delete(anchor)
    bank.set(anchor, sample)
    const source = context.createBufferSource()
    source.buffer = sample.buffer
    source.playbackRate.value = 2 ** ((pitch - anchor) / 12)
    const tone = context.createBiquadFilter()
    tone.type = 'lowpass'
    tone.frequency.value = Math.min(context.sampleRate * 0.48, 1500 + 15_000 * velocity ** 1.2)
    tone.Q.value = 0.65
    source.connect(tone).connect(envelope)
    strength = 2.05 * level * weight
    source.onended = () => {
      source.disconnect()
      tone.disconnect()
      envelope.disconnect()
    }
    source.start(time)
    stopAt = when => source.stop(when)
  } else {
    stopAt = playNote(context, envelope, pitch, time, duration ?? 6, 'piano', level * weight, () => envelope.disconnect())
  }

  envelope.gain.setValueAtTime(0.0001, time)
  envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, strength), time + 0.007)
  let released = false
  function release(when = Math.max(context.currentTime, time + 0.008)) {
    if (released || context.state === 'closed') return
    released = true
    envelope.gain.cancelScheduledValues(when)
    envelope.gain.setValueAtTime(Math.max(0.0002, strength), when)
    envelope.gain.exponentialRampToValueAtTime(0.0001, when + releaseSeconds)
    stopAt(when + releaseSeconds + 0.01)
  }
  if (duration !== undefined) release(time + Math.max(0.009, duration))
  return release
}
