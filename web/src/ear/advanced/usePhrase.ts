import { useEffect, useRef, useState } from 'react'
import { createEarAudio } from '../audio'
import type { Sound } from '../exercises'

export function usePhrase() {
  const [player] = useState(createEarAudio)
  const [playing, setPlaying] = useState<'phrase' | 'note' | null>(null)
  const [error, setError] = useState('')
  const generation = useRef(0)

  useEffect(() => () => {
    generation.current += 1
    player.dispose()
  }, [player])

  function stop() {
    generation.current += 1
    player.stop()
    setPlaying(null)
    setError('')
  }

  function listen(sound: Sound, onEnd?: () => void, kind: 'phrase' | 'note' = 'phrase') {
    const token = ++generation.current
    setPlaying(kind)
    setError('')
    void player.play(sound, 'piano', () => {
      if (token !== generation.current) return
      setPlaying(null)
      onEnd?.()
    }, kind === 'note' ? 0.018 : 0.055).catch(() => {
      if (token !== generation.current) return
      player.dispose()
      setPlaying(null)
      setError('เล่นเสียงไม่ได้ ลองแตะปุ่มฟังอีกครั้ง')
    })
  }

  return { playing, error, stop, listen }
}
