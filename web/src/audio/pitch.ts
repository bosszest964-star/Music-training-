const noteNames = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']

export const instruments = {
  chromatic: { label: 'โครมาติก', strings: [] },
  guitar: { label: 'กีตาร์', strings: [40, 45, 50, 55, 59, 64] },
  bass: { label: 'เบส', strings: [28, 33, 38, 43] },
  ukulele: { label: 'อูคูเลเล่', strings: [67, 60, 64, 69] },
} as const

export type Instrument = keyof typeof instruments

export function noteLabel(midi: number) {
  return noteNames[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1)
}

export function hzToMidi(hz: number) {
  return 69 + 12 * Math.log2(hz / 440)
}

export function midiToHz(midi: number) {
  return 440 * 2 ** ((midi - 69) / 12)
}

export function getReading(hz: number, instrument: Instrument, selectedString: number | null) {
  const measuredMidi = hzToMidi(hz)
  const strings: readonly number[] = instruments[instrument].strings
  const targetMidi = selectedString ?? (strings.length
    ? strings.reduce((closest, string) =>
      Math.abs(string - measuredMidi) < Math.abs(closest - measuredMidi) ? string : closest)
    : Math.round(measuredMidi))
  return {
    note: noteLabel(Math.round(measuredMidi)),
    target: noteLabel(targetMidi),
    hz,
    cents: Math.round((measuredMidi - targetMidi) * 100),
    targetMidi,
  }
}

/** YIN difference function with a quiet-input gate and a confidence threshold. */
export function createPitchDetector(sampleRate: number, frameSize: number) {
  const stride = Math.max(1, Math.floor(sampleRate / 12_000))
  const rate = sampleRate / stride
  const samples = new Float32Array(Math.floor(frameSize / stride))
  const maxLag = Math.min(Math.floor(rate / 36), Math.floor(samples.length / 2) - 1)
  const minLag = Math.max(2, Math.floor(rate / 1600))
  const differences = new Float32Array(maxLag + 1)
  const normalized = new Float32Array(maxLag + 1)
  const windowSize = samples.length - maxLag

  return (waveform: Float32Array): number | null => {
    let energy = 0
    for (let index = 0; index < samples.length; index += 1) {
      let sample = 0
      for (let offset = 0; offset < stride; offset += 1) sample += waveform[index * stride + offset]
      sample /= stride
      samples[index] = sample
      energy += sample * sample
    }
    if (Math.sqrt(energy / samples.length) < 0.008) return null

    let cumulative = 0
    for (let lag = 1; lag <= maxLag; lag += 1) {
      let difference = 0
      for (let index = 0; index < windowSize; index += 1) {
        const delta = samples[index] - samples[index + lag]
        difference += delta * delta
      }
      cumulative += difference
      differences[lag] = difference
      normalized[lag] = cumulative ? difference * lag / cumulative : 1
      if (lag <= minLag || normalized[lag - 1] >= 0.16) continue
      if (differences[lag - 1] > differences[lag - 2] || differences[lag - 1] > differences[lag]) continue
      const left = differences[lag - 2]
      const center = differences[lag - 1]
      const right = differences[lag]
      const curvature = left - 2 * center + right
      const correction = curvature > 0 ? (left - right) / (2 * curvature) : 0
      return rate / (lag - 1 + correction)
    }
    return null
  }
}
