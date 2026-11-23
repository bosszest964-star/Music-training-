import { useCallback, useEffect, useRef, useState } from 'react'
import { createStemMixer, defaultMix } from './mixer'
import type { Loop, Project, Stem, Track } from './mixer'

const emptyLoop: Loop = { a: 0, b: 0, enabled: false }
const minLoop = 0.2

export function useMixerTransport(onActiveChange: (active: boolean) => void) {
  const [mixer] = useState(createStemMixer)
  const [project, setProject] = useState<Project | null>(null)
  const [mix, setMix] = useState(defaultMix)
  const [loop, setLoop] = useState(emptyLoop)
  const [rate, setRate] = useState(1)
  const [position, setPosition] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [starting, setStarting] = useState(false)
  const [problem, setProblem] = useState('')
  const session = useRef({
    project: null as Project | null, mix: defaultMix(), loop: emptyLoop, rate: 1,
    position: 0, playing: false, token: 0,
  })

  const pause = useCallback(() => {
    const state = session.current
    state.token += 1
    if (state.playing) state.position = mixer.position()
    state.playing = false
    mixer.stop()
    setPosition(state.position)
    setStarting(false)
    setPlaying(false)
    onActiveChange(false)
  }, [mixer, onActiveChange])

  useEffect(() => {
    const state = session.current
    function hide() { if (document.hidden) pause() }
    document.addEventListener('visibilitychange', hide)
    return () => {
      document.removeEventListener('visibilitychange', hide)
      state.token += 1
      mixer.dispose()
      onActiveChange(false)
    }
  }, [mixer, onActiveChange, pause])

  useEffect(() => {
    if (!playing) return
    let frame = 0
    let last = 0
    function tick(now: number) {
      if (!session.current.playing) return
      if (now - last >= 50) {
        last = now
        setPosition(mixer.position())
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [mixer, playing])

  function schedule() {
    const state = session.current
    const selected = state.project
    if (!selected) return
    if (state.loop.enabled && (state.position < state.loop.a || state.position >= state.loop.b)) {
      state.position = state.loop.a
      setPosition(state.position)
    }
    if (state.position >= selected.duration) {
      state.position = 0
      setPosition(0)
    }
    mixer.schedule(selected, state.position, state.rate, state.loop, state.mix, () => {
      state.playing = false
      state.position = selected.duration
      setPosition(selected.duration)
      setPlaying(false)
      onActiveChange(false)
    })
  }

  async function play() {
    if (!session.current.project) return
    const token = ++session.current.token
    setProblem('')
    setStarting(true)
    try {
      await mixer.activate()
      if (token !== session.current.token) return
      schedule()
      session.current.playing = true
      setPlaying(true)
      onActiveChange(true)
    } catch {
      if (token !== session.current.token) return
      pause()
      setProblem('เปิดระบบเสียงไม่ได้ ลองแตะเล่นอีกครั้ง')
    } finally {
      if (token === session.current.token) setStarting(false)
    }
  }

  function seek(time: number) {
    const state = session.current
    if (!state.project) return
    const value = Math.max(0, Math.min(time, state.project.duration))
    if (state.loop.enabled && (value < state.loop.a || value >= state.loop.b)) {
      state.loop = { ...state.loop, enabled: false }
      setLoop(state.loop)
    }
    if (state.playing && value >= state.project.duration) pause()
    state.position = value
    setPosition(value)
    if (state.playing) schedule()
  }

  function updateLoop(next: Loop) {
    const state = session.current
    if (state.playing) state.position = mixer.position()
    state.loop = next
    setLoop(next)
    setProblem('')
    if (state.playing) schedule()
    else if (next.enabled && (state.position < next.a || state.position >= next.b)) seek(next.a)
  }

  function mark(boundary: 'a' | 'b') {
    const state = session.current
    const now = state.playing ? mixer.position() : state.position
    const next = { ...state.loop, [boundary]: now }
    if (next.b - next.a < minLoop) {
      setProblem('A ต้องมาก่อน B อย่างน้อย 0.2 วินาที')
      return
    }
    updateLoop(next)
  }

  function toggleLoop() {
    const state = session.current
    if (!state.project || state.loop.b - state.loop.a < minLoop) return
    updateLoop({ ...state.loop, enabled: !state.loop.enabled })
  }

  function changeRate(value: number) {
    mixer.changeRate(value)
    session.current.rate = value
    setRate(value)
  }

  function changeTrack(stem: Stem, changes: Partial<Track>) {
    const state = session.current
    state.mix = { ...state.mix, [stem]: { ...state.mix[stem], ...changes } }
    setMix(state.mix)
    if (state.project) mixer.setMix(state.mix, state.project)
  }

  function load(next: Project) {
    pause()
    const state = session.current
    state.project = next
    state.position = 0
    state.mix = defaultMix()
    state.loop = { a: 0, b: next.duration, enabled: false }
    setProject(next)
    setPosition(0)
    setMix(state.mix)
    setLoop(state.loop)
    setProblem('')
  }

  return { mixer, project, load, mix, changeTrack, loop, mark, toggleLoop, rate, changeRate,
    position, seek, playing, starting, pause, play, problem }
}
