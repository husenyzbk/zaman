import { useRef, useState } from 'react'
import useStore, { TIMELINE_START, TIMELINE_END } from '../store/useStore'
import { yearToX, BASE_PX_PER_YEAR } from '../utils/timeline'

const TOTAL_YEARS = TIMELINE_END - TIMELINE_START

export default function MiniMap({ containerWidth }) {
  const { scrollX, setScrollX, zoom, events, chapters } = useStore()
  const ref = useRef(null)
  const [dragging, setDragging] = useState(false)

  const mapWidth = ref.current?.clientWidth || containerWidth || window.innerWidth

  // Viewport indicator
  const viewportYears = containerWidth / (BASE_PX_PER_YEAR * zoom)
  const viewportStartYear = scrollX / (BASE_PX_PER_YEAR * zoom) + TIMELINE_START
  const viewLeft = Math.max(0, ((viewportStartYear - TIMELINE_START) / TOTAL_YEARS) * mapWidth)
  const viewWidth = Math.min((viewportYears / TOTAL_YEARS) * mapWidth, mapWidth - viewLeft)

  function yearToMapX(year) {
    return ((year - TIMELINE_START) / TOTAL_YEARS) * mapWidth
  }

  function mapXToScrollX(mapX) {
    const year = TIMELINE_START + (mapX / mapWidth) * TOTAL_YEARS
    return Math.max(0, yearToX(year, zoom) - yearToX(TIMELINE_START, zoom) - containerWidth / 2)
  }

  function handleClick(e) {
    if (dragging) return
    const rect = ref.current.getBoundingClientRect()
    setScrollX(mapXToScrollX(e.clientX - rect.left))
  }

  // Decade markers
  const decades = []
  for (let y = Math.ceil(TIMELINE_START / 10) * 10; y <= TIMELINE_END; y += 10) {
    decades.push(y)
  }

  return (
    <div
      ref={ref}
      className="relative w-full flex-shrink-0 cursor-pointer"
      style={{ height: 28, background: 'var(--bg-deep)', borderTop: '1px solid var(--bg-surface)' }}
      onClick={handleClick}
    >
      {/* Decade ticks */}
      {decades.map((y) => {
        const x = yearToMapX(y)
        const isMajor = y % 50 === 0
        return (
          <div
            key={y}
            className="absolute top-0 pointer-events-none"
            style={{
              left: x,
              width: 1,
              height: isMajor ? 8 : 4,
              background: isMajor ? 'var(--border)' : 'var(--bg-surface)',
            }}
          />
        )
      })}

      {/* Century labels */}
      {[1900, 1950, 2000, 2050, 2100].map((y) => {
        if (y < TIMELINE_START || y > TIMELINE_END) return null
        return (
          <span
            key={y}
            className="absolute text-[9px] text-slate-600 pointer-events-none"
            style={{ left: yearToMapX(y) + 2, top: 8 }}
          >
            {y}
          </span>
        )
      })}

      {/* Chapter marks */}
      {chapters.map((c) => {
        const x1 = yearToMapX(new Date(c.date).getFullYear())
        const x2 = yearToMapX(new Date(c.endDate || c.date).getFullYear())
        return (
          <div
            key={c.id}
            className="absolute pointer-events-none"
            style={{
              left: x1,
              width: Math.max(x2 - x1, 2),
              top: 2,
              height: 4,
              background: c.color || '#6366f1',
              opacity: 0.5,
              borderRadius: 2,
            }}
          />
        )
      })}

      {/* Event dots */}
      {events.map((e) => {
        const x = yearToMapX(new Date(e.date).getFullYear())
        return (
          <div
            key={e.id}
            className="absolute pointer-events-none"
            style={{
              left: x - 1,
              width: 3,
              height: 3,
              top: 8,
              background: e.color || '#6366f1',
              borderRadius: '50%',
              opacity: 0.7,
            }}
          />
        )
      })}

      {/* Today line */}
      {(() => {
        const x = yearToMapX(new Date().getFullYear())
        return (
          <div
            className="absolute pointer-events-none"
            style={{ left: x, top: 0, width: 1, height: '100%', background: '#f43f5e66' }}
          />
        )
      })()}

      {/* Viewport indicator */}
      <div
        className="absolute top-0 h-full pointer-events-none"
        style={{
          left: viewLeft,
          width: Math.max(viewWidth, 4),
          background: 'rgba(99,102,241,0.12)',
          border: '1px solid rgba(99,102,241,0.35)',
          borderRadius: 2,
        }}
      />
    </div>
  )
}
