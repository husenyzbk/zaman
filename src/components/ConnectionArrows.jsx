import { useState, useRef, useEffect } from 'react'
import { TrashIcon } from '@heroicons/react/24/outline'
import useStore, { TIMELINE_START } from '../store/useStore'
import { yearToX, BASE_PX_PER_YEAR } from '../utils/timeline'
import { RELATIONSHIPS, RELATIONSHIP_MAP } from '../utils/connections'

const BLOCK_HEIGHT = 52
const SUBEVENT_BLOCK_H = 44
const BLOCK_GAP = 8
const LANE_HEADER = 28
const AXIS_HEIGHT = 40

function bezierPt(p0, p1, p2, p3, t) {
  const u = 1 - t
  return {
    x: u*u*u*p0.x + 3*u*u*t*p1.x + 3*u*t*t*p2.x + t*t*t*p3.x,
    y: u*u*u*p0.y + 3*u*u*t*p1.y + 3*u*t*t*p2.y + t*t*t*p3.y,
  }
}

export default function ConnectionArrows({ laneHeight, canvasHeight, eventRows, chapterRows, hiddenRels, hiddenCats, expandedChapters, subEventTimelineRows, focusedEntityId, blockH, selectedArrowId, onSelectArrow, deletingArrowIds, onArrowDeleteIntent }) {
  const { connections, events, chapters, zoom, scrollX, showConnections, focusModeId } = useStore()
  const [hovered, setHovered] = useState(null) // { arrow, x, y }
  const [arrowMenu, setArrowMenu] = useState(null) // { arrow, x, y }
  const menuRef = useRef(null)

  useEffect(() => {
    if (!arrowMenu) return
    function onDown(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setArrowMenu(null)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [arrowMenu])

  const offsetX = -yearToX(TIMELINE_START, zoom)
  const blockW = Math.max(BASE_PX_PER_YEAR * zoom * 0.8, 80)

  const BH = blockH || BLOCK_HEIGHT
  // Sub-event lane top (mirrors the calculation in Timeline)
  const maxChapterRow = Object.values(chapterRows).length > 0 ? Math.max(...Object.values(chapterRows)) : -1
  const subEventLaneTop = AXIS_HEIGHT + LANE_HEADER + (maxChapterRow + 1) * (BH + BLOCK_GAP) + 6

  function getEntityTitle(id, type) {
    if (type === 'event') return events.find(e => e.id === id)?.title || '(unknown)'
    if (type === 'chapter') return chapters.find(c => c.id === id)?.title || '(unknown)'
    const se = chapters.flatMap(c => c.subEvents || []).find(s => s.id === id)
    return se?.title || '(unknown)'
  }

  function getEntityCategory(id, type) {
    if (type === 'event') return events.find(e => e.id === id)?.category || ''
    if (type === 'chapter') return chapters.find(c => c.id === id)?.category || ''
    return ''
  }

  function getPos(id, type) {
    if (type === 'event') {
      const ev = events.find(e => e.id === id)
      if (!ev) return null
      const cx = yearToX(new Date(ev.date).getFullYear(), zoom) + offsetX - scrollX
      const row = eventRows[ev.id] || 0
      const top = AXIS_HEIGHT + laneHeight + LANE_HEADER + row * (BH + BLOCK_GAP)
      return { cx, cy: top + BH / 2, top, bottom: top + BH, w: blockW, h: BH, laneType: 'event' }
    }
    if (type === 'chapter') {
      const ch = chapters.find(c => c.id === id)
      if (!ch) return null
      const x1 = yearToX(new Date(ch.date).getFullYear(), zoom) + offsetX - scrollX
      const x2 = yearToX(new Date(ch.endDate || ch.date).getFullYear(), zoom) + offsetX - scrollX
      const w = Math.max(x2 - x1, 24)
      const row = chapterRows[ch.id] || 0
      const top = AXIS_HEIGHT + LANE_HEADER + row * (BH + BLOCK_GAP)
      return { cx: x1 + w / 2, cy: top + BH / 2, top, bottom: top + BH, w, h: BH, laneType: 'chapter' }
    }
    const allSubEvents = chapters.flatMap(c => (c.subEvents || []).map(se => ({ ...se, _chapterId: c.id })))
    const se = allSubEvents.find(s => s.id === id)
    if (!se) return null
    // If the parent chapter is expanded, return the sub-event's own timeline position
    if (expandedChapters?.has(se._chapterId)) {
      const x = yearToX(new Date(se.date).getFullYear(), zoom) + offsetX - scrollX
      const row = subEventTimelineRows?.[se.id] ?? 0
      const top = subEventLaneTop + row * (SUBEVENT_BLOCK_H + BLOCK_GAP)
      return { cx: x, cy: top + SUBEVENT_BLOCK_H / 2, top, bottom: top + SUBEVENT_BLOCK_H, w: blockW, h: SUBEVENT_BLOCK_H, laneType: 'chapter' }
    }
    return getPos(se._chapterId, 'chapter')
  }

  function buildArrow(fp, tp) {
    let f, t, p1, p2

    if (fp.laneType === 'event' && tp.laneType === 'event') {
      const arcH = Math.min(Math.max(Math.abs(tp.cx - fp.cx) * 0.2, 35), 100)
      const arcY = Math.max(fp.bottom, tp.bottom) + arcH
      f = { x: fp.cx, y: fp.bottom }
      t = { x: tp.cx, y: tp.bottom }
      p1 = { x: f.x, y: arcY }
      p2 = { x: t.x, y: arcY }
    } else if (fp.laneType === 'chapter' && tp.laneType === 'chapter') {
      const arcH = Math.min(Math.max(Math.abs(tp.cx - fp.cx) * 0.2, 35), 100)
      const arcY = Math.min(
        Math.max(fp.bottom, tp.bottom) + arcH,
        AXIS_HEIGHT + laneHeight - 16
      )
      f = { x: fp.cx, y: fp.bottom }
      t = { x: tp.cx, y: tp.bottom }
      p1 = { x: f.x, y: arcY }
      p2 = { x: t.x, y: arcY }
    } else {
      if (fp.laneType === 'event') {
        f = { x: fp.cx, y: fp.top }
        t = { x: tp.cx, y: tp.bottom }
      } else {
        f = { x: fp.cx, y: fp.bottom }
        t = { x: tp.cx, y: tp.top }
      }
      const midY = (f.y + t.y) / 2
      p1 = { x: f.x, y: midY }
      p2 = { x: t.x, y: midY }
    }

    const mid = bezierPt(f, p1, p2, t, 0.5)
    return {
      path: `M ${f.x} ${f.y} C ${p1.x} ${p1.y} ${p2.x} ${p2.y} ${t.x} ${t.y}`,
      mid,
    }
  }

  const arrows = connections
    .filter(c => !hiddenRels.has(c.relationship))
    .filter(c => {
      if (!hiddenCats || hiddenCats.size === 0) return true
      const fromCat = getEntityCategory(c.fromId, c.fromType)
      const toCat = getEntityCategory(c.toId, c.toType)
      if (fromCat && hiddenCats.has(fromCat)) return false
      if (toCat && hiddenCats.has(toCat)) return false
      return true
    })
    .map(conn => {
      const rel = RELATIONSHIP_MAP[conn.relationship]
      if (!rel) return null
      const fp = getPos(conn.fromId, conn.fromType)
      const tp = getPos(conn.toId, conn.toType)
      if (!fp || !tp) return null
      const { path, mid } = buildArrow(fp, tp)
      const labelW = rel.label.length * 5.2 + 14
      return {
        id: conn.id,
        path, mid,
        color: rel.color,
        label: rel.label,
        labelW,
        dash: rel.dash,
        relationship: conn.relationship,
        fromId: conn.fromId, fromType: conn.fromType,
        toId: conn.toId, toType: conn.toType,
        notes: conn.notes || '',
      }
    })
    .filter(Boolean)

  if (!showConnections || arrows.length === 0) return null

  const activeId = focusModeId || focusedEntityId || null

  const tooltipW = 200
  const tooltipX = hovered ? Math.min(hovered.x + 14, window.innerWidth - tooltipW - 8) : 0
  const tooltipY = hovered ? hovered.y - 8 : 0

  return (
    <>
      <svg
        className="absolute top-0 left-0 pointer-events-none"
        width="100%"
        height={canvasHeight}
        style={{ zIndex: 5, overflow: 'visible' }}
      >
        <defs>
          {RELATIONSHIPS.map(r => (
            <marker key={r.id} id={`zm-${r.id}`} markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto">
              <path d="M 0 0.5 L 6 3.5 L 0 6.5 z" fill={r.color} />
            </marker>
          ))}
        </defs>

        {arrows.map(a => {
          const isActive = !activeId || a.fromId === activeId || a.toId === activeId
          const isSelected = selectedArrowId === a.id
          const isHovered = hovered?.arrow.id === a.id
          const isDeleting = deletingArrowIds?.has(a.id)
          return (
          <g
            key={a.id}
            className={isDeleting ? 'zam-arrow-deleting' : 'zam-arrow-enter'}
            onMouseEnter={(e) => setHovered({ arrow: a, x: e.clientX, y: e.clientY })}
            onMouseLeave={() => setHovered(null)}
            onMouseMove={(e) => setHovered(h => h ? { ...h, x: e.clientX, y: e.clientY } : null)}
            style={{ opacity: isActive ? 1 : 0.12, transition: 'opacity 0.2s' }}
          >
            {/* Selection glow (extra ring when selected) */}
            {isSelected && (
              <path d={a.path} stroke={a.color} strokeWidth={10} fill="none" strokeOpacity={0.22} pointerEvents="none" />
            )}
            {/* Glow */}
            <path d={a.path} stroke={a.color} strokeWidth={5} fill="none" strokeOpacity={isSelected ? 0.25 : (isHovered ? 0.18 : 0.08)} pointerEvents="none" style={{ transition: 'stroke-opacity 0.15s ease' }} />
            {/* Line */}
            <path
              d={a.path}
              stroke={a.color}
              fill="none"
              strokeDasharray={a.dash || undefined}
              markerEnd={`url(#zm-${a.relationship})`}
              pointerEvents="none"
              pathLength="1"
              className="zam-arrow-draw"
              style={{
                strokeWidth: isSelected ? 3 : (isHovered ? 2.5 : 1.5),
                strokeOpacity: isSelected || isHovered ? 1 : 0.7,
              }}
            />
            {/* Hit area — click to select, right-click for menu */}
            <path
              d={a.path}
              stroke="transparent"
              strokeWidth={14}
              fill="none"
              pointerEvents="stroke"
              style={{ cursor: 'pointer' }}
              onClick={(e) => { e.stopPropagation(); onSelectArrow?.(isSelected ? null : a.id) }}
              onContextMenu={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onSelectArrow?.(a.id)
                setArrowMenu({ arrow: a, x: e.clientX, y: e.clientY })
              }}
            />
            {/* Label pill */}
            <rect
              x={a.mid.x - a.labelW / 2}
              y={a.mid.y - 8}
              width={a.labelW}
              height={14}
              rx={7}
              fill="var(--bg-deep)"
              fillOpacity={0.9}
              pointerEvents="none"
            />
            <text
              x={a.mid.x}
              y={a.mid.y + 3.5}
              textAnchor="middle"
              fill={a.color}
              fontSize={7.5}
              fontFamily="Inter, sans-serif"
              fontWeight={700}
              letterSpacing={0.5}
              pointerEvents="none"
            >
              {a.label.toUpperCase()}
            </text>
          </g>
          )
        })}
      </svg>

      {/* Hover tooltip */}
      {hovered && (
        <div
          className="fixed pointer-events-none z-[200] bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl shadow-2xl p-3"
          style={{ left: tooltipX, top: tooltipY, width: tooltipW }}
        >
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide" style={{ background: hovered.arrow.color + '25', color: hovered.arrow.color }}>
              {hovered.arrow.label}
            </span>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-slate-400 truncate">
              <span className="text-slate-600 mr-1">From</span>
              <span className="text-slate-200">{getEntityTitle(hovered.arrow.fromId, hovered.arrow.fromType)}</span>
            </p>
            <p className="text-xs text-slate-400 truncate">
              <span className="text-slate-600 mr-1">To</span>
              <span className="text-slate-200">{getEntityTitle(hovered.arrow.toId, hovered.arrow.toType)}</span>
            </p>
          </div>
          {hovered.arrow.notes && (
            <p className="text-[10px] text-slate-400 italic mt-2 pt-2 border-t border-[var(--border)] line-clamp-3">
              {hovered.arrow.notes}
            </p>
          )}
        </div>
      )}

      {/* Arrow right-click context menu */}
      {arrowMenu && (() => {
        const rel = RELATIONSHIP_MAP[arrowMenu.arrow.relationship]
        const fromTitle = getEntityTitle(arrowMenu.arrow.fromId, arrowMenu.arrow.fromType)
        const toTitle = getEntityTitle(arrowMenu.arrow.toId, arrowMenu.arrow.toType)
        const menuW = 224
        const menuH = 108
        const px = Math.min(arrowMenu.x + 4, window.innerWidth - menuW - 8)
        const py = Math.min(arrowMenu.y + 4, window.innerHeight - menuH - 8)
        return (
          <div
            ref={menuRef}
            className="fixed z-[200] bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl shadow-2xl py-1 overflow-hidden zam-menu-pop"
            style={{ left: px, top: py, width: menuW }}
            onContextMenu={(e) => e.preventDefault()}
          >
            <div className="px-3 py-2.5 border-b border-[var(--border)]">
              <span
                className="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide mb-1.5"
                style={{ background: (rel?.color || '#6366f1') + '25', color: rel?.color || '#6366f1' }}
              >
                {rel?.label || arrowMenu.arrow.relationship}
              </span>
              <p className="text-xs text-white truncate">{fromTitle}</p>
              <p className="text-[10px] text-slate-500 truncate">→ {toTitle}</p>
            </div>
            <div className="py-1">
              <button
                onClick={() => {
                  onArrowDeleteIntent?.(arrowMenu.arrow.id)
                  setArrowMenu(null)
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-[var(--bg-base)] transition-colors text-left"
              >
                <TrashIcon className="w-3.5 h-3.5" />
                Delete connection
              </button>
            </div>
          </div>
        )
      })()}
    </>
  )
}
