import { resumeAudio } from '../audio/resumeAudio'
import { waveformPeaks } from '../instrument/audioDeck'

export const stems = ['vocals', 'drums', 'bass', 'other'] as const
export type Stem = typeof stems[number]
export const stemLabels: Record<Stem, string> = { vocals: 'ร้อง', drums: 'กลอง', bass: 'เบส', other: 'ดนตรีอื่น ๆ' }
export const sources = { gpu: 'Local GPU Engine', browser: 'แยกย่านในเบราว์เซอร์', files: 'นำเข้าแทร็กแยก' } as const
export type SourceMode = keyof typeof sources

export interface Track {
  volume: number
  mute: boolean
  solo: boolean
}

export type Mix = Record<Stem, Track>
export type Buffers = Partial<Record<Stem, AudioBuffer>>
export interface Loop {
  a: number
  b: number
  enabled: boolean
}
export type Project = {
  name: string
  duration: number
  waves: Partial<Record<Stem, Float32Array>>
} & (
  | { mode: 'browser'; buffer: AudioBuffer }
  | { mode: 'gpu' | 'files'; buffers: Buffers }
)

export function defaultMix(): Mix {
  return {
    vocals: { volume: 0.85, mute: false, solo: false },
    drums: { volume: 0.85, mute: false, solo: false },
    bass: { volume: 0.85, mute: false, solo: false },
    other: { volume: 0.85, mute: false, solo: false },
  }
}

export function availableTracks(project: Project | null) {
  return project?.mode === 'browser' ? [...stems] : stems.filter(stem => !!project?.buffers[stem])
}

export function trackLevels(mix: Mix, available: Stem[]) {
  const solo = available.some(stem => mix[stem].solo)
  const level = (stem: Stem) => available.includes(stem) && !mix[stem].mute && (!solo || mix[stem].solo) ? mix[stem].volume : 0
  return { vocals: level('vocals'), drums: level('drums'), bass: level('bass'), other: level('other') }
}

export function loopPosition(value: number, loop: Loop) {
  if (!loop.enabled || loop.b <= loop.a) return value
  if (value < loop.a) return loop.a
  return loop.a + (value - loop.a) % (loop.b - loop.a)
}

export function projectTime(offset: number, elapsed: number, speed: number, duration: number, loop: Loop) {
  return Math.min(duration, loopPosition(offset + Math.max(0, elapsed) * speed, loop))
}

function filters(context: BaseAudioContext, input: AudioNode, output: AudioNode, bands: Array<[BiquadFilterType, number]>) {
  let upstream = input
  const nodes = bands.map(([type, hz]) => {
    const node = context.createBiquadFilter()
    node.type = type
    node.frequency.value = hz
    node.Q.value = Math.SQRT1_2
    upstream.connect(node)
    upstream = node
    return node
  })
  upstream.connect(output)
  return () => nodes.forEach(node => node.disconnect())
}

export function connectBands(context: BaseAudioContext, input: AudioNode, channels: number, outputs: Record<Stem, AudioNode>) {
  const mid = context.createGain()
  mid.channelCount = 1
  mid.channelCountMode = 'explicit'
  const side = context.createChannelMerger(2)
  const nodes: AudioNode[] = [mid, side]
  if (channels >= 2) {
    const split = context.createChannelSplitter(2)
    input.connect(split)
    nodes.push(split)
    for (let channel = 0; channel < 2; channel += 1) {
      const sum = context.createGain()
      const positive = context.createGain()
      const negative = context.createGain()
      sum.gain.value = 0.5
      positive.gain.value = 0.5
      negative.gain.value = -0.5
      split.connect(sum, channel)
      split.connect(positive, channel)
      split.connect(negative, channel)
      sum.connect(mid)
      positive.connect(side, 0, channel)
      negative.connect(side, 0, 1 - channel)
      nodes.push(sum, positive, negative)
    }
  } else {
    input.connect(mid)
  }
  const release = [
    filters(context, mid, outputs.vocals, [['highpass', 180], ['lowpass', 3400]]),
    filters(context, mid, outputs.bass, [['lowpass', 180]]),
    filters(context, input, outputs.drums, [['highpass', 4300]]),
    filters(context, side, outputs.other, [['highpass', 150], ['lowpass', 8200]]),
  ]
  return () => {
    release.forEach(disconnect => disconnect())
    nodes.forEach(node => node.disconnect())
  }
}

function padStems(context: BaseAudioContext, input: Buffers) {
  const frames = Math.max(...stems.map(stem => input[stem]?.length ?? 0))
  if (!frames) throw new Error('เลือกแทร็กเสียงอย่างน้อยหนึ่งไฟล์')
  const result: Buffers = {}
  const waves: Project['waves'] = {}
  for (const stem of stems) {
    const buffer = input[stem]
    if (!buffer) continue
    if (buffer.length === frames) {
      result[stem] = buffer
    } else {
      const padded = context.createBuffer(buffer.numberOfChannels, frames, buffer.sampleRate)
      for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
        padded.copyToChannel(buffer.getChannelData(channel), channel)
      }
      result[stem] = padded
    }
    waves[stem] = waveformPeaks(result[stem], 56)
  }
  return { buffers: result, waves, duration: frames / context.sampleRate }
}

