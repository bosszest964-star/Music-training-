import { useState } from 'react'
import { Check, Mic, RotateCcw, Square } from 'lucide-react'
import { noteLabel } from '../audio/pitch'
import { holdSeconds, nearestVoiceGroup, pitchLimits, trackHold, voiceGroups } from './music'
import type { NoteHold, VocalRange } from './music'
import { useMicrophonePitch } from '../audio/useMicrophonePitch'

const emptyReading = { midi: null as number | null, hold: 0, best: null as number | null }

export function RangeResult({ range }: { range: VocalRange }) {
  const group = nearestVoiceGroup(range)
  return (
    <div className="vocal-range-result">
      <div><span>ช่วงเสียงที่บันทึกไว้</span><strong>{noteLabel(range.low)}–{noteLabel(range.high)}</strong></div>
      <div><span>กลุ่มเสียงอ้างอิงใกล้สุด</span><strong>{group.name}</strong><small>{noteLabel(group.low)}–{noteLabel(group.high)}</small></div>
    </div>
  )
}

export default function RangeTest({ range, save }: { range: VocalRange | null; save: (range: VocalRange) => void }) {
  const mic = useMicrophonePitch()
  const [stage, setStage] = useState<'low' | 'high'>('low')
  const [testing, setTesting] = useState(false)
  const [low, setLow] = useState<number | null>(null)
  const [reading, setReading] = useState(emptyReading)
  const busy = mic.state !== 'idle'
  const high = stage === 'high'
  const boundary = high ? 'สูง' : 'ต่ำ'

  function start() {
    setTesting(true)
    setReading(emptyReading)
    let hold: NoteHold | null = null
    let best: number | null = null
    void mic.start({
      onReady() {},
      onFrame(_time, pitch) {
        if (!pitch) return
        hold = trackHold(hold, pitch.midi, pitch.time)
        const seconds = hold ? hold.last - hold.start : 0
        if (hold && seconds >= holdSeconds) {
          const stable = Math.max(pitchLimits.low, Math.min(pitchLimits.high, Math.round(hold.mean)))
          if (!high || low === null || stable >= low) {
            best = best === null ? stable : high ? Math.max(best, stable) : Math.min(best, stable)
          }
        }
        setReading({ midi: pitch.midi, hold: Math.min(holdSeconds, seconds), best })
      },
      onLost() { setReading(emptyReading) },
    })
  }

  function stop() {
    mic.stop()
    setReading(emptyReading)
  }

  function confirm() {
    if (reading.best === null) return
    mic.stop()
    if (stage === 'low') {
      setLow(reading.best)
      setReading(emptyReading)
      setStage('high')
    } else if (low !== null) {
      save({ low, high: reading.best })
      setTesting(false)
      setStage('low')
      setLow(null)
      setReading(emptyReading)
    }
  }

  return (
    <section className="panel vocal-panel" aria-labelledby="range-title">
      <header className="panel-header">
        <span className="tool-icon purple"><Mic size={22} /></span>
        <div><h2 id="range-title">ทดสอบช่วงเสียงร้อง</h2><p>ใช้เสียงที่ร้องได้สบายและไม่ฝืน</p></div>
      </header>
      {range && !testing ? (
        <>
          <RangeResult range={range} />
          <p className="vocal-help">แบบฝึกวอร์มเสียงจะใช้ช่วงนี้ช่วยเลือกคีย์เริ่มต้น กลุ่มเสียงเป็นเพียงการเทียบช่วงโน้ต</p>
          <button className="subtle-button" onClick={() => setTesting(true)}><RotateCcw size={17} />ทดสอบใหม่</button>
        </>
      ) : (
        <>
          <ol className="vocal-steps" aria-label="ขั้นตอนทดสอบ">
            <li aria-current={stage === 'low' ? 'step' : undefined}>เสียงต่ำ{low !== null && <strong>{noteLabel(low)}</strong>}</li>
            <li aria-current={stage === 'high' ? 'step' : undefined}>เสียงสูง</li>
          </ol>
          <p className="vocal-help">ร้องโน้ต{boundary}ที่สุดที่ร้องได้สบายและประคองให้นิ่ง {holdSeconds} วินาที ลองได้หลายครั้งก่อนกดบันทึก</p>
          <div className="vocal-range-reading">
            <div><span>โน้ตที่ได้ยิน</span><strong>{reading.midi === null ? '—' : noteLabel(Math.round(reading.midi))}</strong></div>
            <div><label htmlFor="vocal-hold">เวลาที่ประคองโน้ต</label>
              <progress id="vocal-hold" max={holdSeconds} value={reading.hold} />
              <small>{reading.hold.toFixed(1)} / {holdSeconds} วินาที</small>
            </div>
            <div><span>โน้ต{boundary}ที่วัดได้</span><strong>{reading.best === null ? '—' : noteLabel(reading.best)}</strong></div>
          </div>
          <div className="vocal-actions">
            <button className="subtle-button" onClick={mic.state === 'activation' ? mic.activate : busy ? stop : start}>
              {!busy || mic.state === 'activation' ? <Mic size={17} /> : <Square size={17} />}
              {mic.state === 'activation' ? 'เริ่มฟังเสียง' : mic.state === 'requesting' ? 'ยกเลิกขอใช้ไมโครโฟน' : busy ? 'หยุดฟัง' : 'เปิดไมโครโฟน'}
            </button>
            {mic.state === 'activation' && <button className="subtle-button" onClick={stop}>ยกเลิก</button>}
            <button className="primary-button" disabled={reading.best === null} onClick={confirm}>
              <Check size={17} />บันทึกโน้ต{boundary}
            </button>
          </div>
          {mic.state === 'activation' && <p className="vocal-help">อนุญาตไมโครโฟนแล้ว แตะเริ่มฟังเสียงเพื่อเปิดระบบเสียง</p>}
          {mic.error && <p className="field-error" role="alert">{mic.error}</p>}
        </>
      )}
      <details className="vocal-voice-guide">
        <summary>ช่วงเสียงอ้างอิงทั้ง 6 กลุ่ม</summary>
        <dl>
          {voiceGroups.map(group => (
            <div key={group.name}><dt>{group.name}</dt><dd>{noteLabel(group.low)}–{noteLabel(group.high)}</dd></div>
          ))}
        </dl>
      </details>
    </section>
  )
}
