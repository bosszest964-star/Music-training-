import { useCallback, useEffect, useRef, useState } from 'react'
import { playNote } from '../audio/noteSynth'
import type { SynthVoice } from '../audio/noteSynth'
import { playPiano } from '../audio/pianoEngine'

export function useStudioSound() {
  const session = useRef<{ context: AudioContext; output: GainNode } | null>(null)
  const [error, setError] = useState('')

  const stop = useCallback(() => {
    const active = session.current
    session.current = null
    if (!active) return
    active.output.disconnect()
    void active.context.close().catch(() => {})
  }, [])

  useEffect(() => stop, [stop])

  async function ready() {
    let active = session.current
    try {
      if (!session.current) {
        const context = new AudioContext({ latencyHint: 'interactive' })
        const output = context.createGain()
        output.gain.value = 0.72
        output.connect(context.destination)
        session.current = { context, output }
      }
      active = session.current
      if (active.context.state !== 'running') await active.context.resume()
      if (session.current !== active) return null
      setError('')
      return active
    } catch {
      if (active && session.current !== active) return null
      setError('เปิดระบบเสียงไม่ได้ ลองแตะเล่นเสียงใหม่อีกครั้ง')
      stop()
      return null
    }
  }

  async function sound(notes: readonly number[], voice: SynthVoice, duration: number, spread = 0) {
    const active = await ready()
    if (!active) return
    const { context, output } = active
    notes.forEach((note, index) => {
      playNote(context, output, note, context.currentTime + 0.015 + index * spread, duration, voice,
        0.30 / Math.sqrt(notes.length))
    })
  }

  async function piano(midi: number, velocity: number) {
    const active = await ready()
    if (!active) return undefined
    try {
      const { context, output } = active
      return playPiano(context, output, { midi, time: context.currentTime + 0.018, level: 0.31, velocity })
    } catch {
      setError('เล่นเสียงเปียโนไม่ได้ ลองแตะอีกครั้ง')
      return undefined
    }
  }

  return { ready, stop, sound, piano, error }
}
