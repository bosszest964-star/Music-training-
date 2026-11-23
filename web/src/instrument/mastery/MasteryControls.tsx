import { ChevronDown, Star, Usb } from 'lucide-react'
import type { ReactNode } from 'react'
import type { useMidiInput } from '../useMidiInput'

export function MasterySelect({ label, value, disabled, onChange, children }: {
  label: string
  value: string | number
  disabled?: boolean
  onChange: (value: string) => void
  children: ReactNode
}) {
  return <label className="instrument-field">{label}
    <span className="instrument-select"><select value={value} disabled={disabled} onChange={event => onChange(event.currentTarget.value)}>
      {children}
    </select><ChevronDown size={16} /></span>
  </label>
}

export function MasteryStars({ stars, max }: { stars: number; max: number }) {
  return <span className="mastery-stars" role="img" aria-label={`${stars} จาก ${max} ดาว`}>
    {Array.from({ length: max }, (_, index) => <Star key={index} aria-hidden="true" size={16}
      className={index < stars ? 'earned' : undefined} />)}
  </span>
}

export function MidiControl({ midi }: { midi: ReturnType<typeof useMidiInput> }) {
  return (
    <>
      <button type="button" className="subtle-button" disabled={!midi.supported}
        onClick={midi.state === 'idle' ? () => void midi.connect() : midi.disconnect}>
        <Usb size={17} />{midi.state === 'requesting' ? 'ยกเลิกเชื่อมต่อ MIDI' :
          midi.state === 'connected' ? 'ตัดการเชื่อมต่อ MIDI' : 'เชื่อมต่อ Web MIDI'}
      </button>
      {!midi.supported && <span className="instrument-hint">เบราว์เซอร์นี้ใช้ Web MIDI ไม่ได้ ใช้ลิ่มเปียโนบนจอได้</span>}
      {midi.state === 'connected' && <span className="instrument-hint">
        {midi.count ? `เชื่อมต่อ ${midi.count} อุปกรณ์` : 'รอเสียบอุปกรณ์ MIDI'}
      </span>}
    </>
  )
}
