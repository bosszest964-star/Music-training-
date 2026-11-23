import { useEffect, useRef, useState } from 'react'

type InputHandlers = {
  note: (key: string, midi: number, down: boolean) => void
  clear: () => void
}

export function useMidiInput(handlers: InputHandlers) {
  const current = useRef(handlers)
  current.current = handlers
  const access = useRef<MIDIAccess | null>(null)
  const ports = useRef(new Map<string, MIDIInput>())
  const generation = useRef(0)
  const [state, setState] = useState<'idle' | 'requesting' | 'connected'>('idle')
  const [count, setCount] = useState(0)
  const [error, setError] = useState('')
  const supported = typeof navigator.requestMIDIAccess === 'function' && window.isSecureContext

  function release() {
    generation.current += 1
    if (access.current) access.current.onstatechange = null
    access.current = null
    for (const port of ports.current.values()) {
      port.onmidimessage = null
      void port.close().catch(() => {})
    }
    ports.current.clear()
  }

  useEffect(() => release, [])

  function disconnect() {
    release()
    current.current.clear()
    setState('idle')
    setCount(0)
  }

  async function connect() {
    if (!supported || state !== 'idle') return
    const token = ++generation.current
    setState('requesting')
    setError('')
    try {
      const midi = await navigator.requestMIDIAccess({ sysex: false })
      if (token !== generation.current) return
      access.current = midi

      function refresh() {
        if (token !== generation.current) return
        const next = new Map<string, MIDIInput>()
        midi.inputs.forEach(port => {
          if (port.state === 'connected') next.set(port.id, port)
        })
        for (const [id, port] of ports.current) {
          if (next.get(id) !== port) {
            port.onmidimessage = null
            current.current.clear()
          }
        }
        for (const [id, port] of next) {
          if (ports.current.get(id) === port) continue
          port.onmidimessage = event => {
            if (!event.data || event.data.length < 3 || document.hidden) return
            const [status, pitch, velocity] = event.data
            const command = status & 0xf0
            if ((command !== 0x90 && command !== 0x80) || pitch > 127) return
            current.current.note(`midi:${id}:${status & 0x0f}:${pitch}`, pitch, command === 0x90 && velocity > 0)
          }
        }
        ports.current = next
        setCount(next.size)
      }

      midi.onstatechange = refresh
      refresh()
      setState('connected')
    } catch {
      if (token !== generation.current) return
      disconnect()
      setError('เปิด Web MIDI ไม่ได้ ตรวจสอบการอนุญาตและสายที่เชื่อมต่อ')
    }
  }

  return { state, supported, count, error, connect, disconnect }
}
