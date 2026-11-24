import { useCallback, useMemo, useRef } from 'react'
import MelodicEcho from '../ear/advanced/MelodicEcho'
import ProgressionTrainer from '../ear/advanced/ProgressionTrainer'
import RhythmTapTrainer from '../ear/advanced/RhythmTapTrainer'
import IntonationTrainer from '../ear/advanced/IntonationTrainer'
import { melodies, melodyForExercise } from '../ear/advanced/melodies'
import { progressions, progressionForExercise, progressionQuestion } from '../ear/advanced/progressions'
import { rhythmPatterns } from '../ear/advanced/rhythmPatterns'
import { intonationStages } from '../ear/advanced/intonation'
import type { EarStatsData } from '../ear/stats'
import PianoLoadStatus from '../audio/PianoLoadStatus'
import { ListenButton } from '../ear/advanced/TrainingControls'
import { usePhrase } from '../ear/advanced/usePhrase'
import type { Sound } from '../ear/exercises'
import PianoTrainer from '../instrument/PianoTrainer'
import FretboardTrainer from '../instrument/mastery/FretboardTrainer'
import SightReadingTrainer from '../instrument/mastery/SightReadingTrainer'
import type { SaveRound } from '../instrument/stats'
import SingingSession from '../vocal/SingingSession'
import type { VocalStats } from '../vocal/stats'
import type { Mission } from './campaign'
import type { GeneratedExercise, GeneratorSettings } from './generator'

export interface ExerciseSources {
  ear: EarStatsData
  vocal: VocalStats
  instrument: SaveRound
}

export type MissionResult = { accuracy: number; practiced: boolean; maxStars?: number }

export interface RunnerProps {
  sources: ExerciseSources
  onActiveChange: (active: boolean) => void
  onResult?: (result: MissionResult) => void
}

function useScores(sources: ExerciseSources, onResult?: RunnerProps['onResult']) {
  const latest = useRef({ sources, onResult })
  latest.current = { sources, onResult }
  const ear: EarStatsData = {
    ...sources.ear,
    recordExercise(exercise, correct, attempts, practiced = true) {
      latest.current.sources.ear.recordExercise(exercise, correct, attempts, practiced)
      latest.current.onResult?.({ accuracy: attempts ? 100 * correct / attempts : 0, practiced })
    },
  }
  const save = useCallback<SaveRound>(result => {
    latest.current.sources.instrument(result)
    if (result.activity !== 'strum') latest.current.onResult?.({
      accuracy: result.accuracy, practiced: (result.attempts ?? 0) > 0, maxStars: result.stars,
    })
  }, [])
  const saveVocal = useCallback<VocalStats['saveRound']>(result => {
    latest.current.sources.vocal.saveRound(result)
    if (result.kind === 'pitch') latest.current.onResult?.({ accuracy: result.accuracy, practiced: result.coverage > 0 })
  }, [])
  return { ear, save, saveVocal }
}

export function MissionRunner({ mission, sources, onResult, onActiveChange }: RunnerProps & { mission: Mission }) {
  const echo = useMemo(() => mission.kind === 'echo' ? melodies.find(item => item.id === mission.id) : null, [mission])
  const progression = useMemo(() => mission.kind === 'progression' ? progressions.find(item => item.id === mission.id) : null, [mission])
  const melody = useMemo(() => echo ? melodyForExercise(echo) : null, [echo])
  const chords = useMemo(() => progression ? progressionForExercise(progression) : null, [progression])
  const { ear, save, saveVocal } = useScores(sources, onResult)
  const instrument = { save, onActiveChange }
  switch (mission.kind) {
    case 'echo': return melody && <MelodicEcho stats={ear} preset={melody} />
    case 'progression': return chords && <ProgressionTrainer stats={ear} preset={chords}
      nextPreset={previous => progressionQuestion(previous.correct.difficulty, previous.correct, previous.tonic)} />
    case 'rhythm': return <RhythmTapTrainer stats={ear} preset={rhythmPatterns.find(item => item.id === mission.id)} />
    case 'intonation': return <IntonationTrainer stats={ear} preset={intonationStages.find(item => item.id === mission.id)} />
    case 'warmup':
    case 'etude': return <SingingSession mode={mission.kind} presetId={mission.id}
      range={sources.vocal.range} save={saveVocal} onActiveChange={onActiveChange} />
    case 'piano': return <PianoTrainer {...instrument} preset={mission} />
    case 'guitar': return <FretboardTrainer {...instrument} preset={mission} />
    case 'reading': return <SightReadingTrainer {...instrument} preset={mission} />
  }
}

function PhrasePreview({ sound }: { sound: Sound }) {
  const audio = usePhrase()
  return <div className="journey-preview">
    <ListenButton playing={audio.playing === 'phrase'} heard={false} listen={() => audio.listen(sound)}
      stop={audio.stop} before="ฟังตาม BPM ที่ตั้ง" />
    <PianoLoadStatus notes={sound.cues.flatMap(cue => cue.notes)} />
    {audio.error && <p className="field-error" role="alert">{audio.error}</p>}
  </div>
}

export function GeneratedRunner({ exercise, settings, falling, sources, onActiveChange }: RunnerProps & {
  exercise: GeneratedExercise; settings: GeneratorSettings; falling: boolean
}) {
  switch (exercise.kind) {
    case 'echo': return <MelodicEcho stats={sources.ear} preset={exercise.preset} />
    case 'progression': return <ProgressionTrainer stats={sources.ear} preset={exercise.preset} />
    case 'rhythm': return <RhythmTapTrainer stats={sources.ear} preset={exercise.preset} />
    case 'reading': return <>
      <PhrasePreview sound={exercise.preset.sound} />
      {falling ? <PianoTrainer save={sources.instrument} onActiveChange={onActiveChange}
        preset={{ song: exercise.preset.song, timed: true }} />
        : <SightReadingTrainer save={sources.instrument} onActiveChange={onActiveChange}
          preset={{ notes: exercise.preset.notes, clef: exercise.preset.clef, difficulty: settings.difficulty, meter: settings.meter }} />}
    </>
  }
}
