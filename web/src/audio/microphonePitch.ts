import { createPitchDetector } from './pitch'

export const microphoneOptions: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: false,
  channelCount: 1,
}

export function connectPitchReader(context: AudioContext, stream: MediaStream) {
  const highpass = context.createBiquadFilter()
  highpass.type = 'highpass'
  highpass.frequency.value = 30
  const lowpass = context.createBiquadFilter()
  lowpass.type = 'lowpass'
  lowpass.frequency.value = 3000
  const analyser = context.createAnalyser()
  // Keep roughly 85–170 ms in the analysis window across device sample rates.
  analyser.fftSize = 2 ** Math.ceil(Math.log2(context.sampleRate * 0.085))
  const silentOutput = context.createGain()
  silentOutput.gain.value = 0
  context.createMediaStreamSource(stream).connect(highpass).connect(lowpass).connect(analyser)
  analyser.connect(silentOutput).connect(context.destination)

  const waveform = new Float32Array(analyser.fftSize)
  const detect = createPitchDetector(context.sampleRate, waveform.length)
  return {
    windowSeconds: waveform.length / context.sampleRate,
    read() {
      analyser.getFloatTimeDomainData(waveform)
      return detect(waveform)
    },
  }
}
