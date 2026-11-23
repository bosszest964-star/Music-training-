import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { noteLabel } from '../audio/pitch'
import { targetAt, tolerance } from './music'
import type { PitchPoint, VocalPlan } from './music'

export interface PitchTrace {
  plan: VocalPlan
  elapsed: number
  points: PitchPoint[]
}

function drawPitch(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  plan: VocalPlan,
  trace: PitchTrace | null,
) {
  const axis = 43
  const top = 20
  const bottom = height - 30
  const high = plan.root + Math.max(5, plan.span + 2)
  const low = plan.root - (plan.span === 0 ? 5 : 2)
  const playhead = axis + (width - axis) * 0.31
  const elapsed = trace?.elapsed ?? 0
  const pixelsPerSecond = (width - axis) / Math.min(9, Math.max(4.5, 10 * plan.beat))
  const x = (time: number) => playhead + (time - elapsed) * pixelsPerSecond
  const y = (midi: number) => Math.min(bottom, Math.max(top, top + (high - midi) * (bottom - top) / (high - low)))

  context.clearRect(0, 0, width, height)
  context.fillStyle = '#171625'
  context.fillRect(0, 0, width, height)
  context.font = '12px system-ui'
  context.textBaseline = 'middle'
  for (let midi = low; midi <= high; midi += 1) {
    const pitchY = y(midi)
    const label = Math.abs(midi - plan.root) % 2 === 0
    context.fillStyle = label ? '#302943' : '#251f35'
    context.fillRect(axis, pitchY, width - axis, 1)
    if (label) {
      context.fillStyle = midi === plan.root ? '#d7c0ff' : '#a99ebd'
      context.fillText(noteLabel(midi), 8, pitchY)
    }
  }

  context.save()
  context.beginPath()
  context.rect(axis, 0, width - axis, height)
  context.clip()
  const firstBeat = Math.max(0, Math.floor((elapsed - (playhead - axis) / pixelsPerSecond) / plan.beat))
  for (let beat = firstBeat; beat * plan.beat <= plan.duration + plan.beat; beat += 1) {
    const time = beat * plan.beat
    const marker = x(time)
    if (marker > width) break
    context.fillStyle = '#373048'
    context.fillRect(marker, top, 1, bottom - top)
    context.fillStyle = '#a99ebd'
    if (time < plan.duration - 0.001) {
      const label = plan.backing.length ? `${Math.floor(beat / plan.beatsPerBar) + 1}.${beat % plan.beatsPerBar + 1}` : String(beat + 1)
      context.fillText(label, marker + 4, height - 13)
    }
  }

  context.lineCap = 'round'
  for (const segment of plan.targets) {
    const left = Math.max(axis + 1, x(segment.start))
    const right = Math.min(width + 8, x(segment.end))
    if (left >= right) continue
    const from = segment.from
    const position = (screenX: number) => from + (segment.to - from) * (screenX - x(segment.start)) / (x(segment.end) - x(segment.start))
    context.beginPath()
    context.moveTo(left + (right - left > 7 ? 2 : 0), y(position(left)))
    context.lineTo(right - (right - left > 7 ? 2 : 0), y(position(right)))
    context.lineWidth = 10
    context.strokeStyle = '#594280'
    context.stroke()
    context.lineWidth = 3
    context.strokeStyle = '#b597fa'
    context.stroke()
  }

  context.fillStyle = '#ded0fc'
  context.fillRect(playhead, top - 7, 1, bottom - top + 14)
  let previous: PitchPoint | null = null
  for (const point of trace?.points ?? []) {
    if (point.midi === null || x(point.time) < axis - 10) {
      previous = null
      continue
    }
    const target = targetAt(plan, point.time)
    const difference = target ? point.midi - target.midi : 0
    context.strokeStyle = Math.abs(difference) <= tolerance ? '#71e6ad' : difference > 0 ? '#ffbd86' : '#83c8ff'
    context.fillStyle = context.strokeStyle
    context.lineWidth = 2.4
    context.beginPath()
    if (previous && previous.midi !== null && point.time - previous.time < 0.14) {
      context.moveTo(x(previous.time), y(previous.midi))
      context.lineTo(x(point.time), y(point.midi))
      context.stroke()
    } else {
      context.arc(x(point.time), y(point.midi), 2, 0, Math.PI * 2)
      context.fill()
    }
    previous = point
  }
  context.restore()
}

export default function PitchGraph({ plan, trace, moving }: {
  plan: VocalPlan
  trace: RefObject<PitchTrace | null>
  moving: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    let width = 0
    let height = 0
    let frame: number
    function draw() {
      if (!context || width < 1 || height < 1) return
      drawPitch(context, width, height, plan, trace.current?.plan === plan ? trace.current : null)
    }
    function resize() {
      if (!canvas || !context) return
      width = canvas.clientWidth
      height = canvas.clientHeight
      const scale = Math.min(3, window.devicePixelRatio || 1)
      canvas.width = Math.round(width * scale)
      canvas.height = Math.round(height * scale)
      context.setTransform(scale, 0, 0, scale, 0, 0)
      draw()
    }
    function animate() {
      draw()
      frame = requestAnimationFrame(animate)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    if (moving) frame = requestAnimationFrame(animate)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [plan, trace, moving])

  return (
    <figure className="vocal-graph">
      <canvas ref={canvasRef} role="img" aria-label="กราฟเลื่อนตามเวลา แสดงระดับเสียงจริงเทียบกับแถบโน้ตเป้าหมาย" />
      <figcaption>
        <span><i className="vocal-key-target" />โน้ตเป้าหมาย</span>
        <span><i className="vocal-key-match" />ตรงคีย์</span>
        <span><i className="vocal-key-high" />สูงไป</span>
        <span><i className="vocal-key-low" />ต่ำไป</span>
      </figcaption>
    </figure>
  )
}
