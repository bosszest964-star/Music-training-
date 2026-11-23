import { useEffect, useRef } from 'react'

export default function AudioWaveform({ peaks, duration, position, a, b, marked, seek }: {
  peaks: Float32Array
  duration: number
  position: number
  a: number
  b: number
  marked: boolean
  seek: (time: number) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const paint = useRef<() => void>(() => {})
  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    function draw() {
      if (!canvas || !context) return
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      if (!width || !height) return
      const scale = Math.min(2, window.devicePixelRatio || 1)
      if (canvas.width !== Math.round(width * scale) || canvas.height !== Math.round(height * scale)) {
        canvas.width = Math.round(width * scale)
        canvas.height = Math.round(height * scale)
      }
      context.setTransform(scale, 0, 0, scale, 0, 0)
      const x = (time: number) => width * time / duration
      const mid = height / 2
      context.fillStyle = '#171625'
      context.fillRect(0, 0, width, height)
      if (marked) {
        context.fillStyle = '#3a2e54'
        context.fillRect(x(a), 0, x(b) - x(a), height)
      }
      context.fillStyle = '#4c3c61'
      context.fillRect(0, mid, width, 1)
      const columns = Math.max(1, Math.min(peaks.length, Math.floor(width / 2.2)))
      for (let col = 0; col < columns; col += 1) {
        const first = Math.floor(col * peaks.length / columns)
        const last = Math.ceil((col + 1) * peaks.length / columns)
        let peak = 0
        for (let i = first; i < last; i += 1) peak = Math.max(peak, peaks[i])
        const left = col * width / columns
        const size = Math.max(1, peak * (height - 35))
        context.fillStyle = left <= x(position) ? '#c7a6fd' : '#7d659c'
        context.fillRect(left, mid - size / 2, Math.max(1, width / columns - 1), size)
      }
      if (marked) {
        context.font = '700 12px system-ui'
        context.fillStyle = '#7ae5ca'
        context.fillRect(x(a), 0, 2, height)
        context.fillRect(Math.min(width - 2, x(b)), 0, 2, height)
        context.fillText('A', Math.max(3, Math.min(width - 14, x(a) + 4)), 14)
        context.fillText('B', Math.max(3, Math.min(width - 14, x(b) - 12)), 14)
      }
      context.fillStyle = '#f4e9ff'
      context.fillRect(Math.min(width - 2, x(position)), 0, 2, height)
    }
    paint.current = draw
    draw()
  }, [peaks, duration, position, a, b, marked])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const observer = new ResizeObserver(() => paint.current())
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])

  return <canvas className="instrument-waveform" ref={canvasRef} role="img"
    aria-label="คลื่นเสียงของไฟล์ แตะเลือกตำแหน่งหรือใช้แถบเลื่อนด้านล่าง"
    onPointerDown={event => {
      const bounds = event.currentTarget.getBoundingClientRect()
      seek(Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)) * duration)
    }} />
}
