import { useEffect, useRef, useState } from 'react'
import { gradeStars } from '../../exerciseMetadata'

export type NoteQuizScore = {
  correct: number
  attempts: number
  accuracy: number
  stars: number
  duration: number
}

interface Session {
  start: number
  deadline: number
  correct: number
  attempts: number
  locked: boolean
  clock: number
  feedbackTimer: number
}

const emptyTally = { correct: 0, attempts: 0 }
export const challengeSeconds = 60

function dispose(session: Session | null) {
  if (!session) return
  window.clearInterval(session.clock)
  window.clearTimeout(session.feedbackTimer)
}

export function useNoteQuiz<Question>({ next, timed, maxStars, onActiveChange, onFinish }: {
  next: (previous: Question | null) => Question
  timed: boolean
  maxStars: number
  onActiveChange: (active: boolean) => void
  onFinish: (result: NoteQuizScore) => void
}) {
  const current = useRef<Session | null>(null)
  const [active, setActive] = useState(false)
  const [question, setQuestion] = useState<Question | null>(null)
  const [feedback, setFeedback] = useState<{ correct: boolean; answer: string } | null>(null)
  const [remaining, setRemaining] = useState(challengeSeconds)
  const [tally, setTally] = useState(emptyTally)
  const [score, setScore] = useState<NoteQuizScore | null>(null)

  useEffect(() => {
    function hide() {
      if (!document.hidden || !current.current) return
      dispose(current.current)
      current.current = null
      onActiveChange(false)
      setActive(false)
      setFeedback(null)
      setQuestion(null)
      setRemaining(challengeSeconds)
      setTally(emptyTally)
    }
    document.addEventListener('visibilitychange', hide)
    return () => {
      document.removeEventListener('visibilitychange', hide)
      if (current.current) onActiveChange(false)
      dispose(current.current)
      current.current = null
    }
  }, [onActiveChange])

  function finish() {
    const session = current.current
    if (!session) return
    current.current = null
    dispose(session)
    const elapsed = (performance.now() - session.start) / 1000
    const duration = Math.max(0, timed ? Math.min(elapsed, challengeSeconds) : elapsed)
    const { correct, attempts } = session
    const result = {
      duration, correct, attempts, accuracy: attempts ? Math.round(100 * correct / attempts) : 0,
      stars: gradeStars(correct, timed ? Math.max(5, attempts) : attempts, maxStars),
    }
    setActive(false)
    setFeedback(null)
    setQuestion(null)
    setScore(result)
    onActiveChange(false)
    if (attempts || duration >= 1) onFinish(result)
  }

  function reset() {
    setScore(null)
    setRemaining(challengeSeconds)
    setTally(emptyTally)
  }

  function start() {
    if (current.current) return
    const start = performance.now()
    const session: Session = {
      start, deadline: timed ? start + challengeSeconds * 1000 : Infinity,
      correct: 0, attempts: 0, locked: false, clock: 0, feedbackTimer: 0,
    }
    current.current = session
    reset()
    setActive(true)
    setQuestion(next(null))
    onActiveChange(true)
    if (timed) session.clock = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((session.deadline - performance.now()) / 1000))
      setRemaining(left)
      if (!left) finish()
    }, 100)
  }

  function submit(correct: boolean, answer: string) {
    const session = current.current
    if (!session || session.locked) return
    if (performance.now() >= session.deadline) {
      setRemaining(0)
      finish()
      return
    }
    session.locked = true
    session.attempts += 1
    if (correct) session.correct += 1
    setTally({ correct: session.correct, attempts: session.attempts })
    setFeedback({ correct, answer })
    session.feedbackTimer = window.setTimeout(() => {
      if (current.current !== session) return
      if (performance.now() >= session.deadline) {
        setRemaining(0)
        finish()
        return
      }
      setFeedback(null)
      setQuestion(next(question))
      session.locked = false
    }, 520)
  }

  return { active, question, feedback, tally, remaining, score, start, finish, submit, reset }
}
