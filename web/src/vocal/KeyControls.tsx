import { Minus, Plus, RotateCcw } from 'lucide-react'
import { noteLabel } from '../audio/pitch'
import { fittedRoot, limitRoot } from './music'
import type { VocalRange } from './music'

export function KeyControls({ range, span, root, disabled, onChange }: {
  range: VocalRange | null
  span: number
  root: number
  disabled: boolean
  onChange: (root: number) => void
}) {
  const recommended = fittedRoot(range, span)
  const lower = limitRoot(root - 1, span)
  const higher = limitRoot(root + 1, span)

  return (
    <div className="vocal-key-controls">
      <div className="vocal-transpose" role="group" aria-label="เลื่อนคีย์">
        <button className="square-button" aria-label="ลดคีย์ครึ่งเสียง" disabled={disabled || lower === root}
          onClick={() => onChange(lower)}><Minus size={17} /></button>
        <div>
          <span>{root !== recommended ? 'คีย์ที่เลือก' : range ? 'คีย์ตามช่วงเสียง' : 'คีย์เริ่มต้น'}</span>
          <strong>{noteLabel(root)}{span > 0 && ` – ${noteLabel(root + span)}`}</strong>
        </div>
        <button className="square-button" aria-label="เพิ่มคีย์ครึ่งเสียง" disabled={disabled || higher === root}
          onClick={() => onChange(higher)}><Plus size={17} /></button>
        {root !== recommended && <button className="subtle-button" disabled={disabled} onClick={() => onChange(recommended)}>
          <RotateCcw size={15} />คืนคีย์แนะนำ
        </button>}
      </div>
      {range && (root < range.low || root + span > range.high) && (
        <p className="vocal-help">{span > range.high - range.low
          ? 'ช่วงโน้ตของแบบฝึกกว้างกว่าช่วงเสียงที่วัดไว้ ลองเลือกแบบฝึกที่ใช้ช่วงแคบลง'
          : 'บางโน้ตอยู่นอกช่วงเสียงที่วัดไว้ ลองเลื่อนคีย์หรือกดคืนคีย์แนะนำ'}</p>
      )}
    </div>
  )
}
