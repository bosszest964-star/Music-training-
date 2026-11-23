import { clefs, ledgerPositions } from './sightReading'
import type { Clef, StaffClef, StaffNote } from './sightReading'
import { notationGlyphs } from './notationGlyphs'

const gap = 14
const left = 27
const right = 393
const head = 221

function Stave({ clef, bottom }: { clef: StaffClef; bottom: number }) {
  return (
    <g>
      <g stroke="#6a6183" strokeWidth={1.3}>
        {Array.from({ length: 5 }, (_, i) => <line key={i} x1={left} x2={right} y1={bottom - gap * i} y2={bottom - gap * i} />)}
        <line x1={right} x2={right} y1={bottom - 4 * gap} y2={bottom} />
      </g>
      <path d={notationGlyphs[clef]} fill="#eadfff" transform={`translate(47 ${bottom}) scale(.056 -.056)`} />
    </g>
  )
}

export default function MusicStaff({ clef, note }: { clef: Clef; note: StaffNote | null }) {
  const grand = clef === 'grand'
  const upperBottom = 116
  const lowerBottom = grand ? 226 : upperBottom
  const bottom = note?.clef === 'bass' ? lowerBottom : upperBottom
  const y = note ? bottom - note.position * gap / 2 : 0
  const stemDown = !!note && note.position >= 4
  const position = note ? note.position % 2 === 0
    ? `เส้นลำดับ ${note.position / 2 + 1} นับจากเส้นล่าง`
    : `ช่องระหว่างเส้นลำดับ ${Math.floor(note.position / 2) + 1} และ ${Math.floor(note.position / 2) + 2} นับจากเส้นล่าง` : ''
  const label = note ? `${clefs[note.clef]} ${position}${note.accidental === 1 ? ' ติดชาร์ป' : note.accidental === -1 ? ' ติดแฟลต' : ''}`
    : `${clefs[clef]} รอเริ่มรอบ`

  return (
    <figure className="mastery-score-sheet">
      <svg viewBox={`0 0 420 ${grand ? 285 : 178}`} role="img" aria-label={label} focusable="false">
        {grand && <g>
          <line x1={left} x2={left} y1={upperBottom - 4 * gap} y2={lowerBottom} stroke="#a396bd" strokeWidth={2} />
          <path d="M26 60C8 63 23 127 9 143C23 159 8 224 26 226C15 220 29 160 15 143C29 126 15 65 26 60Z" fill="#bbadd3" />
        </g>}
        {clef !== 'bass' && <Stave clef="treble" bottom={upperBottom} />}
        {clef !== 'treble' && <Stave clef="bass" bottom={lowerBottom} />}
        {note && <g fill="#f7eefe" stroke="#f7eefe">
          {ledgerPositions(note.position).map(line => <line key={line} x1={head - 15} x2={head + 15}
            y1={bottom - line * gap / 2} y2={bottom - line * gap / 2} strokeWidth={1.7} />)}
          {note.accidental !== 0 && <path d={notationGlyphs[note.accidental > 0 ? 'sharp' : 'flat']} stroke="none"
            transform={`translate(${head - 34} ${note.accidental > 0 ? y + 6 : y}) scale(.043 -.043)`} />}
          <ellipse cx={head} cy={y} rx={8.8} ry={5.4} transform={`rotate(-22 ${head} ${y})`} />
          <line x1={head + (stemDown ? -7.4 : 7.4)} x2={head + (stemDown ? -7.4 : 7.4)}
            y1={y} y2={y + (stemDown ? 37 : -37)} strokeWidth={1.8} />
        </g>}
      </svg>
    </figure>
  )
}
