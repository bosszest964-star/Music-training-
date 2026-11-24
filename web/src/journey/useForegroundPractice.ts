import { useEffect } from 'react'

export function useForegroundPractice(active: boolean, onActiveChange: (active: boolean) => void) {
  useEffect(() => {
    if (!active) return
    const sync = () => onActiveChange(!document.hidden)
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => {
      document.removeEventListener('visibilitychange', sync)
      onActiveChange(false)
    }
  }, [active, onActiveChange])
}
