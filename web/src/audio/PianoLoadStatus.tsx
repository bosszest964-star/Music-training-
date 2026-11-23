import { useEffect, useSyncExternalStore } from 'react'
import { pianoAnchors, pianoRevision, pianoStatus, preloadPianoAnchors, subscribePiano } from './pianoEngine'

export default function PianoLoadStatus({ notes, playingFallback = false, anchorLimit = 12 }: {
  notes: readonly number[]
  playingFallback?: boolean
  anchorLimit?: number
}) {
  const key = pianoAnchors(notes).slice(0, anchorLimit).join(',')
  const anchors = key ? key.split(',').map(Number) : []
  useSyncExternalStore(subscribePiano, pianoRevision, pianoRevision)
  useEffect(() => {
    if (key) preloadPianoAnchors(key.split(',').map(Number))
  }, [key])
  const { ready, failed } = pianoStatus(anchors)
  if (!anchors.length) return null
  const complete = ready === anchors.length
  const settled = ready + failed === anchors.length
  return (
    <div className="piano-load">
      <span role="status">{complete ? playingFallback
        ? 'เสียงแกรนด์เปียโนพร้อม · เล่นลูปใหม่เพื่อใช้เสียงจริง' : 'เสียงแกรนด์เปียโนพร้อม' : settled
        ? `แกรนด์เปียโนพร้อม ${ready}/${anchors.length} · ใช้เสียงสำรองสำหรับส่วนที่โหลดไม่ได้`
        : `กำลังโหลดแกรนด์เปียโน ${ready}/${anchors.length} · เล่นด้วยเสียงสำรองได้`}</span>
      {failed > 0 && settled && <button type="button" className="subtle-button" onClick={() => preloadPianoAnchors(anchors, true)}>
        ลองโหลดใหม่
      </button>}
    </div>
  )
}
