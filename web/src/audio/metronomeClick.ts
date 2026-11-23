export function playMetronomeClick(
  context: BaseAudioContext, output: AudioNode, time: number, tone: 'downbeat' | 'secondary' | 'regular',
) {
  const oscillator = context.createOscillator()
  const envelope = context.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.value = tone === 'downbeat' ? 1250 : tone === 'secondary' ? 1000 : 780
  envelope.gain.setValueAtTime(0.001, time)
  envelope.gain.exponentialRampToValueAtTime(tone === 'downbeat' ? 0.9 : 0.55, time + 0.003)
  envelope.gain.exponentialRampToValueAtTime(0.001, time + 0.06)
  oscillator.connect(envelope).connect(output)
  oscillator.start(time)
  oscillator.stop(time + 0.065)
}