interface Playing {
  clips: AudioBufferSourceNode[]
  disconnect: () => void
  start: number
  offset: number
  rate: number
  duration: number
  loop: Loop
}

export function createStemMixer() {
  let session: { context: AudioContext; tracks: Record<Stem, GainNode> } | null = null
  let playing: Playing | null = null

  function ready() {
    if (session) return session
    const context = new AudioContext({ latencyHint: 'playback' })
    const tracks = {
      vocals: context.createGain(), drums: context.createGain(), bass: context.createGain(), other: context.createGain(),
    }
    const limiter = context.createDynamicsCompressor()
    limiter.threshold.value = -7
    limiter.ratio.value = 10
    const output = context.createGain()
    output.gain.value = 0.86
    limiter.connect(output).connect(context.destination)
    Object.values(tracks).forEach(track => track.connect(limiter))
    session = { context, tracks }
    return session
  }

  function position() {
    if (!session || !playing) return 0
    return projectTime(playing.offset, session.context.currentTime - playing.start, playing.rate, playing.duration, playing.loop)
  }

  function stop() {
    const active = playing
    playing = null
    if (!active) return
    for (const clip of active.clips) {
      clip.onended = null
      try {
        clip.stop()
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'InvalidStateError')) throw error
      } finally {
        clip.disconnect()
      }
    }
    active.disconnect()
  }

  function setMix(mix: Mix, project: Project, immediate = false) {
    const active = session
    if (!active) return
    const levels = trackLevels(mix, availableTracks(project))
    for (const stem of stems) {
      const gain = active.tracks[stem].gain
      const now = active.context.currentTime
      gain.cancelScheduledValues(now)
      if (immediate) gain.setValueAtTime(levels[stem], now)
      else gain.setTargetAtTime(levels[stem], now, 0.018)
    }
  }

  function schedule(project: Project, offset: number, rate: number, loop: Loop, mix: Mix, ended: () => void) {
    const active = ready()
    stop()
    const { context, tracks } = active
    const start = context.currentTime + 0.055
    const startOffset = loopPosition(offset >= project.duration ? 0 : offset, loop)
    const current: Playing = { clips: [], disconnect: () => {}, start, offset: startOffset, rate, duration: project.duration, loop }
    playing = current
    setMix(mix, project, true)

    function clip(buffer: AudioBuffer) {
      const node = context.createBufferSource()
      node.buffer = buffer
      node.playbackRate.value = rate
      node.loop = loop.enabled
      if (loop.enabled) {
        node.loopStart = loop.a
        node.loopEnd = loop.b
      }
      current.clips.push(node)
      return node
    }

    if (project.mode === 'browser') {
      const node = clip(project.buffer)
      current.disconnect = connectBands(context, node, project.buffer.numberOfChannels, tracks)
    } else {
      for (const stem of stems) {
        const buffer = project.buffers[stem]
        if (buffer) clip(buffer).connect(tracks[stem])
      }
    }
    let remaining = current.clips.length
    for (const node of current.clips) {
      node.onended = () => {
        if (playing !== current) return
        remaining -= 1
        if (remaining === 0) {
          playing = null
          current.clips.forEach(source => source.disconnect())
          current.disconnect()
          ended()
        }
      }
      node.start(start, startOffset)
    }
  }

  async function activate() {
    const active = ready()
    await resumeAudio(active.context)
    if (session !== active || active.context.state !== 'running') throw new Error('เปิดระบบเสียงไม่ได้ ลองแตะเล่นอีกครั้ง')
  }

  function changeRate(rate: number) {
    if (!session || !playing) return
    const now = session.context.currentTime
    playing.offset = position()
    playing.start = Math.max(now, playing.start)
    playing.rate = rate
    for (const clip of playing.clips) clip.playbackRate.setValueAtTime(rate, now)
  }

  async function decode(bytes: ArrayBuffer) {
    return ready().context.decodeAudioData(bytes)
  }

  function fromStems(mode: 'gpu' | 'files', name: string, buffers: Buffers): Project {
    return { mode, name, ...padStems(ready().context, buffers) }
  }

  function fromSong(name: string, buffer: AudioBuffer): Project {
    return { mode: 'browser', name, buffer, duration: buffer.duration, waves: {} }
  }

  function dispose() {
    stop()
    const active = session
    session = null
    void active?.context.close().catch(() => {})
  }

  return { activate, changeRate, decode, dispose, fromSong, fromStems, position, schedule, setMix, stop }
}
