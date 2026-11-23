import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { noteLabel } from '../audio/pitch'
import type { PianoLayout, PianoRound } from './pianoGame'
import type { PianoSong } from './songs'

const lookahead = 3.4
const tail = 1.8

function firstVisible(song: PianoSong, time: number) {
  let low = 0
  let high = song.cues.length
  while (low < high) {
    const middle = (low + high) >>> 1
    if (song.cues[middle].time < time) low = middle + 1
    else high = middle
  }
  return low
}

export default function PianoRoll({ song, layout, game, moving }: {
  song: PianoSong
  layout: PianoLayout
  game: RefObject<PianoRound | null>
  moving: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    const mapping = new Map(layout.keys.map(key => [key.midi, key]))
    let width = 0
    let height = 0
    let frame = 0

    function draw() {
      if (!context || !width || !height) return
      const round = game.current
      const snapshot = round?.snapshot()
      const time = snapshot?.time ?? -1.9
      const unit = width / layout.whites
      const line = height - 16
      const speed = (line + 10) / lookahead
      context.fillStyle = '#171625'
      context.fillRect(0, 0, width, height)
      for (let slot = 0; slot < layout.whites; slot += 1) {
        context.fillStyle = slot % 7 === 0 ? '#473750' : '#2b243a'
        context.fillRect(slot * unit, 0, 1, height)
      }
      for (let tick = Math.floor(time); tick <= time + lookahead; tick += 1) {
        const y = line - (tick - time) * speed
        context.fillStyle = '#272136'
        context.fillRect(0, y, width, 1)
      }
      const first = firstVisible(song, time - 0.22)
      for (let index = first; index < song.cues.length; index += 1) {
        const cue = song.cues[index]
        if (cue.time > time + lookahead + tail) break
        const y = Math.min(line + 8, line - (cue.time - time) * speed)
        for (const note of cue.notes) {
          const key = mapping.get(note.midi)
          if (!key) continue
          const noteHeight = Math.max(19, Math.min(note.duration, tail) * speed)
          const noteWidth = unit * (key.black ? 0.57 : 0.87)
          const left = key.center * unit - noteWidth / 2
          const matched = round?.hits.get(index)?.has(note.midi)
          const waiting = snapshot?.waiting && snapshot.cursor === index
          context.fillStyle = matched ? '#508a72' : waiting ? '#eab777' : note.hand === 'left' ? '#75c9be' : key.black ? '#7c60cb' : '#ae8beb'
          context.fillRect(left, y - noteHeight, noteWidth, noteHeight)
          context.font = '600 12px system-ui'
          context.textAlign = 'center'
          context.fillStyle = waiting || note.hand === 'left' || !key.black ? '#181225' : '#fff'
          if (noteWidth >= 18) context.fillText(noteLabel(note.midi), key.center * unit, y - 5, noteWidth)
        }
      }
      context.fillStyle = snapshot?.waiting ? '#eab777' : '#d5b5ff'
      context.fillRect(0, line, width, 2)
    }

    function resize() {
      if (!canvas || !context) return
      width = canvas.clientWidth
      height = canvas.clientHeight
      const scale = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = Math.max(1, Math.round(width * scale))
      canvas.height = Math.max(1, Math.round(height * scale))
      context.setTransform(scale, 0, 0, scale, 0, 0)
      draw()
    }

    function animate() {
      draw()
      frame = requestAnimationFrame(animate)
    }

    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()
    if (moving) frame = requestAnimationFrame(animate)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [song, layout, game, moving])

  return <canvas ref={canvasRef} className="instrument-roll" role="img"
    aria-label="โน้ตไหลลงสู่คีย์เปียโน เส้นล่างแสดงจังหวะที่ต้องกด" />
}
