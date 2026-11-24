import { earStoragePrefix, isHistoryKey, parseCounts } from '../ear/stats'
import { instrumentStoragePrefix, parseInstrumentRound } from '../instrument/stats'
import { parsePracticeTotals, practiceStorageKey } from '../usePractice'
import { parseVocalRange, parseVocalRound, vocalRangeKey, vocalRoundPrefix } from '../vocal/stats'
import { counterKeyPattern, parseCounter } from './generator'
import { isCalendarDay, journeyKey, mergeJourney, parseJourney } from './progress'

const format = 'music-training-progress'
const idPattern = /^[.a-zA-Z0-9_-]{1,120}$/
export const backupLimit = 10 * 1024 * 1024

function validEarKey(key: string) {
  return isHistoryKey(key) && isCalendarDay(key.slice(earStoragePrefix.length, earStoragePrefix.length + 10))
    && idPattern.test(key.slice(earStoragePrefix.length + 11))
}

function sanitize(key: string, raw: string) {
  if (key === journeyKey) return parseJourney(raw)
  if (key === vocalRangeKey) return parseVocalRange(raw)
  if (key === practiceStorageKey) return parsePracticeTotals(raw)
  if (validEarKey(key)) return parseCounts(raw)
  if (key.startsWith(vocalRoundPrefix) && idPattern.test(key.slice(vocalRoundPrefix.length))) {
    return parseVocalRound(raw, key.slice(vocalRoundPrefix.length))
  }
  if (key.startsWith(instrumentStoragePrefix) && idPattern.test(key.slice(instrumentStoragePrefix.length))) {
    return parseInstrumentRound(raw, key.slice(instrumentStoragePrefix.length))
  }
  if (counterKeyPattern.test(key)) {
    const counter = parseCounter(raw)
    return counter === null ? null : String(counter)
  }
  return null
}

export function exportProgress(storage: Storage) {
  const entries: Record<string, string> = {}
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (!key) continue
    const raw = storage.getItem(key)
    if (raw === null) continue
    const parsed = sanitize(key, raw)
    if (parsed !== null) entries[key] = typeof parsed === 'string' ? parsed : JSON.stringify(parsed)
  }
  return JSON.stringify({ format, version: 1, entries }, null, 2)
}

function merge(key: string, incoming: string, local: string) {
  if (key === journeyKey) {
    const current = parseJourney(local)
    const backup = parseJourney(incoming)
    if (current && backup) return JSON.stringify(mergeJourney(current, backup))
  }
  if (key === practiceStorageKey) {
    const current = parsePracticeTotals(local)
    const backup = parsePracticeTotals(incoming)
    if (current && backup) {
      for (const [day, milliseconds] of Object.entries(backup)) current[day] = Math.max(current[day] ?? 0, milliseconds)
      return JSON.stringify(current)
    }
  }
  if (key.startsWith(earStoragePrefix)) {
    const current = parseCounts(local)
    const backup = parseCounts(incoming)
    if (current && backup) {
      for (const [id, value] of Object.entries(backup.bestStars)) current.bestStars[id] = Math.max(value, current.bestStars[id] ?? 0)
      for (const topic of Object.keys(current) as (keyof typeof current)[]) {
        if (topic === 'bestStars') continue
        const before = current[topic]
        const saved = backup[topic]
        if (saved.attempts > before.attempts || (saved.attempts === before.attempts && saved.correct > before.correct)) current[topic] = saved
      }
      return JSON.stringify(current)
    }
  }
  if (counterKeyPattern.test(key)) return (parseCounter(incoming) ?? 0n) > (parseCounter(local) ?? 0n) ? incoming : local
  return sanitize(key, local) === null ? incoming : local
}

export function importProgress(raw: string, storage: Storage) {
  const backup: unknown = JSON.parse(raw)
  if (!backup || typeof backup !== 'object' || !('format' in backup) || backup.format !== format
    || !('version' in backup) || backup.version !== 1 || !('entries' in backup)
    || !backup.entries || typeof backup.entries !== 'object' || Array.isArray(backup.entries)) {
    throw new Error('รูปแบบไฟล์ไม่ตรงกับไฟล์สำรองของห้องซ้อม')
  }
  const writes: { key: string; value: string; previous: string | null }[] = []
  for (const [key, value] of Object.entries(backup.entries)) {
    if (typeof value !== 'string') throw new Error('ไฟล์สำรองมีรายการที่อ่านไม่ได้')
    const parsed = sanitize(key, value)
    if (parsed === null) throw new Error('ไฟล์สำรองมีข้อมูลที่ไม่รู้จักหรือเสียหาย')
    const incoming = typeof parsed === 'string' ? parsed : JSON.stringify(parsed)
    const previous = storage.getItem(key)
    const next = previous === null ? incoming : merge(key, incoming, previous)
    if (next !== previous) writes.push({ key, value: next, previous })
  }
  const applied = []
  try {
    for (const write of writes) {
      storage.setItem(write.key, write.value)
      applied.push(write)
    }
  } catch (error) {
    for (const { key, previous } of applied.reverse()) {
      if (previous === null) storage.removeItem(key)
      else storage.setItem(key, previous)
    }
    throw error
  }
  return writes
}
