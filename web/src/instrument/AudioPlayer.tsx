import { resumeAudio } from '../audio/resumeAudio'
import { useEffect, useRef, useState } from 'react'
import { AudioLines, FolderOpen, Pause, Play, Repeat2 } from 'lucide-react'
import { createDeckGraph, decodeWaveform, loopSeek, minLoopLength, preservePitch, presets } from './audioDeck'
import type { Preset } from './audioDeck'
import AudioWaveform from './AudioWaveform'

const emptyLoop = { a: 0, b: 0, enabled: false }

function timeLabel(value: number) {
  const tenths = Math.round(value * 10)
  return `${Math.floor(tenths / 600)}:${(tenths % 600 / 10).toFixed(1).padStart(4, '0')}`
}

export default function AudioPlayer({ onActiveChange }: { onActiveChange: (active: boolean) => void }) {
  const [fileName, setFileName] = useState('')
  const [wave, setWave] = useState<Float32Array | null>(null)
  const [channels, setChannels] = useState<number | null>(null)
  const [waveState, setWaveState] = useState<'idle' | 'loading' | 'unavailable'>('idle')
  const [duration, setDuration] = useState(0)
  const [position, setPosition] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [preset, setPreset] = useState<Preset>('flat')
  const [playing, setPlaying] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')
  const [eqError, setEqError] = useState('')
  const [loop, setLoop] = useState(emptyLoop)
  const audio = useRef<HTMLAudioElement>(null)
  const graph = useRef<ReturnType<typeof createDeckGraph> | null>(null)
  const objectUrl = useRef('')
  const generation = useRef(0)
  const loopRef = useRef(loop)
  const currentPreset = useRef<Preset>('flat')
  const hasMarks = loop.a > 0 || loop.b < duration || loop.enabled

  useEffect(() => {
    const media = audio.current
    return () => {
      generation.current += 1
      media?.pause()
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
      objectUrl.current = ''
      void graph.current?.context.close().catch(() => {})
      graph.current = null
      onActiveChange(false)
    }
  }, [onActiveChange])

  useEffect(() => {
    const media = audio.current
    if (!playing || !media) return
    let frame = 0
    let painted = 0

    function tick(now: number) {
      if (!media) return
      const next = loopSeek(media.currentTime, loopRef.current)
      if (next !== media.currentTime) media.currentTime = next
      if (now - painted > 55) {
        setPosition(media.currentTime)
        painted = now
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing])

  function updateLoop(next: typeof emptyLoop) {
    loopRef.current = next
    setLoop(next)
  }

  function load(file: File) {
    const media = audio.current
    if (!media) return
    const token = ++generation.current
    media.pause()
    setPlaying(false)
    onActiveChange(false)
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
    const url = URL.createObjectURL(file)
    objectUrl.current = url
    setFileName(file.name)
    setWave(null)
    setChannels(null)
    setDuration(0)
    setPosition(0)
    setError('')
    setStarting(false)
    updateLoop(emptyLoop)
    setFilter('flat')
    media.src = url
    preservePitch(media)
    media.playbackRate = speed
    media.load()

    if (file.size > 100 * 1024 * 1024) {
      setWaveState('unavailable')
      return
    }
    setWaveState('loading')
    void decodeWaveform(file).then(result => {
      if (token !== generation.current) return
      setWave(result.peaks)
      setChannels(result.channels)
      setWaveState('idle')
      if (result.channels < 2 && currentPreset.current === 'center') setFilter('flat')
    }).catch(() => {
      if (token === generation.current) setWaveState('unavailable')
    })
  }

  async function start() {
    const media = audio.current
    if (!media) return
    const token = generation.current
    setError('')
    setStarting(true)
    try {
      if (!graph.current && !eqError) {
        try {
          graph.current = createDeckGraph(media)
          graph.current.setPreset(currentPreset.current)
        } catch {
          setEqError('เปิดตัวกรองเสียงไม่ได้ ยังเล่นไฟล์และปรับความเร็วได้')
        }
      }
      const next = loopSeek(media.currentTime, loopRef.current)
      if (next !== media.currentTime) media.currentTime = next
      const activation = graph.current && resumeAudio(graph.current.context)
      await Promise.all([media.play(), activation])
    } catch {
      if (token === generation.current) {
        media.pause()
        setError('เล่นไฟล์นี้ไม่ได้ ตรวจสอบรูปแบบเสียงที่เบราว์เซอร์รองรับแล้วลองใหม่')
      }
    } finally {
      if (token === generation.current) setStarting(false)
    }
  }

  function seek(time: number) {
    const media = audio.current
    if (!media || !duration) return
    const current = loopRef.current
    if (current.enabled && (time < current.a || time >= current.b)) updateLoop({ ...current, enabled: false })
    media.currentTime = Math.min(duration, Math.max(0, time))
    setPosition(media.currentTime)
  }

  function mark(which: 'a' | 'b') {
    const time = audio.current?.currentTime ?? 0
    if (which === 'a' ? loop.b - time < minLoopLength : time - loop.a < minLoopLength) {
      setError('กำหนด A ก่อน B โดยเว้นอย่างน้อย 0.2 วินาที')
      return
    }
    setError('')
    updateLoop({ ...loop, [which]: time })
    // Keep the playhead in the updated loop during playback.
    if (loop.enabled && which === 'b' && playing && audio.current) audio.current.currentTime = loop.a
  }

  function setFilter(value: Preset) {
    currentPreset.current = value
    setPreset(value)
    graph.current?.setPreset(value)
  }

  function timeUpdate() {
    const media = audio.current
    if (!media) return
    if (!media.paused) {
      const next = loopSeek(media.currentTime, loopRef.current)
      if (next !== media.currentTime) media.currentTime = next
    }
    setPosition(media.currentTime)
  }

  const ready = duration > 0

  return (
    <section className="panel instrument-panel" aria-labelledby="deck-title">
      <header className="panel-header">
        <span className="tool-icon purple"><AudioLines size={22} /></span>
        <div><h2 id="deck-title">เครื่องเล่นแกะเพลง</h2><p>เลือกท่อน ปรับความเร็ว และฟังแยกย่านเสียงจากไฟล์ในเครื่อง</p></div>
      </header>
      <div className="instrument-toolbar">
        <label className="subtle-button instrument-file">
          <FolderOpen size={17} />เปิดไฟล์เสียง
          <input type="file" accept="audio/*,.mp3,.wav,.m4a,.aac,.flac,.ogg" onChange={event => {
            const file = event.currentTarget.files?.[0]
            event.currentTarget.value = ''
            if (file) load(file)
          }} />
        </label>
        {fileName && <strong className="instrument-filename">{fileName}</strong>}
      </div>
      <audio ref={audio} preload="metadata" onLoadedMetadata={() => {
        const length = audio.current?.duration ?? 0
        if (!Number.isFinite(length) || length <= 0) {
          setError('อ่านความยาวของไฟล์นี้ไม่ได้')
          return
        }
        if (audio.current) {
          audio.current.playbackRate = speed
          preservePitch(audio.current)
        }
        setDuration(length)
        updateLoop({ a: 0, b: length, enabled: false })
      }} onPlaying={() => {
        setPlaying(true)
        onActiveChange(true)
      }} onPause={() => {
        setPlaying(false)
        onActiveChange(false)
      }} onTimeUpdate={timeUpdate} onEnded={() => {
        const media = audio.current
        const current = loopRef.current
        if (media && current.enabled) {
          media.currentTime = current.a
          void start()
        } else {
          setPlaying(false)
          onActiveChange(false)
        }
      }} onError={() => {
        if (!objectUrl.current) return
        setPlaying(false)
        onActiveChange(false)
        setError('เปิดไฟล์เสียงไม่ได้ เบราว์เซอร์อาจไม่รองรับการเข้ารหัสของไฟล์นี้')
      }} />
      {!fileName && <div className="instrument-deck-empty"><AudioLines size={35} /><p>เลือกไฟล์ MP3, WAV, M4A หรือไฟล์เสียงที่เบราว์เซอร์รองรับ</p></div>}
      {fileName && (
        <>
          {ready && wave && <AudioWaveform peaks={wave} duration={duration} position={position}
            a={loop.a} b={loop.b} marked={hasMarks} seek={seek} />}
          {waveState === 'loading' && <p className="instrument-hint" role="status">กำลังอ่านคลื่นเสียง…</p>}
          {waveState === 'unavailable' && <p className="instrument-hint">แสดงคลื่นเสียงของไฟล์นี้ไม่ได้ ใช้แถบตำแหน่งเพื่อเลือกท่อนได้</p>}
          <div className="instrument-position">
            <span>{timeLabel(position)} / {timeLabel(duration)}</span>
            <input type="range" aria-label="ตำแหน่งในเพลง" min={0} max={duration || 1} step={0.01}
              value={position} disabled={!ready} onChange={event => seek(event.currentTarget.valueAsNumber)} />
          </div>
          <div className="instrument-toolbar">
            <button className="primary-button" disabled={!ready || starting} onClick={playing ? () => audio.current?.pause() : () => void start()}>
              {playing ? <Pause size={17} /> : <Play size={17} />}{playing ? 'พักเสียง' : 'เล่นเสียง'}
            </button>
            <label className="instrument-field instrument-speed">ความเร็ว <strong>{speed.toFixed(2)}×</strong>
              <input type="range" min={0.5} max={1.5} step={0.05} value={speed} onChange={event => {
                const value = event.currentTarget.valueAsNumber
                setSpeed(value)
                if (audio.current) {
                  preservePitch(audio.current)
                  audio.current.playbackRate = value
                }
              }} />
            </label>
          </div>
          <div className="instrument-deck-controls">
            <div>
              <h3>วนซ้ำ A–B</h3>
              <div className="instrument-toolbar">
                <button className="subtle-button" disabled={!ready} onClick={() => mark('a')}>ตั้ง A · {timeLabel(loop.a)}</button>
                <button className="subtle-button" disabled={!ready} onClick={() => mark('b')}>ตั้ง B · {timeLabel(loop.b)}</button>
                <button className="subtle-button" disabled={!ready || loop.b - loop.a < minLoopLength}
                  aria-pressed={loop.enabled} onClick={() => {
                    const enabled = !loop.enabled
                    updateLoop({ ...loop, enabled })
                    if (enabled && audio.current) {
                      audio.current.currentTime = loopSeek(audio.current.currentTime, { ...loop, enabled })
                      setPosition(audio.current.currentTime)
                    }
                  }}><Repeat2 size={16} />{loop.enabled ? 'เปิดวนซ้ำอยู่' : 'เปิดวนซ้ำ'}</button>
              </div>
            </div>
            <div>
              <h3>ตัวกรองเสียง</h3>
              <div className="segmented instrument-chord-list" role="group" aria-label="ตัวกรองเสียง">
                {(Object.keys(presets) as Preset[]).map(value =>
                  <button key={value} disabled={!!eqError || (value === 'center' && channels === 1)}
                    aria-pressed={preset === value} onClick={() => setFilter(value)}>{presets[value]}</button>)}
              </div>
              <p className="instrument-hint">{channels === 1 ? 'ลดเสียงตรงกลางใช้ได้กับไฟล์สเตอริโอ' : 'โหมดลดเสียงร้องลดสัญญาณที่อยู่ตรงกลางสเตอริโอ จึงอาจลดเครื่องดนตรีตรงกลางด้วย'}</p>
            </div>
          </div>
        </>
      )}
      {error && <p className="field-error" role="alert">{error}</p>}
      {eqError && <p className="field-error" role="alert">{eqError}</p>}
    </section>
  )
}
