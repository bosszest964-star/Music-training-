import { useEffect, useRef, useState } from 'react'
import { playMetronomeClick } from './metronomeClick'

export const meters = {
  '2/4': 2,
  '3/4': 3,
  '4/4': 4,
  '6/8': 6,
} as const

export type Meter = keyof typeof meters

export function beatDuration(bpm: number, meter: Meter) {
  return 60 / bpm / (meter === '6/8' ? 3 : 1)
}

type Beat = { time: number; index: number }
type Playback = {
  context: AudioContext
  bus: GainNode
  timer: number
  frame: number
  beats: Beat[]
  nextTime: number
  nextIndex: number
}

export function useMetronome() {
  const [bpm, setBpm] = useState(100)
  const [meter, setMeter] = useState<Meter>('4/4')
  const [running, setRunning] = useState(false)
  const [starting, setStarting] = useState(false)
  const [beat, setBeat] = useState(-1)
  const [error, setError] = useState('')
  const settings = useRef({ bpm, meter })
  const taps = useRef<number[]>([])
  const playback = useRef<Playback | null>(null)

  function changeBpm(value: number) {
    const next = Math.min(240, Math.max(30, Math.round(value)))
    settings.current.bpm = next
    setBpm(next)
  }

  function changeMeter(value: Meter) {
    settings.current.meter = value
    setMeter(value)
    if (playback.current) playback.current.nextIndex = 0
  }

  function tap() {
    const now = performance.now()
    const previous = taps.current.at(-1)
    if (previous !== undefined) {
      const gap = now - previous
      if (gap < 180) return
      if (gap > 2200) taps.current = []
    }
    taps.current = [...taps.current.slice(-4), now]
    if (taps.current.length > 1) {
      changeBpm(60_000 * (taps.current.length - 1) / (now - taps.current[0]))
    }
  }

  function release() {
    const session = playback.current
    if (!session) return
    playback.current = null
    window.clearInterval(session.timer)
    cancelAnimationFrame(session.frame)
    session.bus.disconnect()
    void session.context.close().catch(() => {})
  }

  useEffect(() => release, [])

  async function start() {
    if (playback.current) return
    setError('')
    setStarting(true)
    let session: Playback | undefined
    try {
      const context = new AudioContext({ latencyHint: 'interactive' })
      const bus = context.createGain()
      bus.gain.value = 0.44
      bus.connect(context.destination)
      const nextPlayback: Playback = {
        context, bus, timer: 0, frame: 0, beats: [], nextTime: 0, nextIndex: 0,
      }
      session = nextPlayback
      playback.current = nextPlayback
      await context.resume()
      if (playback.current !== session) return
      nextPlayback.nextTime = context.currentTime + 0.045

      function schedule() {
        const now = context.currentTime
        if (context.state !== 'running') return
        const { bpm, meter } = settings.current
        const duration = beatDuration(bpm, meter)
        if (nextPlayback.nextTime < now) {
          const missed = Math.ceil((now - nextPlayback.nextTime) / duration)
          nextPlayback.nextTime += missed * duration
          nextPlayback.nextIndex = (nextPlayback.nextIndex + missed) % meters[meter]
        }

        while (nextPlayback.nextTime < now + 0.1) {
          const time = nextPlayback.nextTime
          const index = nextPlayback.nextIndex % meters[meter]
          const secondary = meter === '6/8' && index === 3
          playMetronomeClick(context, bus, time, index === 0 ? 'downbeat' : secondary ? 'secondary' : 'regular')
          nextPlayback.beats.push({ time, index })
          while (nextPlayback.beats[0]?.time < now - 1) nextPlayback.beats.shift()
          nextPlayback.nextTime += duration
          nextPlayback.nextIndex = (index + 1) % meters[meter]
        }
      }

      function paint() {
        const timestamp = context.getOutputTimestamp?.()
        const audibleTime = timestamp?.performanceTime ? timestamp.contextTime ?? 0 : context.currentTime
        let audibleBeat: Beat | undefined
        while (nextPlayback.beats[0]?.time <= audibleTime) audibleBeat = nextPlayback.beats.shift()
        if (audibleBeat) setBeat(audibleBeat.index)
        nextPlayback.frame = requestAnimationFrame(paint)
      }

      schedule()
      nextPlayback.timer = window.setInterval(schedule, 25)
      nextPlayback.frame = requestAnimationFrame(paint)
      setRunning(true)
    } catch {
      if (session && playback.current !== session) return
      if (session) {
        release()
        setError('เปิดเสียงเมโทรนอมไม่ได้ ลองแตะเริ่มอีกครั้ง')
      } else {
        setError('เบราว์เซอร์นี้เปิดเสียงเมโทรนอมไม่ได้')
      }
    } finally {
      if (!playback.current || playback.current === session) setStarting(false)
    }
  }

  function stop() {
    release()
    setRunning(false)
    setStarting(false)
    setBeat(-1)
  }

  return { bpm, changeBpm, meter, changeMeter, running, starting, beat, error, tap, start, stop }
}
