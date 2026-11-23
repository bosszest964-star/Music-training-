export const presets = {
  flat: 'ต้นฉบับ',
  bass: 'เน้นไลน์เบส',
  guitar: 'เน้นเสียงกลาง / กีตาร์',
  center: 'ลดเสียงร้องตรงกลาง',
} as const

export type Preset = keyof typeof presets
export const minLoopLength = 0.2

export function loopSeek(time: number, loop: { a: number; b: number; enabled: boolean }) {
  return loop.enabled && (time < loop.a || time >= loop.b) ? loop.a : time
}

export function preservePitch(audio: HTMLAudioElement) {
  const legacy: HTMLAudioElement & { webkitPreservesPitch?: boolean } = audio
  if ('preservesPitch' in audio) audio.preservesPitch = true
  if ('webkitPreservesPitch' in legacy) legacy.webkitPreservesPitch = true
}

export function createDeckGraph(audio: HTMLAudioElement) {
  const context = new AudioContext({ latencyHint: 'playback' })
  try {
    const splitter = context.createChannelSplitter(2)
    const side = context.createChannelMerger(2)
    for (let channel = 0; channel < 2; channel += 1) {
      const same = context.createGain()
      const cross = context.createGain()
      same.gain.value = 0.60
      cross.gain.value = -0.51
      splitter.connect(same, channel)
      splitter.connect(cross, 1 - channel)
      same.connect(side, 0, channel)
      cross.connect(side, 0, channel)
    }
    const sideVolume = context.createGain()
    side.connect(sideVolume).connect(context.destination)

    const flatVolume = context.createGain()
    flatVolume.connect(context.destination)
    const highpass = context.createBiquadFilter()
    const lowpass = context.createBiquadFilter()
    const boost = context.createBiquadFilter()
    const dryVolume = context.createGain()
    highpass.type = 'highpass'
    lowpass.type = 'lowpass'
    boost.type = 'peaking'
    boost.Q.value = 0.8
    highpass.connect(lowpass).connect(boost).connect(dryVolume).connect(context.destination)

    function setPreset(preset: Preset) {
      const now = context.currentTime
      const bass = preset === 'bass'
      const guitar = preset === 'guitar'
      const center = preset === 'center'
      highpass.frequency.setTargetAtTime(guitar ? 220 : 10, now, 0.025)
      lowpass.frequency.setTargetAtTime(bass ? 390 : guitar ? 4700 : context.sampleRate / 2, now, 0.025)
      boost.frequency.setTargetAtTime(bass ? 120 : 1450, now, 0.025)
      boost.gain.setTargetAtTime(bass ? 5 : guitar ? 4 : 0, now, 0.025)
      flatVolume.gain.setTargetAtTime(preset === 'flat' ? 1 : 0, now, 0.025)
      dryVolume.gain.setTargetAtTime(bass || guitar ? 0.65 : 0, now, 0.025)
      sideVolume.gain.setTargetAtTime(center ? 1 : 0, now, 0.025)
    }

    // Initialise the bypass before connecting the media element.
    flatVolume.gain.value = 1
    dryVolume.gain.value = 0
    sideVolume.gain.value = 0
    highpass.frequency.value = 10
    lowpass.frequency.value = context.sampleRate / 2
    const source = context.createMediaElementSource(audio)
    source.connect(flatVolume)
    source.connect(highpass)
    source.connect(splitter)
    return { context, setPreset }
  } catch (error) {
    void context.close().catch(() => {})
    throw error
  }
}

export function waveformPeaks(buffer: Pick<AudioBuffer, 'numberOfChannels' | 'length' | 'getChannelData'>, bins = 540) {
  const channels = Array.from({ length: Math.min(buffer.numberOfChannels, 2) }, (_, channel) => buffer.getChannelData(channel))
  const peaks = new Float32Array(bins)
  let max = 0
  for (let bin = 0; bin < bins; bin += 1) {
    const from = Math.floor(bin / bins * buffer.length)
    const to = Math.min(buffer.length, Math.max(from + 1, Math.floor((bin + 1) / bins * buffer.length)))
    const step = Math.max(1, Math.floor((to - from) / 700))
    let peak = 0
    for (const channel of channels) {
      for (let frame = from; frame < to; frame += step) peak = Math.max(peak, Math.abs(channel[frame]))
    }
    peaks[bin] = peak
    max = Math.max(max, peak)
  }
  if (max > 0) for (let bin = 0; bin < bins; bin += 1) peaks[bin] /= max
  return peaks
}

export async function decodeWaveform(file: File) {
  const context = new OfflineAudioContext(1, 1, 44_100)
  const buffer = await context.decodeAudioData(await file.arrayBuffer())
  return { peaks: waveformPeaks(buffer), channels: buffer.numberOfChannels }
}
