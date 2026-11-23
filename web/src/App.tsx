import { useState } from 'react'
import type { CSSProperties } from 'react'
import {
  Activity, AudioLines, ChevronDown, ChevronRight, Clock3, Cpu, Ear,
  Gauge, Hand, Headphones, LayoutGrid, Mic, MicOff, Minus, Music2, Pause, Piano,
  Play, Plus, ShieldCheck, Timer,
} from 'lucide-react'
import { meters, useMetronome } from './audio/useMetronome'
import type { Meter } from './audio/useMetronome'
import { getReading, instruments, noteLabel } from './audio/pitch'
import type { Instrument } from './audio/pitch'
import { useTuner } from './audio/useTuner'
import { dayKey, usePractice } from './usePractice'
import EarStats from './ear/EarStats'
import EarTraining from './ear/EarTraining'
import { useEarStats } from './ear/stats'
import VocalStudio, { VocalHistory } from './vocal/VocalStudio'
import { useVocalStats } from './vocal/stats'
import InstrumentStudio, { InstrumentHistory } from './instrument/InstrumentStudio'
import { useInstrumentStats } from './instrument/stats'
import StemStudio from './stems/StemStudio'

const sections = [
  { id: 'tools', icon: LayoutGrid, name: 'เครื่องมือพื้นฐาน' },
  { id: 'ear', icon: Ear, name: 'ฝึกหู' },
  { id: 'voice', icon: Mic, name: 'ฝึกร้องเพลง' },
  { id: 'midi', icon: Piano, name: 'ฝึกเครื่องดนตรีและแกะเพลง' },
  { id: 'gpu', icon: Cpu, name: 'แยกไลน์ดนตรี' },
] as const

type Section = typeof sections[number]['id']
const bars = [8, 10, 14, 11, 20, 16, 28, 43, 32, 48, 66, 44, 74, 104, 77, 56, 86, 123, 96, 69, 48, 63, 39, 26, 34, 20, 15, 22, 12, 9, 12]
const tempoRange = { min: 30, max: 240 }
const weekday = new Intl.DateTimeFormat('th-TH', { weekday: 'short' })
const fullDate = new Intl.DateTimeFormat('th-TH', { dateStyle: 'full' })

function clock(milliseconds: number) {
  const seconds = Math.floor(milliseconds / 1000)
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map(value => String(value).padStart(2, '0')).join(':')
}

