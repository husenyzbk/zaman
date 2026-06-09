import { useRef, useState, useEffect, useLayoutEffect, useMemo } from 'react'
import { XMarkIcon, PlusIcon, ArrowLeftIcon, ArrowsRightLeftIcon, TrashIcon, PencilIcon, DocumentIcon, LinkIcon } from '@heroicons/react/24/outline'
import useStore from '../store/useStore'
import { formatDate, formatDateRange } from '../utils/format'
import { RELATIONSHIP_MAP, RELATIONSHIPS } from '../utils/connections'
import EntityForm from './EntityForm'
import RelationshipPicker from './RelationshipPicker'
import ConfirmDialog from './ConfirmDialog'

function normalizeRef(r) {
  return typeof r === 'string' ? { text: r } : r
}

const AXIS_H = 40
const BLOCK_H = 48
const BLOCK_GAP = 8
const LANE_HDR = 26
const BASE_PX = 80
const NOTE_COLORS = ['#fbbf24', '#34d399', '#60a5fa', '#f472b6']

function toX(year, chStart, zoom) {
  return (year - chStart) * BASE_PX * zoom
}

export default function DrilldownTimeline({ chapterId, onClose }) {
  const {
    events, chapters, connections, stickyNotes,
    addSubEvent, updateSubEvent, deleteSubEvent,
    addConnection, deleteConnection,
    addStickyNote, updateStickyNote, moveStickyNote, deleteStickyNote,
  } = useStore()

  const chapter = chapters.find(c => c.id === chapterId) || null
  const chStart = chapter ? new Date(chapter.date).getFullYear() : 2000
  const chEnd = chapter ? new Date(chapter.endDate || chapter.date).getFullYear() + 1 : 2001

  const canvasRef = useRef(null)
  const [dims, setDims] = useState({ width: 800, height: 500 })
  const [zoom, setZoom] = useState(1)
  const [scrollX, setScrollX] = useState(0)
  const isDragging = useRef(false)
  const dragMoved = useRef(false)
  const lastX = useRef(0)
  const draggingNote = useRef(null)
  const menuRef = useRef(null)
  const arrowMenuRef = useRef(null)

  const [showForm, setShowForm] = useState(null)
  const [editingSE, setEditingSE] = useState(null)
  const [selectedSE, setSelectedSE] = useState(null)
  const [hiddenRels, setHiddenRels] = useState(new Set())
  const [editingNoteId, setEditingNoteId] = useState(null)
  const [sePanelWidth, setSePanelWidth] = useState(256)

  function handleSePanelDragStart(e) {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = sePanelWidth
    function onMove(e) {
      const dx = startX - e.clientX
      setSePanelWidth(Math.min(Math.max(startWidth + dx, 200), 560))
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // Local connecting mode (keeps drill-down self-contained)
  const [ddConnectingFrom, setDdConnectingFrom] = useState(null)
  const [ddConnectingTo, setDdConnectingTo] = useState(null)

  // Arrow interaction
  const [selectedArrowId, setSelectedArrowId] = useState(null)
  const [deletingArrowIds, setDeletingArrowIds] = useState(new Set())
  const [arrowHovered, setArrowHovered] = useState(null) // { conn, rel, x, y }
  const [arrowMenu, setArrowMenu] = useState(null) // { conn, rel, x, y }

  // Sub-event context menu
  const [ddContextMenu, setDdContextMenu] = useState(null) // { entity, x, y }
  const [confirmDelete, setConfirmDelete] = useState(null) // { id }

  useEffect(() => {
    if (!chapter) onClose()
  }, [chapter, onClose])

  useLayoutEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const measure = () => setDims({ width: el.clientWidth, height: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const spanYears = chEnd - chStart || 1
    const newZoom = Math.min(Math.max((dims.width * 0.85) / (spanYears * BASE_PX), 0.25), 8)
    setZoom(newZoom)
    setScrollX(0)
  }, [chapterId, dims.width])

  function handleArrowDeleteIntent(id) {
    setDeletingArrowIds(prev => new Set([...prev, id]))
    setSelectedArrowId(null)
    setTimeout(() => {
      deleteConnection(id)
      setDeletingArrowIds(prev => { const n = new Set(prev); n.delete(id); return n })
    }, 220)
  }

  function getEntityTitle(id, type) {
    if (type === 'subEvent') return subEvents.find(se => se.id === id)?.title || '(unknown)'
    return relevantEvents.find(e => e.id === id)?.title || '(unknown)'
  }

  // Escape: cancel connecting → context menu → selected arrow → close
  // Delete: delete selected arrow
  useEffect(() => {
    const h = (e) => {
      if (e.key === 'Escape') {
        if (ddConnectingFrom) { setDdConnectingFrom(null); setDdConnectingTo(null); return }
        if (ddContextMenu) { setDdContextMenu(null); return }
        if (arrowMenu) { setArrowMenu(null); return }
        if (selectedArrowId) { setSelectedArrowId(null); return }
        onClose()
      }
      if (e.key === 'Delete' && selectedArrowId) {
        handleArrowDeleteIntent(selectedArrowId)
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [ddConnectingFrom, ddContextMenu, arrowMenu, selectedArrowId, onClose])

  // Context menu click-outside
  useEffect(() => {
    if (!ddContextMenu) return
    function onDown(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setDdContextMenu(null)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [ddContextMenu])

  // Arrow menu click-outside
  useEffect(() => {
    if (!arrowMenu) return
    function onDown(e) {
      if (arrowMenuRef.current && !arrowMenuRef.current.contains(e.target)) setArrowMenu(null)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [arrowMenu])

  const subEvents = useMemo(() =>
    (chapter?.subEvents || []).slice().sort((a, b) => new Date(a.date) - new Date(b.date))
  , [chapter?.subEvents])

  const relevantEvents = useMemo(() => {
    if (!chapter) return []
    const start = new Date(chapter.date)
    const end = chapter.endDate ? new Date(chapter.endDate) : new Date(chapter.date)
    return events
      .filter(e => { const d = new Date(e.date); return d >= start && d <= end })
      .sort((a, b) => new Date(a.date) - new Date(b.date))
  }, [events, chapter?.date, chapter?.endDate])

  const viewIds = useMemo(() => {
    const s = new Set()
    subEvents.forEach(se => s.add(se.id))
    relevantEvents.forEach(e => s.add(e.id))
    return s
  }, [subEvents, relevantEvents])

  const allViewConns = useMemo(() =>
    connections.filter(c => viewIds.has(c.fromId) && viewIds.has(c.toId))
  , [connections, viewIds])

  const viewConns = useMemo(() =>
    allViewConns.filter(c => !hiddenRels.has(c.relationship))
  , [allViewConns, hiddenRels])

  const relCounts = useMemo(() => {
    const rc = {}
    allViewConns.forEach(c => { rc[c.relationship] = (rc[c.relationship] || 0) + 1 })
    return rc
  }, [allViewConns])

  const seRows = useMemo(() => {
    const rowEndX = [], rowMap = {}
    for (const se of subEvents) {
      const x = toX(new Date(se.date).getFullYear(), chStart, zoom)
      const w = Math.max(BASE_PX * zoom * 0.8, 80, se.title.length * 7 + 32)
      let row = -1
      for (let r = 0; r < rowEndX.length; r++) {
        if (x - rowEndX[r] >= BLOCK_GAP) { row = r; rowEndX[r] = x + w / 2; break }
      }
      if (row === -1) { row = rowEndX.length; rowEndX.push(x + w / 2) }
      rowMap[se.id] = row
    }
    return rowMap
  }, [subEvents, zoom, chStart])

  const evRows = useMemo(() => {
    const rowEndX = [], rowMap = {}
    for (const ev of relevantEvents) {
      const x = toX(new Date(ev.date).getFullYear(), chStart, zoom)
      const w = Math.max(BASE_PX * zoom * 0.8, 80, ev.title.length * 7 + 32)
      let row = -1
      for (let r = 0; r < rowEndX.length; r++) {
        if (x - rowEndX[r] >= BLOCK_GAP) { row = r; rowEndX[r] = x + w / 2; break }
      }
      if (row === -1) { row = rowEndX.length; rowEndX.push(x + w / 2) }
      rowMap[ev.id] = row
    }
    return rowMap
  }, [relevantEvents, zoom, chStart])

  const maxSERow = subEvents.length > 0 ? Math.max(0, ...subEvents.map(se => seRows[se.id] ?? 0)) : 0
  const seLaneH = LANE_HDR + (maxSERow + 1) * (BLOCK_H + BLOCK_GAP) + 16
  const evLaneTop = AXIS_H + seLaneH

  // Chapter-scoped sticky notes
  const chapterNotes = useMemo(() =>
    stickyNotes.filter(n => n.chapterId === chapterId)
  , [stickyNotes, chapterId])

  function getPos(id, type) {
    if (type === 'subEvent') {
      const se = subEvents.find(s => s.id === id)
      if (!se) return null
      const x = toX(new Date(se.date).getFullYear(), chStart, zoom) - scrollX
      const row = seRows[se.id] ?? 0
      const top = AXIS_H + LANE_HDR + row * (BLOCK_H + BLOCK_GAP)
      return { cx: x, top, bottom: top + BLOCK_H, laneType: 'se' }
    }
    if (type === 'event') {
      const ev = relevantEvents.find(e => e.id === id)
      if (!ev) return null
      const x = toX(new Date(ev.date).getFullYear(), chStart, zoom) - scrollX
      const row = evRows[ev.id] ?? 0
      const top = evLaneTop + LANE_HDR + row * (BLOCK_H + BLOCK_GAP)
      return { cx: x, top, bottom: top + BLOCK_H, laneType: 'ev' }
    }
    return null
  }

  function handleMouseDown(e) {
    if (e.button !== 0) return
    isDragging.current = true; dragMoved.current = false; lastX.current = e.clientX
  }
  function handleMouseMove(e) {
    if (draggingNote.current) {
      const { noteId, startX, startY, origYear, origYFrac } = draggingNote.current
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      const newYear = origYear + dx / (BASE_PX * zoom)
      const newYFrac = Math.min(Math.max(origYFrac + dy / dims.height, 0), 0.92)
      moveStickyNote(noteId, { year: newYear, yFrac: newYFrac })
      return
    }
    if (!isDragging.current) return
    const dx = e.clientX - lastX.current
    if (Math.abs(dx) > 3) dragMoved.current = true
    lastX.current = e.clientX
    const max = Math.max(0, toX(chEnd, chStart, zoom) - dims.width)
    setScrollX(s => Math.min(Math.max(s - dx, 0), max))
  }
  function handleMouseUp() {
    if (draggingNote.current) {
      const { noteId } = draggingNote.current
      const note = stickyNotes.find(n => n.id === noteId)
      if (note) updateStickyNote(noteId, { year: note.year, yFrac: note.yFrac })
      draggingNote.current = null
    }
    isDragging.current = false
  }

  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const onWheel = (e) => {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) {
        setZoom(z => Math.min(Math.max(z * (e.deltaY > 0 ? 0.9 : 1.1), 0.2), 8))
      } else {
        const max = Math.max(0, toX(chEnd, chStart, zoom) - dims.width)
        setScrollX(s => Math.min(Math.max(s + e.deltaY * 1.5, 0), max))
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  })

  function screenToDate(clientX) {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return chapter?.date || ''
    const year = (clientX - rect.left + scrollX) / (BASE_PX * zoom) + chStart
    const clamped = Math.min(Math.max(year, chStart), chEnd - 0.08)
    const y = Math.floor(clamped)
    const month = Math.round((clamped - y) * 12)
    return new Date(y, month, 1).toISOString().split('T')[0]
  }

  function screenToYear(clientX) {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return chStart
    return (clientX - rect.left + scrollX) / (BASE_PX * zoom) + chStart
  }

  const spanYears = chEnd - chStart || 1
  const tickInterval = spanYears > 50 ? 10 : spanYears > 20 ? 5 : spanYears > 10 ? 2 : 1
  const ticks = []
  for (let y = Math.ceil(chStart / tickInterval) * tickInterval; y <= chEnd; y += tickInterval) {
    ticks.push(y)
  }

  if (!chapter) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--bg-deep)] zam-overlay-fade">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--bg-surface)] bg-[var(--bg-base)] flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors">
            <ArrowLeftIcon className="w-4 h-4" />
            Main Timeline
          </button>
          <span className="text-slate-600">/</span>
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: chapter.color || '#6366f1' }} />
          <span className="text-white font-semibold text-sm">{chapter.title}</span>
          <span className="text-slate-500 text-xs">{formatDateRange(chapter.date, chapter.endDate)}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowForm({ date: chapter.date })}
            className="flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            <PlusIcon className="w-3.5 h-3.5" /> Sub-event
          </button>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Connection filter */}
      {allViewConns.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-1.5 border-b border-[var(--bg-surface)] bg-[var(--bg-deep)] flex-shrink-0 flex-wrap">
          <span className="text-xs text-slate-600 uppercase tracking-wider mr-1">Connections:</span>
          {RELATIONSHIPS.filter(r => relCounts[r.id]).map(r => {
            const hidden = hiddenRels.has(r.id)
            return (
              <button
                key={r.id}
                onClick={() => setHiddenRels(prev => { const n = new Set(prev); n.has(r.id) ? n.delete(r.id) : n.add(r.id); return n })}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all"
                style={{ background: hidden ? 'transparent' : r.color + '18', borderColor: hidden ? 'var(--border)' : r.color + '60', color: hidden ? 'var(--text-dim)' : r.color }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: hidden ? 'var(--text-dim)' : r.color }} />
                {r.label} ({relCounts[r.id]})
              </button>
            )
          })}
        </div>
      )}

      {/* Connecting mode banner */}
      {ddConnectingFrom && (
        <div className="flex items-center justify-between px-4 py-2 bg-indigo-900/40 border-b border-indigo-500/30 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            <p className="text-sm text-indigo-300">
              Connecting from <span className="font-semibold" style={{ color: ddConnectingFrom.color }}>{ddConnectingFrom.title}</span>
              <span className="text-slate-400 ml-2">— click any entity to link</span>
            </p>
          </div>
          <button
            onClick={() => { setDdConnectingFrom(null); setDdConnectingTo(null) }}
            className="text-xs text-slate-400 hover:text-white transition-colors px-2 py-1 rounded border border-[var(--border)] hover:border-slate-400"
          >
            Cancel (Esc)
          </button>
        </div>
      )}

      {/* Canvas */}
      <div
        ref={canvasRef}
        className="flex-1 relative overflow-hidden select-none"
        style={{ cursor: isDragging.current ? 'grabbing' : (ddConnectingFrom ? 'crosshair' : 'grab') }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={() => { setSelectedSE(null); setDdContextMenu(null); setSelectedArrowId(null); setArrowMenu(null) }}
        onDoubleClick={(e) => {
          if (!e.shiftKey) return
          const rect = canvasRef.current?.getBoundingClientRect()
          if (!rect) return
          const year = screenToYear(e.clientX)
          const yFrac = Math.max(0, Math.min((e.clientY - rect.top) / dims.height, 0.9))
          addStickyNote({ year, yFrac, text: '', color: NOTE_COLORS[chapterNotes.length % NOTE_COLORS.length], chapterId })
        }}
      >
        <svg
          className="absolute top-0 left-0 pointer-events-none"
          width="100%" height={dims.height}
          style={{ zIndex: 1, overflow: 'visible' }}
        >
          {/* Chapter range tint */}
          {(() => {
            const x1 = toX(chStart, chStart, zoom) - scrollX
            const x2 = toX(chEnd, chStart, zoom) - scrollX
            return (
              <rect
                x={Math.max(0, x1)} y={0}
                width={Math.max(0, Math.min(dims.width, x2) - Math.max(0, x1))}
                height={dims.height}
                fill={chapter.color || '#6366f1'} fillOpacity={0.04}
              />
            )
          })()}

          {/* Grid lines */}
          {ticks.map(year => {
            const x = toX(year, chStart, zoom) - scrollX
            if (x < -60 || x > dims.width + 60) return null
            return (
              <g key={year}>
                <line x1={x} y1={AXIS_H} x2={x} y2={dims.height} stroke="var(--bg-hover)" strokeWidth={1} />
                <line x1={x} y1={AXIS_H - 12} x2={x} y2={AXIS_H - 1} stroke="var(--text-dim)" strokeWidth={1.5} />
                <text x={x} y={AXIS_H - 16} textAnchor="middle" fill="var(--text-dim)" fontSize={11} fontFamily="Inter, sans-serif">{year}</text>
              </g>
            )
          })}
          <line x1={0} y1={AXIS_H - 1} x2="100%" y2={AXIS_H - 1} stroke="var(--border)" strokeWidth={1} />
          <line x1={0} y1={AXIS_H + seLaneH} x2="100%" y2={AXIS_H + seLaneH} stroke="var(--border)" strokeWidth={1} strokeDasharray="4 4" />

          {/* Arrow markers */}
          <defs>
            {RELATIONSHIPS.map(r => (
              <marker key={r.id} id={`dd-${r.id}`} markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto">
                <path d="M 0 0.5 L 6 3.5 L 0 6.5 z" fill={r.color} />
              </marker>
            ))}
          </defs>

          {/* Connection arrows */}
          {viewConns.map(conn => {
            const rel = RELATIONSHIP_MAP[conn.relationship]
            if (!rel) return null
            const fp = getPos(conn.fromId, conn.fromType)
            const tp = getPos(conn.toId, conn.toType)
            if (!fp || !tp) return null

            let f, t, p1, p2
            if (fp.laneType === tp.laneType) {
              const arcH = Math.min(Math.max(Math.abs(tp.cx - fp.cx) * 0.25, 30), 80)
              const arcY = Math.max(fp.bottom, tp.bottom) + arcH
              f = { x: fp.cx, y: fp.bottom }; t = { x: tp.cx, y: tp.bottom }
              p1 = { x: f.x, y: arcY }; p2 = { x: t.x, y: arcY }
            } else {
              f = { x: fp.cx, y: fp.laneType === 'se' ? fp.bottom : fp.top }
              t = { x: tp.cx, y: tp.laneType === 'se' ? tp.bottom : tp.top }
              const midY = (f.y + t.y) / 2
              p1 = { x: f.x, y: midY }; p2 = { x: t.x, y: midY }
            }
            const path = `M ${f.x} ${f.y} C ${p1.x} ${p1.y} ${p2.x} ${p2.y} ${t.x} ${t.y}`
            const mid = { x: (f.x * 0.5 + t.x * 0.5), y: (f.y * 0.5 + t.y * 0.5) }
            const lw = rel.label.length * 5.2 + 14
            const isSelected = selectedArrowId === conn.id
            const isHovered = arrowHovered?.conn.id === conn.id
            const isDeleting = deletingArrowIds.has(conn.id)
            return (
              <g
                key={conn.id}
                className={isDeleting ? 'zam-arrow-deleting' : 'zam-arrow-enter'}
                onMouseEnter={(e) => setArrowHovered({ conn, rel, x: e.clientX, y: e.clientY })}
                onMouseLeave={() => setArrowHovered(null)}
                onMouseMove={(e) => setArrowHovered(h => h ? { ...h, x: e.clientX, y: e.clientY } : null)}
              >
                {/* Selection glow */}
                {isSelected && (
                  <path d={path} stroke={rel.color} strokeWidth={10} fill="none" strokeOpacity={0.22} pointerEvents="none" />
                )}
                {/* Glow */}
                <path d={path} stroke={rel.color} strokeWidth={5} fill="none"
                  strokeOpacity={isSelected ? 0.25 : (isHovered ? 0.18 : 0.08)} pointerEvents="none"
                  style={{ transition: 'stroke-opacity 0.15s ease' }}
                />
                {/* Line */}
                <path d={path} stroke={rel.color} fill="none"
                  strokeDasharray={rel.dash || undefined}
                  markerEnd={`url(#dd-${conn.relationship})`}
                  pointerEvents="none"
                  pathLength="1"
                  className="zam-arrow-draw"
                  style={{
                    strokeWidth: isSelected ? 3 : (isHovered ? 2.5 : 1.5),
                    strokeOpacity: isSelected || isHovered ? 1 : 0.7,
                  }}
                />
                {/* Hit area */}
                <path d={path} stroke="transparent" strokeWidth={14} fill="none"
                  pointerEvents="stroke"
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => { e.stopPropagation(); setSelectedArrowId(isSelected ? null : conn.id) }}
                  onContextMenu={(e) => {
                    e.preventDefault(); e.stopPropagation()
                    const menuW = 224, menuH = 108
                    setSelectedArrowId(conn.id)
                    setArrowMenu({
                      conn, rel,
                      x: Math.min(e.clientX + 4, window.innerWidth - menuW - 8),
                      y: Math.min(e.clientY + 4, window.innerHeight - menuH - 8),
                    })
                  }}
                />
                {/* Label pill */}
                <rect x={mid.x - lw / 2} y={mid.y - 8} width={lw} height={14} rx={7} fill="var(--bg-deep)" fillOpacity={0.9} pointerEvents="none" />
                <text x={mid.x} y={mid.y + 3.5} textAnchor="middle" fill={rel.color} fontSize={7.5}
                  fontFamily="Inter, sans-serif" fontWeight={700} letterSpacing={0.5} pointerEvents="none">
                  {rel.label.toUpperCase()}
                </text>
              </g>
            )
          })}
        </svg>

        {/* Lane labels */}
        <div className="absolute top-0 left-0 right-0 pointer-events-none" style={{ zIndex: 2 }}>
          <div style={{ height: AXIS_H }} />
          <div className="flex items-center px-3 text-xs font-semibold tracking-wider uppercase" style={{ height: LANE_HDR, color: chapter.color || '#6366f1' }}>
            Sub-events
          </div>
          <div style={{ height: seLaneH - LANE_HDR }} />
          {relevantEvents.length > 0 && (
            <div className="flex items-center px-3 text-xs font-semibold tracking-wider uppercase" style={{ height: LANE_HDR, color: 'var(--border-mid)' }}>
              Events in this period
            </div>
          )}
        </div>

        {/* Sub-event lane — double-click to create */}
        <div
          className="absolute left-0 right-0"
          style={{ top: AXIS_H, height: seLaneH, zIndex: 3 }}
          onDoubleClick={(e) => { e.stopPropagation(); if (!e.shiftKey) setShowForm({ date: screenToDate(e.clientX) }) }}
        />

        {/* Sub-event blocks */}
        {subEvents.map((se, seIdx) => {
          const x = toX(new Date(se.date).getFullYear(), chStart, zoom) - scrollX
          const w = Math.max(BASE_PX * zoom * 0.8, 80, se.title.length * 7 + 32)
          const row = seRows[se.id] ?? 0
          const top = AXIS_H + LANE_HDR + row * (BLOCK_H + BLOCK_GAP)
          if (x + w / 2 < 0 || x - w / 2 > dims.width) return null
          const isSel = selectedSE?.id === se.id
          const isConnSrc = ddConnectingFrom?.id === se.id
          const color = se.color || chapter.color || '#6366f1'
          return (
            <div
              key={se.id}
              onClick={(e) => {
                e.stopPropagation()
                if (dragMoved.current) return
                if (ddConnectingFrom) {
                  if (!isConnSrc) setDdConnectingTo({ id: se.id, type: 'subEvent', title: se.title, color })
                  return
                }
                setSelectedSE(isSel ? null : se)
              }}
              onDoubleClick={(e) => { e.stopPropagation(); setEditingSE(se) }}
              onContextMenu={(e) => {
                e.preventDefault(); e.stopPropagation()
                const menuW = 180, menuH = 132
                setDdContextMenu({
                  entity: se,
                  x: Math.min(e.clientX + 4, window.innerWidth - menuW - 8),
                  y: Math.min(e.clientY + 4, window.innerHeight - menuH - 8),
                })
              }}
              className="absolute flex flex-col justify-center px-3 rounded-xl cursor-pointer transition-all zam-enter"
              style={{
                left: x - w / 2, width: w, height: BLOCK_H, top, zIndex: 4,
                background: color + (isConnSrc ? '44' : '22'),
                border: `1.5px solid ${color}`,
                borderLeft: `3px solid ${color}`,
                boxShadow: isSel ? `0 0 0 2px ${color}, 0 0 12px ${color}66`
                  : isConnSrc ? `0 0 0 2px white, 0 0 12px ${color}` : 'none',
                animationDelay: `${seIdx * 0.045}s`,
              }}
            >
              <p className="text-xs font-semibold truncate" style={{ color }}>{se.title}</p>
              <p className="text-[10px] text-slate-500 truncate">{formatDate(se.date)}</p>
            </div>
          )
        })}

        {/* Events in range (read-only, clickable while connecting) */}
        {relevantEvents.map(ev => {
          const x = toX(new Date(ev.date).getFullYear(), chStart, zoom) - scrollX
          const w = Math.max(BASE_PX * zoom * 0.8, 80, ev.title.length * 7 + 32)
          const row = evRows[ev.id] ?? 0
          const top = evLaneTop + LANE_HDR + row * (BLOCK_H + BLOCK_GAP)
          if (x + w / 2 < 0 || x - w / 2 > dims.width) return null
          const color = ev.color || '#6366f1'
          return (
            <div
              key={ev.id}
              onClick={(e) => {
                e.stopPropagation()
                if (ddConnectingFrom) setDdConnectingTo({ id: ev.id, type: 'event', title: ev.title, color })
              }}
              className="absolute flex flex-col justify-center px-3 rounded-xl zam-enter"
              style={{
                left: x - w / 2, width: w, height: BLOCK_H, top, zIndex: 4,
                background: color + '22',
                border: `1.5px solid ${color}`,
                opacity: 0.6,
                cursor: ddConnectingFrom ? 'pointer' : 'default',
              }}
            >
              <p className="text-xs font-semibold truncate" style={{ color }}>{ev.title}</p>
              <p className="text-[10px] text-slate-500 truncate">{formatDate(ev.date)}</p>
            </div>
          )
        })}

        {/* Sticky notes */}
        {chapterNotes.map(note => {
          const noteX = toX(note.year, chStart, zoom) - scrollX
          const noteY = note.yFrac * dims.height
          return (
            <div
              key={note.id}
              className="absolute rounded-lg shadow-xl"
              style={{ left: noteX, top: noteY, width: 180, zIndex: 15 }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div
                className="flex items-center justify-between px-2 py-1 rounded-t-lg cursor-move select-none"
                style={{ background: note.color, opacity: 0.92 }}
                onMouseDown={(e) => {
                  e.stopPropagation()
                  draggingNote.current = { noteId: note.id, startX: e.clientX, startY: e.clientY, origYear: note.year, origYFrac: note.yFrac }
                }}
              >
                <span className="text-[9px] font-bold text-black/50 uppercase tracking-wider">note</span>
                <button
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); deleteStickyNote(note.id) }}
                  className="text-black/40 hover:text-black/80 text-base leading-none ml-2 transition-colors"
                >×</button>
              </div>
              {editingNoteId === note.id ? (
                <textarea
                  autoFocus
                  value={note.text}
                  onChange={e => moveStickyNote(note.id, { text: e.target.value })}
                  onBlur={() => { updateStickyNote(note.id, { text: note.text }); setEditingNoteId(null) }}
                  onMouseDown={e => e.stopPropagation()}
                  className="w-full p-2 text-xs text-black/80 resize-none outline-none rounded-b-lg"
                  style={{ background: note.color + 'cc', minHeight: 72 }}
                />
              ) : (
                <div
                  onClick={(e) => { e.stopPropagation(); setEditingNoteId(note.id) }}
                  className="p-2 text-xs text-black/80 cursor-text min-h-[72px] whitespace-pre-wrap leading-relaxed rounded-b-lg"
                  style={{ background: note.color + 'cc' }}
                >
                  {note.text || <span className="text-black/30 italic">Click to write…</span>}
                </div>
              )}
            </div>
          )
        })}

        {/* Empty state */}
        {subEvents.length === 0 && (
          <div
            className="absolute left-0 right-0 flex flex-col items-center justify-center gap-2 pointer-events-none"
            style={{ top: AXIS_H + LANE_HDR, height: seLaneH - LANE_HDR }}
          >
            <p className="text-slate-600 text-sm">No sub-events yet</p>
            <p className="text-slate-700 text-xs">Double-click above to create one</p>
          </div>
        )}

        {/* Arrow hover tooltip */}
        {arrowHovered && !arrowMenu && (
          <div
            className="fixed pointer-events-none z-[200] bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl shadow-2xl p-3"
            style={{ left: Math.min(arrowHovered.x + 14, window.innerWidth - 208), top: arrowHovered.y - 8, width: 200 }}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide"
                style={{ background: arrowHovered.rel.color + '25', color: arrowHovered.rel.color }}>
                {arrowHovered.rel.label}
              </span>
            </div>
            <p className="text-xs text-slate-400 truncate">
              <span className="text-slate-600 mr-1">From</span>
              <span className="text-slate-200">{getEntityTitle(arrowHovered.conn.fromId, arrowHovered.conn.fromType)}</span>
            </p>
            <p className="text-xs text-slate-400 truncate mt-0.5">
              <span className="text-slate-600 mr-1">To</span>
              <span className="text-slate-200">{getEntityTitle(arrowHovered.conn.toId, arrowHovered.conn.toType)}</span>
            </p>
            {arrowHovered.conn.notes && (
              <p className="text-[10px] text-slate-400 italic mt-2 pt-2 border-t border-[var(--border)] line-clamp-3">
                {arrowHovered.conn.notes}
              </p>
            )}
          </div>
        )}

        {/* Selected sub-event detail panel */}
        {selectedSE && (
          <div
            className="absolute right-0 top-0 bottom-0 bg-[var(--bg-base)]/95 border-l border-[var(--border)] z-20 flex flex-col zam-slide-right"
            style={{ width: sePanelWidth, backdropFilter: 'blur(8px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div
              onMouseDown={handleSePanelDragStart}
              onDoubleClick={() => setSePanelWidth(256)}
              className="absolute left-0 top-0 bottom-0 w-1 z-10 group"
              style={{ cursor: 'col-resize' }}
              title="Drag to resize · Double-click to reset"
            >
              <div className="absolute inset-0 group-hover:bg-indigo-500/40 transition-colors" />
              <div className="absolute left-0 top-1/2 -translate-y-1/2 flex flex-col gap-1 items-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ marginLeft: 2 }}>
                <span className="w-0.5 h-3 bg-indigo-400/60 rounded-full" />
                <span className="w-0.5 h-3 bg-indigo-400/60 rounded-full" />
                <span className="w-0.5 h-3 bg-indigo-400/60 rounded-full" />
              </div>
            </div>
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--border)] flex-shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: selectedSE.color || chapter.color || '#6366f1' }} />
                <p className="text-sm font-semibold text-white truncate">{selectedSE.title}</p>
              </div>
              <button onClick={() => setSelectedSE(null)} className="text-slate-500 hover:text-white p-1 ml-1 flex-shrink-0">
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-3 space-y-3">
              <p className="text-xs text-slate-500">{formatDate(selectedSE.date)}</p>
              {selectedSE.description && (
                <div>
                  <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">Description</p>
                  <div className="prose-content text-xs text-slate-300 leading-relaxed" dangerouslySetInnerHTML={{ __html: selectedSE.description }} />
                </div>
              )}
              {selectedSE.opinion && (
                <div>
                  <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">Opinion</p>
                  <div className="prose-content text-xs text-slate-400 italic leading-relaxed border-l-2 pl-2" style={{ borderColor: selectedSE.color || chapter.color || '#6366f1' }} dangerouslySetInnerHTML={{ __html: selectedSE.opinion }} />
                </div>
              )}
              {selectedSE.people?.length > 0 && (
                <div>
                  <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">People</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedSE.people.map((p, i) => (
                      <span key={i} className="text-xs bg-[var(--bg-surface)] border border-[var(--border)] text-slate-300 px-2 py-0.5 rounded-full">{p}</span>
                    ))}
                  </div>
                </div>
              )}
              {selectedSE.references?.length > 0 && (
                <div>
                  <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">References</p>
                  <ul className="space-y-1.5">
                    {selectedSE.references.map((r, i) => {
                      const ref = normalizeRef(r)
                      return (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-slate-500 text-xs flex-shrink-0">–</span>
                          <div className="min-w-0">
                            <span className="text-xs text-slate-300">{ref.text}</span>
                            {ref.attachment && (
                              <div className="mt-1">
                                {ref.attachment.type?.startsWith('image/') ? (
                                  <a href={ref.attachment.dataUrl} target="_blank" rel="noreferrer">
                                    <img src={ref.attachment.dataUrl} alt={ref.attachment.name} className="max-h-16 w-auto rounded border border-[var(--border)] object-cover" />
                                  </a>
                                ) : (
                                  <a href={ref.attachment.dataUrl} download={ref.attachment.name} className="flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300">
                                    <DocumentIcon className="w-3 h-3 flex-shrink-0" />
                                    <span className="truncate">{ref.attachment.name}</span>
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
              {selectedSE.links?.length > 0 && (
                <div>
                  <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">Links</p>
                  {selectedSE.links.map((l, i) => (
                    <a key={i} href={l.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 block truncate mb-1">
                      <LinkIcon className="w-3 h-3 flex-shrink-0 inline" />
                      {l.label || l.url}
                    </a>
                  ))}
                </div>
              )}
              <div className="pt-2 border-t border-[var(--border)] space-y-2">
                <button
                  onClick={() => { setEditingSE(selectedSE); setSelectedSE(null) }}
                  className="w-full text-xs bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border border-[var(--border)] text-slate-300 rounded-lg py-1.5 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    setDdConnectingFrom({ id: selectedSE.id, type: 'subEvent', title: selectedSE.title, color: selectedSE.color || chapter.color || '#6366f1' })
                    setSelectedSE(null)
                  }}
                  className="w-full text-xs bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-400 rounded-lg py-1.5 transition-colors"
                >
                  Add Connection
                </button>
                <button
                  onClick={() => { setConfirmDelete({ id: selectedSE.id }); setSelectedSE(null) }}
                  className="w-full text-xs text-red-400 hover:text-red-300 bg-[var(--bg-surface)] hover:bg-[var(--bg-base)] border border-[var(--border)] rounded-lg py-1.5 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center py-1.5 text-xs text-slate-700 border-t border-[var(--bg-surface)] flex-shrink-0">
        Double-click sub-event lane to create · Right-click to connect/delete · Shift+double-click for sticky note · Ctrl+scroll to zoom · Esc to go back
      </div>

      {/* Sub-event context menu */}
      {ddContextMenu && (
        <div
          ref={menuRef}
          className="fixed z-[200] bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl shadow-2xl py-1 overflow-hidden zam-menu-pop"
          style={{ left: ddContextMenu.x, top: ddContextMenu.y, width: 180 }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div className="px-3 py-2 border-b border-[var(--border)]">
            <p className="text-xs font-semibold text-white truncate">{ddContextMenu.entity.title}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">Sub-event</p>
          </div>
          <div className="py-1">
            <button
              onClick={() => { setEditingSE(ddContextMenu.entity); setDdContextMenu(null) }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-[var(--bg-base)] transition-colors text-left"
            >
              <PencilIcon className="w-3.5 h-3.5" />
              Edit
            </button>
            <button
              onClick={() => {
                const se = ddContextMenu.entity
                setDdConnectingFrom({ id: se.id, type: 'subEvent', title: se.title, color: se.color || chapter.color || '#6366f1' })
                setDdContextMenu(null)
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-[var(--bg-base)] transition-colors text-left"
            >
              <ArrowsRightLeftIcon className="w-3.5 h-3.5" />
              Add Connection
            </button>
            <button
              onClick={() => { setConfirmDelete({ id: ddContextMenu.entity.id }); setDdContextMenu(null) }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-[var(--bg-base)] transition-colors text-left"
            >
              <TrashIcon className="w-3.5 h-3.5" />
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Arrow right-click menu */}
      {arrowMenu && (
        <div
          ref={arrowMenuRef}
          className="fixed z-[200] bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl shadow-2xl py-1 overflow-hidden zam-menu-pop"
          style={{ left: arrowMenu.x, top: arrowMenu.y, width: 224 }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div className="px-3 py-2.5 border-b border-[var(--border)]">
            <span
              className="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide mb-1.5"
              style={{ background: arrowMenu.rel.color + '25', color: arrowMenu.rel.color }}
            >
              {arrowMenu.rel.label}
            </span>
            <p className="text-xs text-white truncate">{getEntityTitle(arrowMenu.conn.fromId, arrowMenu.conn.fromType)}</p>
            <p className="text-[10px] text-slate-500 truncate">→ {getEntityTitle(arrowMenu.conn.toId, arrowMenu.conn.toType)}</p>
          </div>
          <div className="py-1">
            <button
              onClick={() => { handleArrowDeleteIntent(arrowMenu.conn.id); setArrowMenu(null) }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-[var(--bg-base)] transition-colors text-left"
            >
              <TrashIcon className="w-3.5 h-3.5" />
              Delete connection
            </button>
          </div>
        </div>
      )}

      {/* EntityForm for add/edit sub-events */}
      {(showForm || editingSE) && (
        <EntityForm
          type="subEvent"
          initial={editingSE || (showForm?.date ? { date: showForm.date } : {})}
          minDate={chapter.date}
          maxDate={chapter.endDate}
          onSave={(form) => {
            if (editingSE) {
              updateSubEvent(chapter.id, editingSE.id, form)
              if (selectedSE?.id === editingSE.id) setSelectedSE({ ...editingSE, ...form })
              setEditingSE(null)
            } else {
              addSubEvent(chapter.id, form)
              setShowForm(null)
            }
          }}
          onClose={() => { setShowForm(null); setEditingSE(null) }}
        />
      )}

      {/* Relationship picker */}
      {ddConnectingFrom && ddConnectingTo && (
        <RelationshipPicker
          from={ddConnectingFrom}
          to={ddConnectingTo}
          onConfirm={(relationship, notes) => {
            addConnection({
              fromId: ddConnectingFrom.id, fromType: ddConnectingFrom.type,
              toId: ddConnectingTo.id, toType: ddConnectingTo.type,
              relationship, notes,
            })
            setDdConnectingFrom(null)
            setDdConnectingTo(null)
          }}
          onCancel={() => { setDdConnectingFrom(null); setDdConnectingTo(null) }}
        />
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <ConfirmDialog
          message={`Delete "${subEvents.find(se => se.id === confirmDelete.id)?.title}"?`}
          onConfirm={() => {
            deleteSubEvent(chapterId, confirmDelete.id)
            if (selectedSE?.id === confirmDelete.id) setSelectedSE(null)
            setConfirmDelete(null)
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}
