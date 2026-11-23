import { MasteryStars } from './MasteryControls'
import type { NoteQuizScore } from './useNoteQuiz'

export function QuizFeedback({ feedback }: { feedback: { correct: boolean; answer: string } | null }) {
  return <div className="mastery-feedback" data-correct={feedback?.correct} role="status">
    {feedback && (feedback.correct ? `ถูก · ${feedback.answer}` : `คำตอบคือ ${feedback.answer}`)}
  </div>
}

export function QuizResult({ result, maxStars }: { result: NoteQuizScore | null; maxStars: number }) {
  if (!result) return null
  return <div className="instrument-result mastery-result" role="status">
    <span>ถูก <strong>{result.correct}/{result.attempts}</strong> · ความแม่นยำ {result.accuracy}%</span>
    <MasteryStars stars={result.stars} max={maxStars} />
  </div>
}
