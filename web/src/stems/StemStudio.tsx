import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { AudioLines, BookOpen, Cpu, Drum, FolderOpen, Guitar, Mic, Pause, Play, Repeat2, RotateCcw, SlidersHorizontal, Waves, X } from 'lucide-react'
import EngineConnection from './EngineConnection'
import { separateSong, stageLabel } from './engine'
import type { Connection, EngineHealth } from './engine'
import { availableTracks, sources, stemLabels, stems, trackLevels } from './mixer'
import type { Buffers, Project, SourceMode, Stem } from './mixer'
import { useMixerTransport } from './useMixerTransport'

const accept = 'audio/*,.m4a,.mp3,.wav,.flac,.ogg,.aac'
const modes = [
  { id: 'browser', icon: Waves, label: 'แยกย่านทันที' },
  { id: 'gpu', icon: Cpu, label: 'แยกด้วย AI บนคอม' },
  { id: 'files', icon: FolderOpen, label: 'นำเข้าแทร็กแยก' },
] as const
const icons = { vocals: Mic, drums: Drum, bass: Guitar, other: AudioLines }
const bands = { vocals: 'เสียงกลางสเตอริโอ', drums: 'ย่านแหลมและเสียงกระแทก', bass: 'ย่านทุ้ม', other: 'เสียงด้านข้างสเตอริโอ' }
const maxFileSize = 150 * 1024 * 1024

function timestamp(time: number) {
  const tenths = Math.round(time * 10)
  return `${Math.floor(tenths / 600)}:${(tenths % 600 / 10).toFixed(1).padStart(4, '0')}`
}

function SetupGuide() {
  const dialog = useRef<HTMLDialogElement>(null)
  return (
    <>
      <button className="subtle-button" onClick={() => dialog.current?.showModal()}><BookOpen size={17} />คู่มือเชื่อมต่อ iPad</button>
      <dialog ref={dialog} className="stem-dialog" aria-labelledby="stem-guide">
        <div className="stem-dialog-title">
          <h2 id="stem-guide">เปิด Local GPU Engine บนคอม</h2>
          <button className="square-button" aria-label="ปิดคู่มือ" onClick={() => dialog.current?.close()}><X size={18} /></button>
        </div>
        <ol>
          <li>ดาวน์โหลด ZIP ทั้งโปรเจกต์แล้วแตกไฟล์ ติดตั้ง Python 3.10–3.12 กับ FFmpeg หากจะเปิดเว็บผ่านเลข IP ต้องมี Node.js และ npm สำหรับ build หรือมี <code>web-dist</code> อยู่แล้ว</li>
          <li>เข้าโฟลเดอร์ <code>local-gpu-engine</code> แล้วเปิด <code>start_windows.bat</code> บน Windows หรือรัน <code>./start_mac_linux.sh</code> ใน Terminal บน macOS/Linux</li>
          <li>ให้ iPad และคอมอยู่ Wi‑Fi เดียวกัน ใช้ URL ตรงบรรทัด <strong>Wi-Fi / iPad URL</strong> เปิดใน Safari แล้วใส่ URL นั้นกับ <strong>Connection code</strong> ในแท็บแยกด้วย AI</li>
          <li>กดตรวจการเชื่อมต่อแล้วเลือกเพลง ครั้งแรก Demucs จะดาวน์โหลดโมเดล เมื่อแยกเสร็จ ระบบจะเปิดทั้ง 4 แทร็กในมิกเซอร์</li>
        </ol>
        <p>สำหรับเว็บบน Vercel ให้ใช้ Engine ที่เปิดผ่าน HTTPS พร้อมใบรับรองที่ iPad เชื่อถือ และตั้ง <code>STEM_ALLOWED_ORIGINS</code> เป็น origin ของเว็บ ดูขั้นตอนในคู่มือของ Engine</p>
        <div className="stem-dialog-links">
          <a className="primary-button" href="https://github.com/bosszest964-star/Music-training-/archive/refs/heads/main.zip">ดาวน์โหลด ZIP</a>
          <a className="subtle-button" href="https://github.com/bosszest964-star/Music-training-/tree/main/local-gpu-engine">คู่มือ Engine</a>
        </div>
      </dialog>
    </>
  )
}

