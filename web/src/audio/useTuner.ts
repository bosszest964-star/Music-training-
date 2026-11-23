import { useEffect, useRef, useState } from 'react'
import { connectPitchReader, microphoneOptions } from './microphonePitch'

type Input = { stream?: MediaStream; context?: AudioContext; frame?: number }

export function useTuner() {
  const [frequency, setFrequency] = useState<number | null>(null)
  const [state, setState] = useState<'idle' | 'starting' | 'listening'>('idle')
  const [error, setError] = useState('')
  const input = useRef<Input | null>(null)

  function release() {
    const session = input.current
    input.current = null
    if (!session) return
    if (session.frame !== undefined) cancelAnimationFrame(session.frame)
    session.stream?.getTracks().forEach(track => track.stop())
    void session.context?.close().catch(() => {})
  }

  useEffect(() => release, [])

  function stop() {
    release()
    setState('idle')
    setFrequency(null)
  }

  async function start() {
    if (input.current) return
    setError('')
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError('ไมโครโฟนต้องใช้เบราว์เซอร์ที่รองรับผ่าน HTTPS หรือ localhost')
      return
    }

    const session: Input = {}
    input.current = session
    setState('starting')
    try {
      const context = new AudioContext()
      session.context = context
      // Resume from the click so mobile Safari can activate the audio context.
      const resume = context.resume()
      const request = navigator.mediaDevices.getUserMedia({
        audio: microphoneOptions,
      })
      const microphone = request.then(result => {
        if (input.current === session) session.stream = result
        else result.getTracks().forEach(track => track.stop())
        return result
      })
      const [stream] = await Promise.all([microphone, resume])
      if (input.current !== session) return
      const pitch = connectPitchReader(context, stream)

      stream.getAudioTracks().forEach(track => track.addEventListener('ended', () => {
        if (input.current !== session) return
        stop()
        setError('ไมโครโฟนหยุดทำงาน ลองเปิดใหม่อีกครั้ง')
      }))

      let lastCheck = 0
      let lastReading = 0
      let filtered: number | null = null
      function read(now: number) {
        if (now - lastCheck >= 65) {
          lastCheck = now
          const next = pitch.read()
          if (next !== null) {
            filtered = filtered && Math.abs(Math.log2(next / filtered)) < 1 / 24
              ? 0.65 * filtered + 0.35 * next : next
            lastReading = now
            setFrequency(filtered)
          } else if (now - lastReading > 250) {
            filtered = null
            setFrequency(null)
          }
        }
        session.frame = requestAnimationFrame(read)
      }

      setState('listening')
      session.frame = requestAnimationFrame(read)
    } catch (cause) {
      if (input.current !== session) return
      stop()
      const name = cause instanceof DOMException ? cause.name : ''
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setError('ยังไม่ได้รับอนุญาตให้ใช้ไมโครโฟน เปิดสิทธิ์ในเบราว์เซอร์แล้วลองอีกครั้ง')
      } else if (name === 'NotFoundError') {
        setError('ไม่พบไมโครโฟนที่เชื่อมต่ออยู่')
      } else {
        setError('เปิดไมโครโฟนไม่ได้ ตรวจสอบอุปกรณ์แล้วลองอีกครั้ง')
      }
    }
  }

  return { frequency, state, error, start, stop }
}
