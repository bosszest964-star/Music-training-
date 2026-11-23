const matchWindowMs = 145
export const exactWindowMs = 40
export const accuracyWindowMs = 85

export type TapGrade = 'exact' | 'early' | 'late' | 'extra'
export interface TapMark {
  index: number
  offset: number
  grade: TapGrade
}

export const tapNames: Record<TapGrade, string> = {
  exact: 'ตรงเป๊ะ', early: 'เร็วไป', late: 'ช้าไป', extra: 'นอกแพตเทิร์น',
}

export function judgeTap(targets: readonly number[], used: ReadonlySet<number>, time: number): TapMark {
  let index = -1
  let offset = matchWindowMs + 1
  targets.forEach((target, candidate) => {
    const delta = (time - target) * 1000
    if (Math.abs(delta) < Math.abs(offset)) {
      index = candidate
      offset = delta
    }
  })
  if (index < 0 || used.has(index) || Math.abs(offset) > matchWindowMs) return { index: -1, offset: 0, grade: 'extra' }
  const milliseconds = Math.round(offset)
  return { index, offset: milliseconds, grade: Math.abs(milliseconds) <= exactWindowMs ? 'exact' : milliseconds < 0 ? 'early' : 'late' }
}

export function summarizeTaps(targetCount: number, taps: readonly TapMark[]) {
  const matched = taps.filter(tap => tap.index >= 0)
  const exact = matched.filter(tap => tap.grade === 'exact').length
  const early = matched.filter(tap => tap.grade === 'early').length
  const late = matched.length - exact - early
  const correct = matched.filter(tap => Math.abs(tap.offset) <= accuracyWindowMs).length
  const extras = taps.length - matched.length
  const attempts = targetCount + extras
  const average = matched.length
    ? Math.round(matched.reduce((sum, tap) => sum + Math.abs(tap.offset), 0) / matched.length)
    : null
  return { correct, attempts, exact, early, late, extras, missed: targetCount - matched.length, average }
}

export function eventTime(timestamp: number, now: number, origin: number) {
  const value = timestamp > 1e12 ? timestamp - origin : timestamp
  return Number.isFinite(value) && value > 0 && value <= now + 1 && now - value <= 2000 ? value : now
}

export function audibleTime(
  now: number, event: number, contextTime: number, latency: number, output?: AudioTimestamp,
) {
  if (output?.performanceTime && Number.isFinite(output.contextTime)) {
    return (output.contextTime ?? 0) + (event - output.performanceTime) / 1000
  }
  return contextTime + (event - now) / 1000 - Math.max(0, latency)
}
