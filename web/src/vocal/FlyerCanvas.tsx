import { useEffect, useRef } from 'react'
import { noteLabel } from '../audio/pitch'
import { gateWindow } from './flyer'
import type { Flight } from './flyer'

function draw(context: CanvasRenderingContext2D, width: number, height: number, flight: Flight) {
  const axis = 48
  const playhead = axis + (width - axis) * 0.21
  const zoom = (width - axis) / 5
  const gap = (height - 37) / flight.notes.length
  const lane = (index: number) => height - 19 - (index + 0.5) * gap
  function y(note: number) {
    const topIndex = flight.notes.findIndex(midi => midi >= note)
    if (topIndex < 0) return lane(flight.notes.length - 1)
    if (!topIndex) return lane(0)
    const low = flight.notes[topIndex - 1]
    return lane(topIndex - 1 + (note - low) / (flight.notes[topIndex] - low))
  }

  context.fillStyle = '#141424'
  context.fillRect(0, 0, width, height)
  context.font = 'bold 13px system-ui'
  context.textBaseline = 'middle'
  const next = flight.gates[flight.next]
  flight.notes.forEach((midi, index) => {
    const row = lane(index)
    context.fillStyle = midi === next?.note ? '#3a2e55' : index % 2 ? '#211c33' : '#1a182b'
    context.fillRect(axis, row - gap / 2, width - axis, gap - 1)
    context.fillStyle = midi === next?.note ? '#f3deff' : '#b8accd'
    context.fillText(noteLabel(midi), 8, row)
  })
  context.save()
  context.beginPath()
  context.rect(axis, 0, width - axis, height)
  context.clip()

  context.fillStyle = '#c8afff26'
  context.fillRect(playhead - gateWindow * zoom, 13, gateWindow * 2 * zoom, height - 26)
  context.fillStyle = '#c8afffa6'
  context.fillRect(playhead - 0.5, 13, 1, height - 26)

  for (const gate of flight.gates) {
    const x = playhead + (gate.time - flight.time) * zoom
    if (x + 14 < axis || x - 14 > width) continue
    const row = y(gate.note)
    context.fillStyle = gate.result === 'hit' ? '#81e8b9' : gate.result === 'miss' ? '#ad9ab8' : '#ffdf90'
    context.beginPath()
    for (let point = 0; point < 10; point += 1) {
      const radius = point % 2 ? 6 : 13
      const angle = point * Math.PI / 5 - Math.PI / 2
      const px = x + Math.cos(angle) * radius
      const py = row + Math.sin(angle) * radius
      if (point === 0) context.moveTo(px, py)
      else context.lineTo(px, py)
    }
    context.closePath()
    context.fill()
  }

  const row = y(flight.position)
  const voiced = flight.pitch !== null
  context.fillStyle = voiced ? '#9e8bf52e' : '#9e8bf516'
  context.beginPath()
  context.arc(playhead, row, 19, 0, Math.PI * 2)
  context.fill()
  context.fillStyle = voiced ? '#c9b9ff' : '#8a7ab3'
  context.beginPath()
  context.moveTo(playhead - 13, row - 10)
  context.quadraticCurveTo(playhead + 2, row - 11, playhead + 14, row)
  context.quadraticCurveTo(playhead + 2, row + 11, playhead - 13, row + 10)
  context.lineTo(playhead - 8, row)
  context.closePath()
  context.fill()
  context.fillStyle = '#27213c'
  context.beginPath()
  context.arc(playhead + 4, row - 1, 2.6, 0, Math.PI * 2)
  context.fill()
  context.restore()
}

export default function FlyerCanvas({ flight, running }: { flight: Flight; running: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    let frame = 0
    function paint() {
      if (!canvas || !context) return
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      if (!width || !height) return
      const ratio = Math.min(2, window.devicePixelRatio || 1)
      const pixelsWide = Math.round(width * ratio)
      const pixelsHigh = Math.round(height * ratio)
      if (canvas.width !== pixelsWide || canvas.height !== pixelsHigh) {
        canvas.width = pixelsWide
        canvas.height = pixelsHigh
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      draw(context, width, height, flight)
    }
    function animate() {
      paint()
      frame = requestAnimationFrame(animate)
    }
    const observer = new ResizeObserver(paint)
    observer.observe(canvas)
    paint()
    if (running) frame = requestAnimationFrame(animate)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [flight, running])

  return (
    <figure className="vocal-graph vocal-flyer-graph">
      <canvas ref={canvasRef} role="img" aria-label="ช่องโน้ตของสเกล ดาวเคลื่อนไปทางซ้าย และยานขยับขึ้นลงตามเสียงร้อง" />
      <figcaption>ร้องค้างที่โน้ตเป้าหมายตอนดาวผ่านแถบแนวตั้ง เก็บติดต่อกันเพื่อเพิ่มคอมโบ</figcaption>
    </figure>
  )
}