export default function StemStudio({ onActiveChange }: { onActiveChange: (active: boolean) => void }) {
  const [mode, setMode] = useState<SourceMode>('browser')
  const [files, setFiles] = useState<Partial<Record<Stem, File>>>({})
  const [work, setWork] = useState<{ message: string; progress?: number } | null>(null)
  const [error, setError] = useState('')
  const job = useRef<AbortController | null>(null)
  const transport = useMixerTransport(onActiveChange)
  const { mixer, project, load, mix, changeTrack, loop, mark, toggleLoop, rate, changeRate, position, seek, playing,
    starting, pause, play, problem } = transport

  useEffect(() => () => {
    job.current?.abort()
    job.current = null
  }, [])

  async function prepare(message: string, build: (signal: AbortSignal) => Promise<Project>) {
    if (job.current) return
    const controller = new AbortController()
    job.current = controller
    setWork({ message })
    setError('')
    try {
      const result = await build(controller.signal)
      controller.signal.throwIfAborted()
      load(result)
    } catch (cause) {
      if (job.current === controller && !controller.signal.aborted) {
        setError(cause instanceof DOMException ? 'เปิดไฟล์เสียงไม่ได้ ตรวจสอบรูปแบบเสียงที่เบราว์เซอร์รองรับ'
          : cause instanceof Error ? cause.message : 'เตรียมเสียงไม่สำเร็จ')
      }
    } finally {
      if (job.current === controller) {
        job.current = null
        setWork(null)
      }
    }
  }

  async function decode(file: File, signal: AbortSignal) {
    if (file.size > maxFileSize) throw new Error('รองรับไฟล์เสียงไม่เกิน 150 MB ต่อไฟล์')
    signal.throwIfAborted()
    const bytes = await file.arrayBuffer()
    signal.throwIfAborted()
    return mixer.decode(bytes)
  }

  function fromAi(file: File, connection: Connection, health: EngineHealth) {
    void prepare('กำลังส่งไฟล์ไปยังเครื่องคอมของคุณ', async signal => {
      if (file.size > health.max_bytes) throw new Error('ไฟล์ใหญ่เกินขนาดที่ Local GPU Engine รองรับ')
      const buffers: Buffers = {}
      await separateSong(connection, file, signal,
        status => setWork({ message: `${stageLabel(status.stage)} · ${status.device.toUpperCase()}`, progress: status.progress }),
        async (stem, bytes, index) => {
          signal.throwIfAborted()
          setWork({ message: `กำลังโหลดแทร็ก ${index + 1}/4 · ${stemLabels[stem]}`, progress: 96 + index })
          buffers[stem] = await mixer.decode(bytes)
        })
      signal.throwIfAborted()
      return mixer.fromStems('gpu', file.name, buffers)
    })
  }

  function importFiles() {
    void prepare('กำลังอ่านแทร็กจากเครื่อง', async signal => {
      const buffers: Buffers = {}
      const selected = stems.filter(stem => !!files[stem])
      for (const [index, stem] of selected.entries()) {
        setWork({ message: `กำลังอ่าน ${stemLabels[stem]} · ${index + 1}/${selected.length}`, progress: 100 * index / selected.length })
        buffers[stem] = await decode(files[stem]!, signal)
      }
      signal.throwIfAborted()
      return mixer.fromStems('files', files[selected[0]]?.name ?? 'แทร็กจากเครื่อง', buffers)
    })
  }

  const available = availableTracks(project)
  const levels = trackLevels(mix, available)
  const duration = project?.duration ?? 0

  return (
    <>
      <section className="hero stem-hero">
        <div className="hero-copy">
          <h1>สตูดิโอแยกไลน์ดนตรี</h1>
          <span>มิกเซอร์ 4 แทร็กสำหรับแยกฟังและซ้อมทีละไลน์</span>
        </div>
        <div className="stem-hero-art" aria-hidden="true"><i /><i /><i /><i /></div>
      </section>
      <section className="panel stem-panel" aria-labelledby="stem-source">
        <header className="panel-header stem-panel-header">
          <span className="tool-icon purple"><SlidersHorizontal size={21} /></span>
          <div><h2 id="stem-source">เลือกแหล่งเสียง</h2></div>
          <SetupGuide />
        </header>
        <div className="stem-modes" role="group" aria-label="วิธีเตรียมแทร็ก">
          {modes.map(({ id, icon: Icon, label }) => <button key={id} className="subtle-button" disabled={!!work} aria-pressed={id === mode}
            onClick={() => { setMode(id); setError('') }}><Icon size={18} />{label}</button>)}
        </div>
        <div hidden={mode !== 'gpu'}>
          <EngineConnection busy={!!work} separate={fromAi} />
        </div>
        {mode === 'browser' && <div className="stem-source-fields">
          <p className="stem-hint">แยกโดยประมาณด้วย Mid/Side และตัวกรองหลายย่าน เสียงร้องกับเครื่องดนตรีที่อยู่ในย่านเดียวกันอาจได้ยินร่วมกัน</p>
          <label className="primary-button stem-file"><FolderOpen size={17} />เปิดไฟล์เพลง
            <input type="file" accept={accept} aria-label="เปิดไฟล์เพลงเพื่อแยกย่าน" disabled={!!work} onChange={event => {
              const file = event.currentTarget.files?.[0]
              event.currentTarget.value = ''
              if (file) void prepare('กำลังอ่านไฟล์เสียงในเบราว์เซอร์', async signal => mixer.fromSong(file.name, await decode(file, signal)))
            }} />
          </label>
        </div>}
        {mode === 'files' && <div className="stem-source-fields">
          <p className="stem-hint">เลือกไฟล์ที่เริ่มจากจุดเดียวกัน เลือกได้บางแทร็กหรือครบทั้งสี่แทร็ก</p>
          <div className="stem-import">
            {stems.map(stem => <label key={stem} className="stem-field">{stemLabels[stem]}
              <input type="file" accept={accept} disabled={!!work} onChange={event => {
                const file = event.currentTarget.files?.[0]
                setFiles(previous => ({ ...previous, [stem]: file }))
              }} />
            </label>)}
          </div>
          <button className="primary-button" disabled={!!work || !stems.some(stem => files[stem])} onClick={importFiles}>เปิดแทร็กในมิกเซอร์</button>
        </div>}
        {work && <div className="stem-progress">
          <div role="status">
            <span>{work.message}</span>
            {work.progress === undefined ? <progress aria-label="ความคืบหน้า" /> :
              <progress aria-label="ความคืบหน้า" max={100} value={work.progress} />}
          </div>
          <button className="subtle-button" onClick={() => {
            job.current?.abort()
            job.current = null
            setWork(null)
          }}>ยกเลิก</button>
        </div>}
        {error && <p className="field-error" role="alert">{error}</p>}
      </section>

      <section className="panel stem-panel stem-mixer" aria-labelledby="stem-desk">
        <header className="panel-header">
          <span className="tool-icon cyan"><AudioLines size={22} /></span>
          <div className="stem-project"><h2 id="stem-desk">มิกเซอร์ 4 แทร็ก</h2>
            <p>{project ? `${project.name} · ${sources[project.mode]}` : 'เลือกแหล่งเสียงด้านบนเพื่อเริ่มเล่น'}</p>
          </div>
        </header>
        <div className="stem-console">
          <div className="stem-time">
            <span>{timestamp(position)} / {timestamp(duration)}</span>
            <input type="range" min={0} max={duration || 1} step="0.01" value={position}
              aria-label="ตำแหน่งเพลงในมิกเซอร์" disabled={!project} onChange={event => seek(event.currentTarget.valueAsNumber)} />
          </div>
          <div className="stem-transport">
            <button className="primary-button" disabled={!project} onClick={playing || starting ? pause : () => void play()}>
              {playing || starting ? <Pause size={17} /> : <Play size={17} />}{starting ? 'ยกเลิกเริ่มเล่น' : playing ? 'พัก' : 'เล่น'}
            </button>
            <button className="subtle-button" disabled={!project} onClick={() => seek(loop.enabled ? loop.a : 0)}><RotateCcw size={16} />กลับต้น</button>
            <label className="stem-field stem-rate">ความเร็ว <strong>{rate.toFixed(2)}×</strong>
              <input type="range" min="0.5" max="1.5" step="0.05" value={rate} aria-label="ความเร็วในมิกเซอร์" disabled={!project}
                onChange={event => changeRate(event.currentTarget.valueAsNumber)} />
            </label>
          </div>
          <div className="stem-loop" role="group" aria-label="วนซ้ำ A ถึง B">
            <button className="subtle-button" disabled={!project} onClick={() => mark('a')}>ตั้ง A · {timestamp(loop.a)}</button>
            <button className="subtle-button" disabled={!project} onClick={() => mark('b')}>ตั้ง B · {timestamp(loop.b)}</button>
            <button className="subtle-button" aria-pressed={loop.enabled} disabled={!project || loop.b - loop.a < 0.2} onClick={toggleLoop}>
              <Repeat2 size={16} />{loop.enabled ? 'กำลังวน A–B' : 'วน A–B'}</button>
          </div>
          {problem && <p className="field-error" role="alert">{problem}</p>}
        </div>

        <div className="stem-strips">
          {stems.map(stem => {
            const Icon = icons[stem]
            const track = mix[stem]
            const enabled = available.includes(stem)
            const wave = project?.mode !== 'browser' ? project?.waves[stem] : undefined
            return <section key={stem} className={`stem-strip stem-${stem}`} data-audible={enabled && levels[stem] > 0}>
              <header><span><Icon size={19} /></span><h3>{stemLabels[stem]}</h3></header>
              {wave ? <div className="stem-wave" aria-hidden="true">{Array.from(wave, (peak, index) =>
                <i key={index} style={{ '--peak': `${Math.max(4, peak * 100)}%` } as CSSProperties} />)}</div>
                : <p className="stem-band">{project?.mode === 'browser' ? bands[stem] : 'ไม่มีไฟล์ในแทร็ก'}</p>}
              <label className="stem-field">ระดับเสียง <strong>{Math.round(track.volume * 100)}%</strong>
                <input type="range" min={0} max={1} step={0.01} value={track.volume}
                  aria-label={`ระดับเสียง${stemLabels[stem]}`} disabled={!enabled}
                  onChange={event => changeTrack(stem, { volume: event.currentTarget.valueAsNumber })} />
              </label>
              <div className="stem-track-buttons">
                <button className="subtle-button" disabled={!enabled} aria-pressed={track.mute} aria-label={`Mute ${stemLabels[stem]}`}
                  onClick={() => changeTrack(stem, { mute: !track.mute })}>Mute</button>
                <button className="subtle-button" disabled={!enabled} aria-pressed={track.solo} aria-label={`Solo ${stemLabels[stem]}`}
                  onClick={() => changeTrack(stem, { solo: !track.solo })}>Solo</button>
              </div>
            </section>
          })}
        </div>
        {project?.mode === 'browser' && project.buffer.numberOfChannels === 1 && <p className="stem-hint">ไฟล์โมโนไม่มีข้อมูลเสียงด้านข้างสเตอริโอ แทร็กดนตรีอื่น ๆ จึงเงียบ</p>}
      </section>
    </>
  )
}
