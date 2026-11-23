export const eqBands = [
  { hz: 125, label: '125 Hz', name: 'ทุ้มลึก', detail: 'ฟังน้ำหนักเบสที่อิ่มแน่นขึ้น เสียงกระแทกของกลองใหญ่จะชัดขึ้น' },
  { hz: 250, label: '250 Hz', name: 'ทุ้มกลาง', detail: 'เสียงอุ่นและหนาขึ้น ถ้าเพิ่มมากไปจะเริ่มอู้' },
  { hz: 500, label: '500 Hz', name: 'กลางต่ำ', detail: 'เนื้อเสียงทึบขึ้น คล้ายเสียงก้องอยู่ในกล่อง' },
  { hz: 1000, label: '1 kHz', name: 'กลาง', detail: 'ทำนองและคอร์ดเด่นขึ้น คล้ายเสียงพูดผ่านโทรโข่ง' },
  { hz: 2000, label: '2 kHz', name: 'กลางสูง', detail: 'ขอบเสียงพุ่งมาด้านหน้า ฟังขึ้นจมูกหรือแข็งขึ้นเมื่อเพิ่มมาก' },
  { hz: 4000, label: '4 kHz', name: 'คมชัด', detail: 'เสียงกระแทกและปลายตัวโน้ตชัดขึ้น ถ้ามากไปจะฟังสากหู' },
  { hz: 8000, label: '8 kHz', name: 'แหลมใส', detail: 'ปลายเสียงใสซิบขึ้น ลองฟังเสียงฉาบ เสียงดีดสาย และรายละเอียดปลายเสียง' },
] as const

export type Band = typeof eqBands[number]
export type BandHz = Band['hz']

const levels = {
  beginner: { label: 'เริ่มต้น', gain: 12, bands: [125, 1000, 8000] },
  intermediate: { label: 'กลาง', gain: 9, bands: [125, 250, 1000, 4000, 8000] },
  expert: { label: 'โปร', gain: 6, bands: [125, 250, 500, 1000, 2000, 4000, 8000] },
} satisfies Record<string, { label: string; gain: number; bands: BandHz[] }>

export type EqLevel = keyof typeof levels
export const eqLevels = levels

export function quizBands(level: EqLevel) {
  const allowed: readonly BandHz[] = levels[level].bands
  return eqBands.filter(band => allowed.includes(band.hz))
}

export function chooseBand(level: EqLevel, last?: Band) {
  const pool = quizBands(level).filter(band => band.hz !== last?.hz)
  return pool[Math.floor(Math.random() * pool.length)]
}