function Metronome({ metronome }: { metronome: ReturnType<typeof useMetronome> }) {
  const { bpm, meter, running, starting, beat, error } = metronome
  const tempoProgress = (bpm - tempoRange.min) / (tempoRange.max - tempoRange.min)
  return (
    <section className="panel tool-panel" aria-labelledby="metronome-title">
      <header className="panel-header">
        <span className="tool-icon purple"><Timer size={23} /></span>
        <div className="min-w-0">
          <h2 id="metronome-title">เมโทรนอม</h2>
          <p>รักษาจังหวะให้สม่ำเสมอ</p>
        </div>
        <span className={`status ml-auto ${running ? 'status-live' : ''}`}><i />{running ? 'กำลังเล่น' : 'พร้อมใช้งาน'}</span>
      </header>

      <div className="instrument-display metro-display">
        <div className="beat-lights" aria-hidden="true">
          {Array.from({ length: meters[meter] }, (_, index) => (
            <span
              key={index}
              className={`beat-light ${index === 0 ? 'downbeat' : ''} ${meter === '6/8' && index === 3 ? 'secondary-beat' : ''} ${running && beat === index ? 'beat-on' : ''}`}
            />
          ))}
        </div>
        <div className="tempo-readout">
          <button className="square-button" aria-label="ลด BPM" disabled={bpm === tempoRange.min} onClick={() => metronome.changeBpm(bpm - 1)}><Minus size={19} /></button>
          <div className="tempo-number"><output htmlFor="tempo">{bpm}</output><span>BPM</span></div>
          <button className="square-button" aria-label="เพิ่ม BPM" disabled={bpm === tempoRange.max} onClick={() => metronome.changeBpm(bpm + 1)}><Plus size={19} /></button>
        </div>
        <div className="tempo-slider">
          <input id="tempo" type="range" min={tempoRange.min} max={tempoRange.max} value={bpm}
            aria-label="ความเร็วเมโทรนอม BPM"
            style={{ '--progress': `${tempoProgress * 100}%` } as CSSProperties}
            onChange={event => metronome.changeBpm(event.currentTarget.valueAsNumber)} />
          <div className="range-labels"><span>30</span><span>240</span></div>
        </div>
      </div>

      <div className="control-row">
        <span className="control-label" id="meter-label">อัตราจังหวะ</span>
        <div className="segmented meter-options" role="group" aria-labelledby="meter-label">
          {(Object.keys(meters) as Meter[]).map(value => (
            <button key={value} aria-pressed={meter === value} onClick={() => metronome.changeMeter(value)}>{value}</button>
          ))}
        </div>
      </div>
      {meter === '6/8' && <p className="field-hint">BPM นับตัวดำประจุด โดยแบ่งเป็น 3 เสียงเคาะต่อจังหวะ</p>}
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="tool-actions">
        <button className="primary-button" disabled={starting} onClick={running ? metronome.stop : () => void metronome.start()}>
          {running ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
          {running ? 'หยุดเมโทรนอม' : 'เริ่มเมโทรนอม'}
        </button>
        <button className="subtle-button" onClick={metronome.tap}><Hand size={17} />Tap Tempo</button>
      </div>
    </section>
  )
}

const gaugeTicks = Array.from({ length: 21 }, (_, index) => index - 10)

function Tuner({ tuner }: { tuner: ReturnType<typeof useTuner> }) {
  const [instrument, setInstrument] = useState<Instrument>('chromatic')
  const [selectedString, setSelectedString] = useState<number | null>(null)
  const { state, frequency, error } = tuner
  const listening = state === 'listening'
  const strings: readonly number[] = instruments[instrument].strings
  const reading = frequency === null ? null : getReading(frequency, instrument, selectedString)
  const inTune = reading && Math.abs(reading.cents) <= 5
  const gaugePosition = reading ? Math.max(-50, Math.min(50, reading.cents)) + 50 : 50
  const hint = reading
    ? inTune ? 'ตรงคีย์' : reading.cents < 0 ? 'เสียงต่ำไป' : 'เสียงสูงไป'
    : listening ? 'เล่นโน้ตทีละตัวเพื่อวัดเสียง' : 'รอสัญญาณเสียง'
  return (
    <section className="panel tool-panel" aria-labelledby="tuner-title">
      <header className="panel-header">
        <span className="tool-icon cyan"><Activity size={23} /></span>
        <div className="min-w-0">
          <h2 id="tuner-title">จูนเนอร์</h2>
          <p>ตั้งสายและตรวจระดับเสียง</p>
        </div>
        <span className={`status ml-auto ${listening ? 'status-live' : ''}`}><i />{state === 'starting' ? 'รอสิทธิ์' : listening ? 'กำลังฟัง' : 'ปิดไมค์'}</span>
      </header>

      <div className="instrument-display tuner-display">
        <div className="pitch-value">
          <output aria-live="off" aria-label="ตัวโน้ตที่ตรวจพบ">{reading?.note ?? '—'}</output>
          <span>{reading ? reading.hz.toFixed(1) : '—'} <b>Hz</b></span>
        </div>
        <div className={`gauge ${reading ? 'gauge-reading' : ''} ${inTune ? 'in-tune' : ''}`}
          aria-hidden="true" style={{ '--needle': `${gaugePosition}%` } as CSSProperties}>
          <div className="gauge-ticks">
            {gaugeTicks.map(tick => <i key={tick} className={tick === 0 ? 'center-tick' : tick % 5 === 0 ? 'long-tick' : ''} />)}
          </div>
          <div className="gauge-needle" />
          <div className="gauge-labels"><span>−50</span><span>−25</span><span>0</span><span>+25</span><span>+50</span></div>
        </div>
        <p className={inTune ? 'tuner-hint in-tune' : 'tuner-hint'}>
          {reading ? `${reading.target} · ${reading.cents > 0 ? '+' : ''}${reading.cents} cents · ` : ''}{hint}
        </p>
      </div>

      <div className="control-row">
        <label className="control-label" htmlFor="instrument">เครื่องดนตรี</label>
        <div className="select-wrap">
          <select id="instrument" value={instrument} onChange={event => {
            setInstrument(event.currentTarget.value as Instrument)
            setSelectedString(null)
          }}>
            {(Object.keys(instruments) as Instrument[]).map(option =>
              <option key={option} value={option}>{instruments[option].label}</option>,
            )}
          </select>
          <ChevronDown size={15} aria-hidden="true" />
        </div>
      </div>
      {strings.length > 0 && (
        <div className="segmented string-options" role="group" aria-label="สายที่จะตั้ง">
          <button aria-pressed={selectedString === null} onClick={() => setSelectedString(null)}>อัตโนมัติ</button>
          {strings.map(string => (
            <button key={string} aria-pressed={selectedString === string} data-detected={selectedString === null && reading?.targetMidi === string ? '' : undefined}
              onClick={() => setSelectedString(string)}>{noteLabel(string)}</button>
          ))}
        </div>
      )}
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="tool-actions">
        <button className="cyan-button w-full" onClick={state === 'idle' ? () => void tuner.start() : tuner.stop}>
          {state === 'idle' ? <Mic size={18} /> : <MicOff size={18} />}
          {state === 'starting' ? 'ยกเลิกเปิดไมโครโฟน' : listening ? 'ปิดไมโครโฟน' : 'เปิดไมโครโฟน'}
        </button>
      </div>
    </section>
  )
}

function Practice({ practice }: { practice: ReturnType<typeof usePractice> }) {
  const { elapsed, today, totals, running, storageError, toggle } = practice
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (6 - index))
    const total = totals[dayKey(date)] ?? 0
    return { date, total }
  })
  const dailyTotal = days[6].total
  const maxTotal = Math.max(60_000, ...days.map(day => day.total))
  return (
    <section className="panel practice-panel" aria-labelledby="practice-title">
      <header className="panel-header">
        <span className="tool-icon purple"><Clock3 size={22} /></span>
        <div className="min-w-0">
          <h2 id="practice-title">เวลาซ้อม</h2>
          <p>นับเวลาอัตโนมัติเมื่อใช้เมโทรนอม จูนเนอร์ หรือฝึกร้อง ฝึกเล่น แกะเพลง และฟังมิกเซอร์</p>
        </div>
        <span className="local-tag ml-auto"><ShieldCheck size={15} />บันทึกในอุปกรณ์</span>
      </header>
      <div className="practice-grid">
        <div className="practice-count">
          <div className="practice-session">
            <span>เซสชันนี้</span>
            <output aria-live="off" className={running ? 'counting' : ''}>{clock(elapsed)}</output>
          </div>
          <button className="subtle-button" onClick={toggle}>
            {running ? <Pause size={16} /> : <Play size={16} />}{running ? 'พักเวลา' : 'เริ่มจับเวลา'}
          </button>
        </div>
        <div className="practice-history">
          <div className="history-title">
            <div>
              <h3>สถิติ 7 วันล่าสุด</h3>
              <p>วันนี้ <strong>{clock(dailyTotal)}</strong></p>
            </div>
            <span className="history-date">{fullDate.format(today)}</span>
          </div>
          <div className="history-chart" aria-label="เวลาซ้อมรายวัน" role="list">
            {days.map(({ date, total }, index) => (
              <div key={dayKey(date)} className={index === 6 ? 'history-day today' : 'history-day'} role="listitem"
                aria-label={`${fullDate.format(date)} เวลาซ้อม ${clock(total)}`}>
                <time className="history-value" dateTime={`PT${Math.floor(total / 1000)}S`}>{clock(total).replace(/^00:/, '')}</time>
                <div className="history-track"><i style={{ '--height': `${100 * total / maxTotal}%` } as CSSProperties} /></div>
                <span>{index === 6 ? 'วันนี้' : weekday.format(date)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {storageError && <p className="field-error" role="alert">เบราว์เซอร์บันทึกสถิติไม่ได้ เวลายังแสดงอยู่ในหน้านี้</p>}
    </section>
  )
}

export default function App() {
  const [activeId, setActiveId] = useState<Section>('tools')
  const metronome = useMetronome()
  const tuner = useTuner()
  const [vocalActive, setVocalActive] = useState(false)
  const [instrumentActive, setInstrumentActive] = useState(false)
  const [stemsActive, setStemsActive] = useState(false)
  const practice = usePractice(metronome.running || tuner.state === 'listening' || vocalActive || instrumentActive || stemsActive)
  const earStats = useEarStats()
  const vocalStats = useVocalStats()
  const instrumentStats = useInstrumentStats()
  const active = sections.find(section => section.id === activeId) ?? sections[0]

  function navigate(id: Section) {
    if (id === activeId) return
    if (id !== 'tools' && activeId === 'tools') {
      metronome.stop()
      tuner.stop()
    }
    if (activeId === 'voice') setVocalActive(false)
    if (activeId === 'midi') setInstrumentActive(false)
    if (activeId === 'gpu') setStemsActive(false)
    setActiveId(id)
    window.scrollTo(0, 0)
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => navigate('tools')}>
          <span className="brand-mark"><AudioLines size={24} strokeWidth={2.5} /></span>
          <span><strong>ห้องซ้อม</strong><small>Music Practice Suite</small></span>
        </button>
        <nav className="navigation" aria-label="เมนูเครื่องมือฝึกดนตรี">
          <p>พื้นที่ฝึกซ้อม</p>
          {sections.map(({ id, icon: Icon, name }) => (
            <button key={id} className="nav-item" aria-current={id === activeId ? 'page' : undefined}
              title={name} onClick={() => navigate(id)}>
              <Icon size={19} />
              <span>{name}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="footer-icon"><Headphones size={19} /></span>
          <div><strong>ซ้อมแบบส่วนตัว</strong><small>ประมวลผลเสียงในเครื่อง</small></div>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div className="breadcrumb"><Music2 size={16} /><span>ห้องซ้อม</span><ChevronRight size={14} /><strong>{active.name}</strong></div>
          <span className="free-tag"><i />ใช้งานฟรี</span>
        </div>

        <div hidden={activeId !== 'tools'}>
          <section className="hero">
            <div className="hero-copy">
              <h1>เครื่องมือพื้นฐาน</h1>
              <span>จับจังหวะ ตั้งสาย และบันทึกเวลาซ้อมในที่เดียว</span>
            </div>
            <div className="hero-art" aria-hidden="true">
              <div className="waveform">
                {bars.map((height, index) => (
                  <i key={index} style={{ '--bar-height': `${height}px`, '--bar-opacity': 0.38 + height / 195 } as CSSProperties} />
                ))}
              </div>
            </div>
          </section>
          <div className="section-label"><Gauge size={19} /><h2>เครื่องมือฝึกซ้อม</h2></div>
          <div className="tool-grid">
            <Metronome metronome={metronome} />
            <Tuner tuner={tuner} />
          </div>
          <Practice practice={practice} />
          <EarStats stats={earStats} open={() => navigate('ear')} />
          <VocalHistory stats={vocalStats} open={() => navigate('voice')} />
          <InstrumentHistory stats={instrumentStats} open={() => navigate('midi')} />
        </div>
        {activeId === 'ear' && <EarTraining stats={earStats} />}
        {activeId === 'voice' && <VocalStudio stats={vocalStats} onActiveChange={setVocalActive} />}
        {activeId === 'midi' && <InstrumentStudio stats={instrumentStats} onActiveChange={setInstrumentActive} />}
        {activeId === 'gpu' && <StemStudio onActiveChange={setStemsActive} />}
      </main>
    </div>
  )
}
