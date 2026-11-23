import type { CSSProperties } from 'react'
import { noteLabel } from '../audio/pitch'
import type { PianoLayout } from './pianoGame'

export default function PianoKeyboard({ layout, held, targets = [], onKey }: {
  layout: PianoLayout
  held?: ReadonlySet<number>
  targets?: readonly number[]
  onKey: (id: string, midi: number, down: boolean, velocity?: number) => void
}) {
  return (
    <div className="instrument-keys">
      {layout.keys.map(key => (
        <button key={key.midi} type="button" className={`instrument-key ${key.black ? 'black' : 'white'}`}
          style={{ '--center': key.center } as CSSProperties}
          aria-label={noteLabel(key.midi)} aria-pressed={held?.has(key.midi) ?? false}
          data-held={held?.has(key.midi) || undefined} data-target={targets.includes(key.midi) || undefined}
          onPointerDown={event => {
            if (event.button !== 0) return
            event.currentTarget.setPointerCapture?.(event.pointerId)
            const velocity = event.pointerType === 'mouse' || !event.pressure ? 0.76 : 0.32 + 0.68 * event.pressure
            onKey(`pointer:${event.pointerId}`, key.midi, true, velocity)
          }}
          onLostPointerCapture={event => onKey(`pointer:${event.pointerId}`, key.midi, false)}
          onPointerUp={event => onKey(`pointer:${event.pointerId}`, key.midi, false)}
          onPointerCancel={event => onKey(`pointer:${event.pointerId}`, key.midi, false)}
          onClick={event => {
            if (event.detail !== 0) return
            onKey('keyboard', key.midi, true)
            onKey('keyboard', key.midi, false)
          }}>{noteLabel(key.midi)}</button>
      ))}
    </div>
  )
}
