import { playMetronomeClick } from '../audio/metronomeClick'
import { pianoReady, playPiano } from '../audio/pianoEngine'
import type { PianoCue, VocalPlan } from './music'

function melodyCues(plan: VocalPlan): PianoCue[] {
  return plan.targets.flatMap(target => {
    if (target.from === target.to) {
      return [{ at: target.start, duration: (target.end - target.start) * 0.78, notes: [target.from] }]
    }
    return Array.from({ length: 4 }, (_, step) => ({
      at: target.start + step * plan.beat,
      duration: plan.beat * 0.72,
      notes: [Math.round(target.from + (target.to - target.from) * step / 4)],
    }))
  })
}

export function singingPianoNotes(plan: VocalPlan) {
  return [...melodyCues(plan), ...plan.backing].flatMap(cue => cue.notes)
}

export function scheduleSinging(context: AudioContext, plan: VocalPlan, guide: boolean) {
  const start = context.currentTime + 0.08
  const melody = melodyCues(plan)
  const hasBacking = plan.backing.length > 0
  const countBeats = hasBacking ? plan.beatsPerBar : 2
  const sampled = pianoReady(singingPianoNotes(plan))
  const countStart = hasBacking ? start + 0.32 : start + plan.duration
  const singStart = countStart + countBeats * plan.beat
  const click = context.createGain()
  click.gain.value = 0.19
  click.connect(context.destination)
  for (let beat = 0; beat < countBeats; beat += 1) {
    playMetronomeClick(context, click, countStart + beat * plan.beat, beat ? 'regular' : 'downbeat')
  }

  function play(cue: PianoCue, from: number, level: number, velocity: number) {
    for (const midi of cue.notes) {
      playPiano(context, context.destination, { midi, time: from + cue.at, duration: cue.duration, level, velocity, sampled })
    }
  }

  if (hasBacking) {
    play({ at: 0, duration: 0.23, notes: melody[0].notes }, start, 0.24, 0.69)
    for (const cue of plan.backing) play(cue, singStart, 0.097, 0.57)
    if (guide) for (const cue of melody) play(cue, singStart, 0.22, 0.71)
  } else {
    for (const cue of melody) play({ ...cue, duration: Math.min(cue.duration, plan.beat * 0.72) }, start, 0.25, 0.75)
    const last = plan.targets.at(-1)
    if (last && last.from !== last.to) {
      play({ at: plan.duration - plan.beat * 0.3, duration: plan.beat * 0.28, notes: [last.to] }, start, 0.22, 0.69)
    }
  }
  return { countStart, countBeats, singStart }
}
