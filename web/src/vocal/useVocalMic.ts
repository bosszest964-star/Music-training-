import { useEffect, useRef, useState } from 'react'
import { connectPitchReader, microphoneOptions } from '../audio/microphonePitch'
import { hzToMidi } from '../audio/pitch'
import { sampleInterval } from './music'

interface Input {
  context: AudioContext
  stream?: MediaStream
  frame: number
  cleanup?: () => void
  activate?: () => void
}

interface Capture {
  onReady: (context: AudioContext) => void
  onFrame: (time: number, pitch?: { midi: number | null; time: number }) => void
  onLost: () => void
}

function microphoneError(cause: unknown) {
  const name = cause instanceof DOMException ? cause.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'อนุญาตไมโครโฟนในการตั้งค่าของเว็บไซต์แล้วแตะเริ่มใหม่ บน Safari ให้เปิดเมนูการตั้งค่าเว็บไซต์ข้างแถบที่อยู่'
  }
  if (name === 'NotFoundError') return 'ไม่พบไมโครโฟนที่เชื่อมต่อ'
  if (name === 'NotReadableError') return 'ไมโครโฟนใช้งานไม่ได้ ตรวจสอบว่ามีแอปอื่นใช้อยู่หรือไม่ แล้วลองใหม่'
  return 'เปิดไมโครโฟนไม่ได้ ตรวจสอบสิทธิ์และอุปกรณ์เสียงแล้วลองใหม่'
}

export function useVocalMic() {
  const [state, setState] = useState<'idle' | 'requesting' | 'activation' | 'listening'>('idle')
  const [error, setError] = useState('')
  const current = useRef<Input | null>(null)

  function release() {
    const input = current.current
    current.current = null
    if (!input) return
    cancelAnimationFrame(input.frame)
    input.cleanup?.()
    input.stream?.getTracks().forEach(track => track.stop())
    void input.context.close().catch(() => {})
  }

  useEffect(() => release, [])

  function stop() {
    release()
    setState('idle')
  }

  async function start(capture: Capture) {
    if (current.current) return
    setError('')
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError('เปิดหน้านี้ผ่าน HTTPS หรือ localhost เพื่อใช้ไมโครโฟน')
      return
    }

    let input: Input | undefined
    function fail(message: string) {
      if (input && current.current !== input) return
      stop()
      capture.onLost()
      setError(message)
    }

    try {
      const context = new AudioContext({ latencyHint: 'interactive' })
      const session: Input = { context, frame: 0 }
      input = session
      current.current = session
      setState('requesting')
      // Activate from the tap while asking for permission. Safari can defer audio
      // activation until after the permission dialog or route change.
      const activation = context.resume().catch(() => {})
      const stream = await navigator.mediaDevices.getUserMedia({ audio: microphoneOptions })
      if (current.current !== session) {
        stream.getTracks().forEach(track => track.stop())
        return
      }
      session.stream = stream
      const tracks = stream.getAudioTracks()

      const interrupt = () => fail('ไมโครโฟนถูกพัก แตะเริ่มใหม่เมื่อกลับมาที่หน้านี้')
      if (document.hidden || !tracks.some(track => track.readyState !== 'ended')) {
        interrupt()
        return
      }

      let attached = false
      function begin() {
        if (attached || current.current !== session || context.state !== 'running') return
        try {
          attached = true
          session.activate = undefined
          const reader = connectPitchReader(context, stream)
          let lastSample = -Infinity
          function read() {
            if (current.current !== session) return
            const time = context.currentTime
            if (time - lastSample >= sampleInterval - 0.008) {
              lastSample = time
              const hz = reader.read()
              capture.onFrame(time, { midi: hz === null ? null : hzToMidi(hz), time: time - reader.windowSeconds / 2 })
            } else {
              capture.onFrame(time)
            }
            if (current.current === session) session.frame = requestAnimationFrame(read)
          }
          capture.onReady(context)
          setState('listening')
          session.frame = requestAnimationFrame(read)
        } catch (cause) {
          fail(microphoneError(cause))
        }
      }

      const checkVisibility = () => { if (document.hidden) interrupt() }
      const checkAudio = () => {
        if (context.state === 'running') begin()
        else if (attached || context.state === 'closed') interrupt()
      }
      document.addEventListener('visibilitychange', checkVisibility)
      window.addEventListener('pagehide', interrupt)
      context.addEventListener('statechange', checkAudio)
      for (const track of tracks) track.addEventListener('ended', interrupt)
      session.cleanup = () => {
        document.removeEventListener('visibilitychange', checkVisibility)
        window.removeEventListener('pagehide', interrupt)
        context.removeEventListener('statechange', checkAudio)
        for (const track of tracks) track.removeEventListener('ended', interrupt)
      }

      if (context.state === 'running') {
        begin()
      } else {
        const activationError = 'เริ่มระบบเสียงไม่ได้ ตรวจสอบอุปกรณ์เสียงแล้วลองอีกครั้ง'
        session.activate = () => {
          void context.resume().then(() => {
            if (context.state === 'running') begin()
            else fail(activationError)
          }, () => fail(activationError))
        }
        setState('activation')
        void activation.then(begin)
      }
    } catch (cause) {
      fail(microphoneError(cause))
    }
  }

  return { state, error, start, stop, activate: () => current.current?.activate?.() }
}
