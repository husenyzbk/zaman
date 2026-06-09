import { useRef, useState, useEffect, useLayoutEffect, useMemo, Fragment } from 'react'
import useStore, { TIMELINE_START, TIMELINE_END } from '../store/useStore'
import { yearToX, getTickInterval, formatYear, BASE_PX_PER_YEAR } from '../utils/timeline'
import { formatDate } from '../utils/format'
import { RELATIONSHIPS } from '../utils/connections'
import { CATEGORIES, CATEGORY_MAP } from '../utils/categories'
import { ChevronDownIcon, ChevronUpIcon, UsersIcon, PlusIcon, DocumentTextIcon } from '@heroicons/react/24/outline'
import EntityForm from './EntityForm'
import DetailPanel from './DetailPanel'
import ChapterModal from './ChapterModal'
import DrilldownTimeline from './DrilldownTimeline'
import MiniMap from './MiniMap'
import ConnectionArrows from './ConnectionArrows'
import RelationshipPicker from './RelationshipPicker'
import ChapterTargetPicker from './ChapterTargetPicker'
import ContextMenu from './ContextMenu'
import ConfirmDialog from './ConfirmDialog'

const AXIS_HEIGHT = 40
const BLOCK_GAP = 8
const LANE_HEADER = 28
const BLOCK_HEIGHTS = { compact: 40, default: 52, comfortable: 68 }
const SUBEVENT_HEIGHTS = { compact: 32, default: 44, comfortable: 56 }
const NOTE_COLORS = ['#fbbf24', '#34d399', '#60a5fa', '#f472b6']

export default function Timeline() {
  const {
    events, chapters, connections, stickyNotes,
    addEvent, updateEvent, deleteEvent,
    addChapter, updateChapter, deleteChapter, addConnection, deleteConnection,
    addSubEvent, updateSubEvent, deleteSubEvent,
    addStickyNote, updateStickyNote, moveStickyNote, deleteStickyNote,
    zoom, setZoom, scrollX, setScrollX,
    jumpToYear, clearJumpToYear,
    highlightId, clearHighlightId,
    connectingFrom, setConnectingFrom, clearConnectingFrom,
    density, undo, redo,
    jumpToSubEvent, clearJumpToSubEvent,
    focusModeId, setFocusMode, clearFocusMode,
  } = useStore()

  const BLOCK_H = BLOCK_HEIGHTS[density] ?? 52
  const SUBEVENT_BH = SUBEVENT_HEIGHTS[density] ?? 44

  const canvasRef = useRef(null)
  const [canvasDims, setCanvasDims] = useState({ width: window.innerWidth, height: 500 })
  const isDragging = useRef(false)
  const dragMoved = useRef(false)
  const lastX = useRef(0)
  const isDividerDragging = useRef(false)
  const draggingNote = useRef(null) // { noteId, startX, startY, origYear, origYFrac }
  const scrollAnimRef = useRef(null)
  const zoomAnimRef = useRef(null)
  const targetZoomRef = useRef(null)

  const [showForm, setShowForm] = useState(null)
  const [selectedEntity, setSelectedEntity] = useState(null)
  const [selectedChapter, setSelectedChapter] = useState(null)
  const [connectingTo, setConnectingTo] = useState(null)
  const [chapterTargetChapter, setChapterTargetChapter] = useState(null)
  const [hiddenRels, setHiddenRels] = useState(new Set())
  const [hiddenCats, setHiddenCats] = useState(new Set())
  const [contextMenu, setContextMenu] = useState(null)
  const [confirmDeleteCtx, setConfirmDeleteCtx] = useState(null)
  const [expandedChapters, setExpandedChapters] = useState(new Set())
  const [openSubEventId, setOpenSubEventId] = useState(null)
  const [drilldownChapterId, setDrilldownChapterId] = useState(null)
  const [deletingIds, setDeletingIds] = useState(new Set())
  const [deletingArrowIds, setDeletingArrowIds] = useState(new Set())
  const [flashType, setFlashType] = useState(null)
  const [selectedArrowId, setSelectedArrowId] = useState(null)
  const [laneResizeFrac, setLaneResizeFrac] = useState(0.5)
  const [focusedBlockIdx, setFocusedBlockIdx] = useState(-1)
  const [hoveredChapter, setHoveredChapter] = useState(null)
  const [showPeopleIndex, setShowPeopleIndex] = useState(false)
  const [highlightedPeople, setHighlightedPeople] = useState(new Set())
  const [editingNoteId, setEditingNoteId] = useState(null)
  const [canvasContextMenu, setCanvasContextMenu] = useState(null) // { screenX, screenY, date, year, yFrac }

  const canvasWidth = canvasDims.width
  const canvasHeight = canvasDims.height
  const laneHeight = Math.floor((canvasHeight - AXIS_HEIGHT) * laneResizeFrac)

  useLayoutEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const measure = () => setCanvasDims({ width: el.clientWidth, height: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const totalWidth = yearToX(TIMELINE_END, zoom) - yearToX(TIMELINE_START, zoom)
  const offsetX = -yearToX(TIMELINE_START, zoom)
  const blockW = Math.max(BASE_PX_PER_YEAR * zoom * 0.8, 80)

  // Tick intervals (for heatmap buckets too)
  const { major, minor } = getTickInterval(zoom)

  // Row assignment
  const chapterRows = useMemo(() => {
    const sorted = [...chapters].sort((a, b) => new Date(a.date) - new Date(b.date))
    const rowEndX = []
    const rowMap = {}
    for (const ch of sorted) {
      const x1 = yearToX(new Date(ch.date).getFullYear(), zoom) + offsetX
      const x2 = yearToX(new Date(ch.endDate || ch.date).getFullYear(), zoom) + offsetX
      let row = -1
      for (let r = 0; r < rowEndX.length; r++) {
        if (x1 >= rowEndX[r] + 4) { row = r; rowEndX[r] = x2; break }
      }
      if (row === -1) { row = rowEndX.length; rowEndX.push(x2) }
      rowMap[ch.id] = row
    }
    return rowMap
  }, [chapters, zoom])

  const eventRows = useMemo(() => {
    const sorted = [...events].sort((a, b) => new Date(a.date) - new Date(b.date))
    const rowEndX = []
    const rowMap = {}
    for (const ev of sorted) {
      const x = yearToX(new Date(ev.date).getFullYear(), zoom) + offsetX
      const evW = Math.max(BASE_PX_PER_YEAR * zoom * 0.8, 80, ev.title.length * 7 + 32)
      let row = -1
      for (let r = 0; r < rowEndX.length; r++) {
        if (x - rowEndX[r] >= BLOCK_GAP) { row = r; rowEndX[r] = x + evW / 2; break }
      }
      if (row === -1) { row = rowEndX.length; rowEndX.push(x + evW / 2) }
      rowMap[ev.id] = row
    }
    return rowMap
  }, [events, zoom])

  const subEventTimelineRows = useMemo(() => {
    const allSubEvts = chapters
      .filter(c => expandedChapters.has(c.id))
      .flatMap(c => (c.subEvents || []).map(se => ({ ...se, _chapterId: c.id })))
    const sorted = allSubEvts.slice().sort((a, b) => new Date(a.date) - new Date(b.date))
    const rowEndX = []
    const rowMap = {}
    for (const se of sorted) {
      const x = yearToX(new Date(se.date).getFullYear(), zoom) + offsetX
      const seW = Math.max(BASE_PX_PER_YEAR * zoom * 0.8, 80, se.title.length * 7 + 32)
      let row = -1
      for (let r = 0; r < rowEndX.length; r++) {
        if (x - rowEndX[r] >= BLOCK_GAP) { row = r; rowEndX[r] = x + seW / 2; break }
      }
      if (row === -1) { row = rowEndX.length; rowEndX.push(x + seW / 2) }
      rowMap[se.id] = row
    }
    return rowMap
  }, [chapters, expandedChapters, zoom])

  const activeEntityIds = useMemo(() => {
    const focusedId = selectedChapter?.id ?? selectedEntity?.entity?.id ?? null
    if (!focusedId) return null
    const ids = new Set([focusedId])
    connections.forEach(c => {
      if (c.fromId === focusedId) ids.add(c.toId)
      if (c.toId === focusedId) ids.add(c.fromId)
    })
    return ids
  }, [selectedChapter, selectedEntity, connections])

  const navigableBlocks = useMemo(() => {
    const blocks = []
    events.forEach(e => blocks.push({ id: e.id, type: 'event', entity: e, date: e.date }))
    chapters.forEach(c => {
      blocks.push({ id: c.id, type: 'chapter', entity: c, date: c.date })
      if (expandedChapters.has(c.id)) {
        ;(c.subEvents || []).forEach(se => blocks.push({ id: se.id, type: 'subEvent', entity: se, date: se.date, _chapterId: c.id }))
      }
    })
    return blocks.sort((a, b) => new Date(a.date) - new Date(b.date))
  }, [events, chapters, expandedChapters])

  // All unique people across all entities
  const allPeople = useMemo(() => {
    const map = new Map()
    const add = (people) => (people || []).forEach(p => { if (p) map.set(p, (map.get(p) || 0) + 1) })
    events.forEach(e => add(e.people))
    chapters.forEach(c => { add(c.people); (c.subEvents || []).forEach(se => add(se.people)) })
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [events, chapters])

  // Entities with contradictory connections (supported+opposed same pair, or causal cycle)
  const conflictedIds = useMemo(() => {
    const ids = new Set()
    for (let i = 0; i < connections.length; i++) {
      for (let j = i + 1; j < connections.length; j++) {
        const a = connections[i], b = connections[j]
        const samePair = (a.fromId === b.fromId && a.toId === b.toId) ||
                         (a.fromId === b.toId && a.toId === b.fromId)
        if (!samePair) continue
        const types = new Set([a.relationship, b.relationship])
        if (types.has('supported') && types.has('opposed')) {
          ids.add(a.fromId); ids.add(a.toId)
        }
      }
    }
    const causal = ['caused', 'led_to']
    const cc = connections.filter(c => causal.includes(c.relationship))
    for (const c1 of cc) {
      for (const c2 of cc) {
        if (c1.fromId === c2.toId && c1.toId === c2.fromId) {
          ids.add(c1.fromId); ids.add(c1.toId)
        }
      }
    }
    return ids
  }, [connections])

  // Smooth animated scroll
  function animateScrollTo(targetX, duration = 320) {
    if (scrollAnimRef.current) cancelAnimationFrame(scrollAnimRef.current)
    const startX = useStore.getState().scrollX
    const start = performance.now()
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      setScrollX(Math.max(0, startX + (targetX - startX) * ease))
      if (t < 1) scrollAnimRef.current = requestAnimationFrame(tick)
      else scrollAnimRef.current = null
    }
    scrollAnimRef.current = requestAnimationFrame(tick)
  }

  // Keep targetZoomRef in sync when zoom changes externally
  useEffect(() => {
    if (!zoomAnimRef.current) targetZoomRef.current = zoom
  }, [zoom])

  useEffect(() => {
    if (!jumpToYear || !canvasRef.current) return
    const x = yearToX(jumpToYear, zoom) + offsetX - canvasWidth / 3
    animateScrollTo(Math.max(0, x))
    clearJumpToYear()
  }, [jumpToYear])

  useEffect(() => {
    if (!jumpToSubEvent || !canvasRef.current) return
    const { chapterId, subEventId } = jumpToSubEvent
    const ch = chapters.find(c => c.id === chapterId)
    if (!ch) { clearJumpToSubEvent(); return }
    const year = new Date(ch.date).getFullYear()
    const x = yearToX(year, zoom) + offsetX - canvasWidth / 3
    animateScrollTo(Math.max(0, x))
    setSelectedChapter(ch)
    setOpenSubEventId(subEventId)
    clearJumpToSubEvent()
  }, [jumpToSubEvent])

  useEffect(() => {
    if (!highlightId) return
    const t = setTimeout(clearHighlightId, 2000)
    return () => clearTimeout(t)
  }, [highlightId])

  useEffect(() => {
    const handle = (e) => {
      if (e.key === 'Escape') {
        const { focusModeId: fmId, clearFocusMode: clearFm } = useStore.getState()
        if (fmId) { clearFm(); return }
        clearConnectingFrom()
        setConnectingTo(null)
        setChapterTargetChapter(null)
        setShowForm(null)
        setSelectedEntity(null)
        setSelectedChapter(null)
        setFocusedBlockIdx(-1)
        setEditingNoteId(null)
        setCanvasContextMenu(null)
        setSelectedArrowId(null)
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault(); undo()
        setFlashType('undo'); setTimeout(() => setFlashType(null), 460)
        return
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Z')) {
        e.preventDefault(); redo()
        setFlashType('redo'); setTimeout(() => setFlashType(null), 460)
        return
      }
      if (e.key === 'Tab' && navigableBlocks.length > 0) {
        e.preventDefault()
        setFocusedBlockIdx(prev => {
          if (e.shiftKey) return prev <= 0 ? navigableBlocks.length - 1 : prev - 1
          return prev >= navigableBlocks.length - 1 ? 0 : prev + 1
        })
        return
      }
      if (e.key === 'Enter' && focusedBlockIdx >= 0) {
        const b = navigableBlocks[focusedBlockIdx]
        if (!b) return
        if (b.type === 'chapter') setSelectedChapter(b.entity)
        else if (b.type === 'subEvent') { setSelectedChapter(chapters.find(c => c.id === b._chapterId)); setOpenSubEventId(b.id) }
        else setSelectedEntity({ entity: b.entity, type: 'event' })
        return
      }
      if (e.key === 'Delete') {
        if (selectedArrowId) {
          handleArrowDeleteIntent(selectedArrowId)
          return
        }
        if (focusedBlockIdx >= 0) {
          const b = navigableBlocks[focusedBlockIdx]
          if (!b || b.type === 'subEvent') return
          setConfirmDeleteCtx({ entity: b.entity, type: b.type })
        }
      }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [navigableBlocks, focusedBlockIdx, selectedArrowId, undo, redo, chapters])

  function handleMouseDown(e) {
    if (e.button !== 0) return
    if (scrollAnimRef.current) { cancelAnimationFrame(scrollAnimRef.current); scrollAnimRef.current = null }
    isDragging.current = true
    dragMoved.current = false
    lastX.current = e.clientX
  }
  function handleMouseMove(e) {
    if (draggingNote.current) {
      const { noteId, startX, startY, origYear, origYFrac } = draggingNote.current
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      const newYear = origYear + dx / (BASE_PX_PER_YEAR * zoom)
      const newYFrac = Math.min(Math.max(origYFrac + dy / canvasHeight, 0), 0.92)
      moveStickyNote(noteId, { year: newYear, yFrac: newYFrac })
      return
    }
    if (isDividerDragging.current) {
      const el = canvasRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const relY = e.clientY - rect.top - AXIS_HEIGHT
      setLaneResizeFrac(Math.min(Math.max(relY / (canvasHeight - AXIS_HEIGHT), 0.2), 0.8))
      return
    }
    if (!isDragging.current) return
    const dx = e.clientX - lastX.current
    if (Math.abs(dx) > 3) dragMoved.current = true
    lastX.current = e.clientX
    const maxScroll = Math.max(0, totalWidth - canvasWidth)
    setScrollX(Math.min(Math.max(scrollX - dx, 0), maxScroll))
  }
  function handleMouseUp() {
    if (draggingNote.current) {
      // Commit final position to undo history
      const { noteId } = draggingNote.current
      const note = stickyNotes.find(n => n.id === noteId)
      if (note) updateStickyNote(noteId, { year: note.year, yFrac: note.yFrac })
      draggingNote.current = null
    }
    isDragging.current = false
    isDividerDragging.current = false
  }

  function handleWheel(e) {
    e.preventDefault()
    if (e.ctrlKey || e.metaKey) {
      // Smooth zoom with easing toward target
      if (targetZoomRef.current === null) targetZoomRef.current = zoom
      const factor = e.deltaY > 0 ? 0.9 : 1.1
      targetZoomRef.current = Math.min(Math.max(targetZoomRef.current * factor, 0.2), 8)
      if (!zoomAnimRef.current) {
        const tick = () => {
          const cur = useStore.getState().zoom
          const diff = targetZoomRef.current - cur
          if (Math.abs(diff) < 0.002) {
            setZoom(targetZoomRef.current)
            zoomAnimRef.current = null
            return
          }
          setZoom(cur + diff * 0.22)
          zoomAnimRef.current = requestAnimationFrame(tick)
        }
        zoomAnimRef.current = requestAnimationFrame(tick)
      }
    } else {
      if (scrollAnimRef.current) { cancelAnimationFrame(scrollAnimRef.current); scrollAnimRef.current = null }
      const maxScroll = Math.max(0, totalWidth - canvasWidth)
      setScrollX(Math.min(Math.max(scrollX + e.deltaY * 1.5, 0), maxScroll))
    }
  }
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  })

  function screenXToDate(screenX) {
    const year = (screenX + scrollX - offsetX) / (BASE_PX_PER_YEAR * zoom)
    const clamped = Math.min(Math.max(year, TIMELINE_START), TIMELINE_END)
    const d = new Date(Math.floor(clamped), Math.round((clamped % 1) * 12), 1)
    return d.toISOString().split('T')[0]
  }

  function handleLaneDblClick(e, type) {
    if (connectingFrom || e.shiftKey) return
    setShowForm({ type, date: screenXToDate(e.clientX) })
  }

  function handleEntityClick(e, entity, type) {
    e.stopPropagation()
    if (dragMoved.current) return
    setSelectedArrowId(null)
    if (connectingFrom) {
      if (type === 'chapter') setChapterTargetChapter(entity)
      else setConnectingTo({ id: entity.id, type, title: entity.title, color: entity.color })
    } else {
      if (type === 'chapter') setSelectedChapter(entity)
      else setSelectedEntity({ entity, type })
    }
  }

  function handleConfirmConnection(relationship, notes) {
    if (!connectingFrom || !connectingTo) return
    addConnection({
      fromId: connectingFrom.id, fromType: connectingFrom.type,
      fromChapterId: connectingFrom.chapterId || null,
      toId: connectingTo.id, toType: connectingTo.type,
      relationship, notes,
    })
    clearConnectingFrom()
    setConnectingTo(null)
  }

  function toggleRel(id) {
    setHiddenRels(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleCat(id) {
    setHiddenCats(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleExpandChapter(id) {
    setExpandedChapters(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function togglePerson(name) {
    setHighlightedPeople(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n })
  }

  function xOnScreen(year) { return yearToX(year, zoom) + offsetX - scrollX }

  // Ticks
  const ticks = []
  for (let y = Math.floor(TIMELINE_START / major) * major; y <= TIMELINE_END; y += major) {
    ticks.push({ year: y, isMajor: true })
  }
  if (minor) {
    for (let y = TIMELINE_START; y <= TIMELINE_END; y += minor) {
      if (y % major !== 0) ticks.push({ year: y, isMajor: false })
    }
  }

  // Heatmap: event density per major tick bucket
  const heatmapBuckets = (() => {
    const map = {}
    events.forEach(e => {
      const ey = new Date(e.date).getFullYear()
      const b = Math.floor(ey / major) * major
      map[b] = (map[b] || 0) + 1
    })
    const maxCount = Math.max(1, ...Object.values(map))
    return Object.entries(map).map(([y, count]) => ({ year: parseInt(y), opacity: (count / maxCount) * 0.7 }))
  })()

  function saveEvent(form) {
    const shouldPromote = form.endDate && form.date &&
      (new Date(form.endDate) - new Date(form.date)) / (1000 * 60 * 60 * 24) > 30

    if (shouldPromote) {
      // Auto-promote to chapter
      if (showForm?.entity) {
        // If editing an event that now needs to become a chapter: delete event, create chapter
        deleteEvent(showForm.entity.id)
        if (selectedEntity?.entity?.id === showForm.entity.id) setSelectedEntity(null)
      }
      addChapter(form)
    } else if (showForm?.entity) {
      updateEvent(showForm.entity.id, form)
      if (selectedEntity?.entity?.id === showForm.entity.id)
        setSelectedEntity({ entity: { ...showForm.entity, ...form }, type: 'event' })
    } else {
      addEvent({ ...form, date: showForm?.date || form.date })
    }
    setShowForm(null)
  }
  function saveChapter(form) {
    if (showForm?.entity?.id) updateChapter(showForm.entity.id, form)
    else addChapter({ ...form, date: showForm?.date || form.date })
    setShowForm(null)
  }

  const relCounts = useMemo(() => {
    const counts = {}
    connections.forEach(c => { counts[c.relationship] = (counts[c.relationship] || 0) + 1 })
    return counts
  }, [connections])

  const usedCats = useMemo(() => {
    const catSet = new Set()
    events.forEach(e => { if (e.category) catSet.add(e.category) })
    chapters.forEach(c => { if (c.category) catSet.add(c.category) })
    return CATEGORIES.filter(cat => catSet.has(cat.id))
  }, [events, chapters])

  function handleCtxEdit() { setShowForm({ type: contextMenu.type, entity: contextMenu.entity }); setContextMenu(null) }
  function handleCtxOpen() { setSelectedChapter(contextMenu.entity); setContextMenu(null) }
  function handleCtxOpenTimeline() { setDrilldownChapterId(contextMenu.entity.id); setContextMenu(null) }
  function handleCtxConnect() {
    const { entity, type } = contextMenu
    setConnectingFrom({ id: entity.id, type, title: entity.title, color: entity.color, chapterId: entity.chapterId || null })
    setSelectedEntity(null); setSelectedChapter(null); setContextMenu(null)
  }
  function handleCtxDelete() { setConfirmDeleteCtx({ entity: contextMenu.entity, type: contextMenu.type }); setContextMenu(null) }
  function handleCtxExpandToggle() { toggleExpandChapter(contextMenu.entity.id); setContextMenu(null) }

  function handleSubEventTimelineClick(e, se, parentChapter) {
    e.stopPropagation()
    if (dragMoved.current) return
    if (connectingFrom) setConnectingTo({ id: se.id, type: 'subEvent', chapterId: parentChapter.id, title: se.title, color: se.color })
    else { setSelectedChapter(parentChapter); setOpenSubEventId(se.id) }
  }

  function handleArrowDeleteIntent(id) {
    setDeletingArrowIds(prev => new Set([...prev, id]))
    setSelectedArrowId(null)
    setTimeout(() => {
      deleteConnection(id)
      setDeletingArrowIds(prev => { const n = new Set(prev); n.delete(id); return n })
    }, 220)
  }

  function handleConfirmCtxDelete() {
    const { entity, type } = confirmDeleteCtx
    setDeletingIds(prev => new Set([...prev, entity.id]))
    setConfirmDeleteCtx(null)
    setTimeout(() => {
      if (type === 'event') {
        deleteEvent(entity.id)
        if (selectedEntity?.entity?.id === entity.id) setSelectedEntity(null)
      } else if (type === 'chapter') {
        deleteChapter(entity.id)
        if (selectedChapter?.id === entity.id) setSelectedChapter(null)
      } else if (type === 'subEvent') {
        deleteSubEvent(entity.chapterId, entity.id)
      }
      setDeletingIds(prev => { const n = new Set(prev); n.delete(entity.id); return n })
    }, 210)
  }

  function blockOpacity(entity) {
    if (focusModeId) {
      const ids = new Set([focusModeId])
      connections.forEach(c => {
        if (c.fromId === focusModeId) ids.add(c.toId)
        if (c.toId === focusModeId) ids.add(c.fromId)
      })
      if (!ids.has(entity.id)) return 0.15
    }
    const focusDimmed = activeEntityIds && !activeEntityIds.has(entity.id)
    const peopleDimmed = highlightedPeople.size > 0 && !(entity.people || []).some(p => highlightedPeople.has(p))
    return focusDimmed || peopleDimmed ? 0.25 : 1
  }

  const focusedEntityId = selectedChapter?.id ?? selectedEntity?.entity?.id ?? null
  const isConnecting = !!connectingFrom

  return (
    <div className="flex-1 flex flex-col overflow-hidden select-none" style={{ minHeight: 0 }}>

      {/* Connections filter bar */}
      {connections.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--bg-surface)] bg-[var(--bg-deep)] flex-shrink-0 flex-wrap">
          <span className="text-xs text-slate-600 uppercase tracking-wider mr-1">Connections:</span>
          {RELATIONSHIPS.filter(r => relCounts[r.id]).map(r => {
            const hidden = hiddenRels.has(r.id)
            return (
              <button key={r.id} onClick={() => toggleRel(r.id)}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all"
                style={{ background: hidden ? 'transparent' : r.color + '18', borderColor: hidden ? 'var(--border)' : r.color + '60', color: hidden ? 'var(--text-dim)' : r.color, opacity: hidden ? 0.5 : 1 }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: hidden ? 'var(--text-dim)' : r.color }} />
                {r.label}
                <span className="text-[10px] opacity-70">({relCounts[r.id]})</span>
              </button>
            )
          })}
          {hiddenRels.size > 0 && (
            <button onClick={() => setHiddenRels(new Set())} className="text-xs text-slate-500 hover:text-slate-300 ml-1 transition-colors">Show all</button>
          )}
        </div>
      )}

      {/* Category filter bar */}
      {usedCats.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--bg-surface)] bg-[var(--bg-deep)] flex-shrink-0 flex-wrap">
          <span className="text-xs text-slate-600 uppercase tracking-wider mr-1">Categories:</span>
          {usedCats.map(cat => {
            const hidden = hiddenCats.has(cat.id)
            return (
              <button key={cat.id} onClick={() => toggleCat(cat.id)}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all"
                style={{ background: hidden ? 'transparent' : cat.color + '18', borderColor: hidden ? 'var(--border)' : cat.color + '60', color: hidden ? 'var(--text-dim)' : cat.color, opacity: hidden ? 0.5 : 1 }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: hidden ? 'var(--text-dim)' : cat.color }} />
                {cat.short} {cat.label}
              </button>
            )
          })}
          {hiddenCats.size > 0 && (
            <button onClick={() => setHiddenCats(new Set())} className="text-xs text-slate-500 hover:text-slate-300 ml-1 transition-colors">Show all</button>
          )}
        </div>
      )}

      {/* Connect mode banner */}
      {isConnecting && (
        <div className="flex items-center justify-between px-4 py-2 bg-indigo-900/40 border-b border-indigo-500/30 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            <p className="text-sm text-indigo-300">
              Connecting from <span className="font-semibold" style={{ color: connectingFrom.color || '#818cf8' }}>{connectingFrom.title}</span>
              <span className="text-slate-400 ml-2">— click any entity to link it</span>
            </p>
          </div>
          <button onClick={() => { clearConnectingFrom(); setConnectingTo(null) }}
            className="text-xs text-slate-400 hover:text-white transition-colors px-2 py-1 rounded border border-[var(--border)] hover:border-slate-400">
            Cancel (Esc)
          </button>
        </div>
      )}

      {/* Focus mode banner */}
      {focusModeId && (
        <div className="flex items-center justify-between px-4 py-2 bg-violet-900/30 border-b border-violet-500/30 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
            <p className="text-sm text-violet-300">
              Focus: <span className="font-semibold text-white">
                {events.find(e => e.id === focusModeId)?.title
                  || chapters.find(c => c.id === focusModeId)?.title
                  || chapters.flatMap(c => c.subEvents || []).find(se => se.id === focusModeId)?.title
                  || '…'}
              </span>
              <span className="text-slate-400 ml-2">— showing only connected entities</span>
            </p>
          </div>
          <button
            onClick={clearFocusMode}
            className="text-xs text-slate-400 hover:text-white transition-colors px-2 py-1 rounded border border-[var(--border)] hover:border-slate-400"
          >
            Exit (Esc)
          </button>
        </div>
      )}

      {/* Canvas */}
      <div
        ref={canvasRef}
        className="flex-1 relative overflow-hidden"
        style={{ background: 'var(--bg-base)', cursor: isConnecting ? 'crosshair' : (isDragging.current ? 'grabbing' : 'grab') }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onContextMenu={(e) => {
          e.preventDefault()
          const rect = canvasRef.current?.getBoundingClientRect()
          setCanvasContextMenu({
            screenX: e.clientX,
            screenY: e.clientY,
            date: screenXToDate(e.clientX),
            year: (e.clientX + scrollX - offsetX) / (BASE_PX_PER_YEAR * zoom),
            yFrac: rect ? Math.max(0, Math.min((e.clientY - rect.top) / canvasHeight, 0.9)) : 0.5,
          })
        }}
        onClick={() => { setCanvasContextMenu(null); setSelectedArrowId(null) }}
        onDoubleClick={(e) => {
          if (!e.shiftKey) return
          const rect = canvasRef.current?.getBoundingClientRect()
          if (!rect) return
          const year = (e.clientX + scrollX - offsetX) / (BASE_PX_PER_YEAR * zoom)
          const yFrac = Math.max(0, Math.min((e.clientY - rect.top) / canvasHeight, 0.9))
          const color = NOTE_COLORS[stickyNotes.length % NOTE_COLORS.length]
          addStickyNote({ year, yFrac, text: '', color })
        }}
      >
        {/* SVG: grid + axis + heatmap + divider line */}
        <svg className="absolute top-0 left-0 pointer-events-none" width="100%" height={canvasHeight} style={{ zIndex: 1 }}>
          {ticks.filter(t => t.isMajor).map(({ year }) => {
            const x = xOnScreen(year)
            if (x < -10 || x > canvasWidth + 10) return null
            return <line key={year} x1={x} y1={AXIS_HEIGHT} x2={x} y2={canvasHeight} stroke="var(--bg-hover)" strokeWidth={1} />
          })}

          {/* Heatmap strip */}
          {events.length > 0 && heatmapBuckets.map(({ year, opacity }) => {
            const x1 = xOnScreen(year)
            const x2 = xOnScreen(year + major)
            if (x2 < 0 || x1 > canvasWidth) return null
            return (
              <rect key={year}
                x={Math.max(0, x1)} y={AXIS_HEIGHT - 7}
                width={Math.max(0, Math.min(canvasWidth, x2) - Math.max(0, x1))}
                height={7}
                fill="#f59e0b" fillOpacity={opacity} rx={1}
              />
            )
          })}

          <line x1={0} y1={AXIS_HEIGHT - 1} x2="100%" y2={AXIS_HEIGHT - 1} stroke="var(--border)" strokeWidth={1} />
          <line x1={0} y1={AXIS_HEIGHT + laneHeight} x2="100%" y2={AXIS_HEIGHT + laneHeight} stroke="var(--border)" strokeWidth={1} />

          {ticks.map(({ year, isMajor }) => {
            const x = xOnScreen(year)
            if (x < -60 || x > canvasWidth + 60) return null
            return (
              <g key={`${year}-${isMajor}`}>
                <line x1={x} y1={isMajor ? AXIS_HEIGHT - 12 : AXIS_HEIGHT - 6} x2={x} y2={AXIS_HEIGHT - 1}
                  stroke={isMajor ? 'var(--text-dim)' : 'var(--border)'} strokeWidth={isMajor ? 1.5 : 1} />
                {isMajor && (
                  <text x={x} y={AXIS_HEIGHT - 16} textAnchor="middle" fill="var(--text-dim)" fontSize={11} fontFamily="Inter, sans-serif">
                    {formatYear(year)}
                  </text>
                )}
              </g>
            )
          })}
        </svg>

        {/* Divider drag handle */}
        <div
          className="absolute left-0 right-0 zam-divider-handle"
          style={{ top: AXIS_HEIGHT + laneHeight - 3, height: 6, zIndex: 12 }}
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); isDividerDragging.current = true }}
        />

        {/* People index toggle button */}
        {allPeople.length > 0 && (
          <button
            onClick={() => { setShowPeopleIndex(v => !v); if (showPeopleIndex) setHighlightedPeople(new Set()) }}
            className="absolute top-2 right-2 z-20 flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-all"
            style={{
              background: showPeopleIndex ? '#6366f122' : 'var(--bg-surface)',
              borderColor: showPeopleIndex ? '#6366f1' : 'var(--border)',
              color: showPeopleIndex ? '#a5b4fc' : '#6b7280',
            }}
            title="People & actors index"
          >
            <UsersIcon className="w-3.5 h-3.5" />
            People
            {highlightedPeople.size > 0 && (
              <span className="bg-indigo-500 text-white rounded-full px-1 text-[9px] font-bold">{highlightedPeople.size}</span>
            )}
          </button>
        )}

        {/* Lane labels */}
        <div className="absolute top-0 left-0 right-0 pointer-events-none" style={{ zIndex: 10 }}>
          <div style={{ height: AXIS_HEIGHT }} />
          <div className="flex items-center px-3 text-xs font-semibold tracking-wider uppercase" style={{ height: LANE_HEADER, color: 'var(--border-mid)' }}>
            Chapters
          </div>
          <div style={{ height: laneHeight - LANE_HEADER }} />
          <div className="flex items-center px-3 text-xs font-semibold tracking-wider uppercase" style={{ height: LANE_HEADER, color: 'var(--border-mid)' }}>
            Events
          </div>
        </div>

        {/* Chapters lane dbl-click zone */}
        <div className="absolute left-0 right-0" style={{ top: AXIS_HEIGHT, height: laneHeight, zIndex: 2 }}
          onDoubleClick={(e) => handleLaneDblClick(e, 'chapter')} />

        {/* Chapter blocks */}
        {chapters.map((chapter) => {
          if (hiddenCats.size > 0 && chapter.category && hiddenCats.has(chapter.category)) return null
          const x1 = yearToX(new Date(chapter.date).getFullYear(), zoom) + offsetX - scrollX
          const x2 = yearToX(new Date(chapter.endDate || chapter.date).getFullYear(), zoom) + offsetX - scrollX
          const width = Math.max(x2 - x1, 24)
          if (x1 > canvasWidth || x2 < 0) return null
          const row = chapterRows[chapter.id] || 0
          const isHighlighted = highlightId === chapter.id
          const isConnectingSource = connectingFrom?.id === chapter.id
          const connCount = connections.filter(c => c.fromId === chapter.id || c.toId === chapter.id).length
          const cat = chapter.category ? CATEGORY_MAP[chapter.category] : null
          const isExpanded = expandedChapters.has(chapter.id)
          const hasSubEvents = (chapter.subEvents || []).length > 0
          const blockTop = AXIS_HEIGHT + LANE_HEADER + row * (BLOCK_H + BLOCK_GAP)
          const maxChapterRow = Object.values(chapterRows).length > 0 ? Math.max(...Object.values(chapterRows)) : -1
          const subEvtLaneTop = AXIS_HEIGHT + LANE_HEADER + (maxChapterRow + 1) * (BLOCK_H + BLOCK_GAP) + 6
          const connectorH = Math.max(0, subEvtLaneTop - blockTop - BLOCK_H)
          const isFocused = navigableBlocks[focusedBlockIdx]?.id === chapter.id
          const hasConflict = conflictedIds.has(chapter.id)
          return (
            <Fragment key={chapter.id}>
              {isExpanded && hasSubEvents && connectorH > 0 && (
                <div className="absolute pointer-events-none" style={{
                  left: x1, width, top: blockTop + BLOCK_H, height: connectorH,
                  background: `linear-gradient(to bottom, ${chapter.color || '#6366f1'}18, transparent)`,
                  borderLeft: `1.5px solid ${chapter.color || '#6366f1'}28`,
                  borderRight: `1.5px solid ${chapter.color || '#6366f1'}28`,
                  zIndex: 2,
                }} />
              )}
              <div
                onClick={(e) => handleEntityClick(e, chapter, 'chapter')}
                onDoubleClick={(e) => e.stopPropagation()}
                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ entity: chapter, type: 'chapter', x: e.clientX, y: e.clientY }) }}
                onMouseEnter={(e) => setHoveredChapter({ chapter, x: e.clientX, y: e.clientY })}
                onMouseMove={(e) => setHoveredChapter(h => h ? { ...h, x: e.clientX, y: e.clientY } : null)}
                onMouseLeave={() => setHoveredChapter(null)}
                className={`absolute flex items-center px-3 rounded-xl cursor-pointer transition-all zam-enter zam-block${deletingIds.has(chapter.id) ? ' zam-deleting' : ''}${isHighlighted ? ' zam-highlight-pulse' : ''}`}
                style={{
                  left: x1, width, height: BLOCK_H, top: blockTop,
                  background: (chapter.color || '#6366f1') + (isConnectingSource ? '44' : '22'),
                  border: `1.5px solid ${chapter.color || '#6366f1'}`,
                  borderBottom: isExpanded && hasSubEvents ? `2.5px solid ${chapter.color || '#6366f1'}` : `1.5px solid ${chapter.color || '#6366f1'}`,
                  boxShadow: isHighlighted || isConnectingSource
                    ? `0 0 0 2px white, 0 0 14px ${chapter.color || '#6366f1'}`
                    : isFocused ? `0 0 0 2px ${chapter.color || '#6366f1'}, 0 0 8px ${chapter.color || '#6366f1'}66`
                    : isConnecting ? `0 0 0 1.5px ${chapter.color || '#6366f1'}88` : 'none',
                  zIndex: 3,
                  filter: isConnecting && !isConnectingSource ? 'brightness(1.2)' : 'none',
                  opacity: deletingIds.has(chapter.id) ? undefined : blockOpacity(chapter),
                }}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold truncate" style={{ color: chapter.color || '#6366f1' }}>{chapter.title}</p>
                  {width > 100 && (
                    <p className="text-xs text-slate-500 truncate mt-0.5">{formatDate(chapter.date)} – {formatDate(chapter.endDate)}</p>
                  )}
                </div>
                {hasConflict && (
                  <span className="zam-breathe flex-shrink-0 ml-1 text-[9px] font-bold px-1 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40" title="Contradictory connections detected">⚠</span>
                )}
                {cat && (
                  <span className="flex-shrink-0 ml-1 text-[8px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: cat.color + '22', color: cat.color, border: `1px solid ${cat.color}50` }}>{cat.short}</span>
                )}
                {connCount > 0 && (
                  <span className="flex-shrink-0 ml-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: (chapter.color || '#6366f1') + '33', color: chapter.color || '#6366f1' }}>{connCount}</span>
                )}
                {hasSubEvents && (
                  <button onClick={(e) => { e.stopPropagation(); toggleExpandChapter(chapter.id) }}
                    className="flex-shrink-0 ml-1 p-0.5 rounded transition-colors hover:bg-white/10"
                    style={{ color: chapter.color || '#6366f1' }}
                    title={isExpanded ? 'Collapse sub-events' : 'Expand sub-events'}>
                    {isExpanded ? <ChevronUpIcon className="w-3.5 h-3.5" /> : <ChevronDownIcon className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            </Fragment>
          )
        })}

        {/* Events lane dbl-click zone */}
        <div className="absolute left-0 right-0" style={{ top: AXIS_HEIGHT + laneHeight, height: laneHeight, zIndex: 2 }}
          onDoubleClick={(e) => handleLaneDblClick(e, 'event')} />

        {/* Event blocks */}
        {events.map((event) => {
          if (hiddenCats.size > 0 && event.category && hiddenCats.has(event.category)) return null
          const x = yearToX(new Date(event.date).getFullYear(), zoom) + offsetX - scrollX
          const evBlockW = Math.max(BASE_PX_PER_YEAR * zoom * 0.8, 80, event.title.length * 7 + 32)
          if (x < -evBlockW || x > canvasWidth + evBlockW) return null
          const row = eventRows[event.id] || 0
          const blockTop = AXIS_HEIGHT + laneHeight + LANE_HEADER + row * (BLOCK_H + BLOCK_GAP)
          const isHighlighted = highlightId === event.id
          const isConnectingSource = connectingFrom?.id === event.id
          const connCount = connections.filter(c => c.fromId === event.id || c.toId === event.id).length
          const cat = event.category ? CATEGORY_MAP[event.category] : null
          const isFocused = navigableBlocks[focusedBlockIdx]?.id === event.id
          const hasConflict = conflictedIds.has(event.id)
          return (
            <div
              key={event.id}
              onClick={(e) => handleEntityClick(e, event, 'event')}
              onDoubleClick={(e) => e.stopPropagation()}
              onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ entity: event, type: 'event', x: e.clientX, y: e.clientY }) }}
              className={`absolute flex flex-col justify-center px-3 rounded-xl cursor-pointer transition-all zam-enter zam-block${deletingIds.has(event.id) ? ' zam-deleting' : ''}${isHighlighted ? ' zam-highlight-pulse' : ''}`}
              style={{
                left: x - evBlockW / 2, width: evBlockW,
                height: BLOCK_H, top: blockTop,
                background: (event.color || '#6366f1') + (isConnectingSource ? '44' : '22'),
                border: `1.5px solid ${event.color || '#6366f1'}`,
                borderTop: event.milestone ? `2.5px solid ${event.color || '#6366f1'}` : `1.5px solid ${event.color || '#6366f1'}`,
                boxShadow: isHighlighted || isConnectingSource
                  ? `0 0 0 2px white, 0 0 14px ${event.color || '#6366f1'}`
                  : isFocused ? `0 0 0 2px ${event.color || '#6366f1'}, 0 0 8px ${event.color || '#6366f1'}66`
                  : isConnecting ? `0 0 0 1.5px ${event.color || '#6366f1'}88` : 'none',
                zIndex: 3,
                filter: isConnecting && !isConnectingSource ? 'brightness(1.2)' : 'none',
                opacity: deletingIds.has(event.id) ? undefined : blockOpacity(event),
                overflow: 'visible',
              }}
            >
              {/* Milestone diamond marker above block */}
              {event.milestone && (
                <>
                  <div className="absolute pointer-events-none" style={{
                    top: -10, left: '50%', transform: 'translateX(-0.5px)',
                    width: 1, height: 10, background: event.color || '#6366f1', opacity: 0.8,
                  }} />
                  <div className="absolute pointer-events-none zam-breathe" style={{
                    top: -18, left: '50%', transform: 'translateX(-5px) rotate(45deg)',
                    width: 10, height: 10, background: event.color || '#6366f1',
                    borderRadius: 2, boxShadow: `0 0 6px ${event.color || '#6366f1'}`,
                  }} />
                </>
              )}
              <p className="text-xs font-semibold truncate" style={{ color: event.color || '#6366f1' }}>{event.title}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <p className="text-xs text-slate-500 truncate flex-1">
                  {event.endDate ? `${formatDate(event.date)} – ${formatDate(event.endDate)}` : formatDate(event.date)}
                </p>
                {hasConflict && (
                  <span className="zam-breathe flex-shrink-0 text-[9px] font-bold px-1 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40" title="Contradictory connections">⚠</span>
                )}
                {cat && (
                  <span className="flex-shrink-0 text-[8px] font-bold px-1 py-0.5 rounded-full" style={{ background: cat.color + '22', color: cat.color, border: `1px solid ${cat.color}50` }}>{cat.short}</span>
                )}
                {connCount > 0 && (
                  <span className="flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: (event.color || '#6366f1') + '33', color: event.color || '#6366f1' }}>{connCount}</span>
                )}
              </div>
            </div>
          )
        })}

        {/* Sub-event blocks (expanded chapters) */}
        {(() => {
          const maxChapterRow = Object.values(chapterRows).length > 0 ? Math.max(...Object.values(chapterRows)) : -1
          const subEventLaneTop = AXIS_HEIGHT + LANE_HEADER + (maxChapterRow + 1) * (BLOCK_H + BLOCK_GAP) + 6
          return chapters
            .filter(ch => expandedChapters.has(ch.id))
            .flatMap(chapter =>
              (chapter.subEvents || []).map((se, seIdx) => {
                const x = yearToX(new Date(se.date).getFullYear(), zoom) + offsetX - scrollX
                const seBlockW = Math.max(BASE_PX_PER_YEAR * zoom * 0.8, 80, se.title.length * 7 + 32)
                if (x < -seBlockW || x > canvasWidth + seBlockW) return null
                const row = subEventTimelineRows[se.id] ?? 0
                const top = subEventLaneTop + row * (SUBEVENT_BH + BLOCK_GAP)
                if (top + SUBEVENT_BH > AXIS_HEIGHT + laneHeight) return null
                const connCount = connections.filter(c => c.fromId === se.id || c.toId === se.id).length
                const isConnectingSource = connectingFrom?.id === se.id
                return (
                  <div key={se.id}
                    onClick={(e) => handleSubEventTimelineClick(e, se, chapter)}
                    onDoubleClick={(e) => e.stopPropagation()}
                    onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ entity: se, type: 'subEvent', x: e.clientX, y: e.clientY }) }}
                    className={`absolute flex flex-col justify-center px-2.5 rounded-xl cursor-pointer transition-all zam-enter${deletingIds.has(se.id) ? ' zam-deleting' : ''}`}
                    style={{
                      left: x - seBlockW / 2, width: seBlockW,
                      height: SUBEVENT_BH, top,
                      animationDelay: `${seIdx * 0.045}s`,
                      background: (chapter.color || '#6366f1') + (isConnectingSource ? '44' : '14'),
                      border: `1.5px solid ${chapter.color || '#6366f1'}55`,
                      borderLeft: `3px solid ${chapter.color || '#6366f1'}`,
                      boxShadow: isConnectingSource ? `0 0 0 2px white, 0 0 12px ${chapter.color || '#6366f1'}` : 'none',
                      zIndex: 3,
                      filter: isConnecting && !isConnectingSource ? 'brightness(1.2)' : 'none',
                      opacity: deletingIds.has(se.id) ? undefined : blockOpacity(se),
                    }}
                  >
                    <p className="text-[11px] font-medium truncate" style={{ color: chapter.color || '#6366f1' }}>{se.title}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <p className="text-[10px] text-slate-500 truncate flex-1">{formatDate(se.date)}</p>
                      {connCount > 0 && (
                        <span className="flex-shrink-0 text-[8px] font-bold px-1 py-0.5 rounded-full" style={{ background: (chapter.color || '#6366f1') + '33', color: chapter.color || '#6366f1' }}>{connCount}</span>
                      )}
                    </div>
                  </div>
                )
              }).filter(Boolean)
            )
        })()}

        {/* Connection arrows */}
        <ConnectionArrows
          laneHeight={laneHeight}
          canvasHeight={canvasHeight}
          eventRows={eventRows}
          chapterRows={chapterRows}
          hiddenRels={hiddenRels}
          hiddenCats={hiddenCats}
          expandedChapters={expandedChapters}
          subEventTimelineRows={subEventTimelineRows}
          focusedEntityId={focusedEntityId}
          blockH={BLOCK_H}
          selectedArrowId={selectedArrowId}
          onSelectArrow={setSelectedArrowId}
          deletingArrowIds={deletingArrowIds}
          onArrowDeleteIntent={handleArrowDeleteIntent}
        />

        {/* Sticky notes */}
        {stickyNotes.filter(n => !n.chapterId).map(note => {
          const noteX = yearToX(note.year, zoom) + offsetX - scrollX
          const noteY = note.yFrac * canvasHeight
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

        {/* Canvas right-click context menu */}
        {canvasContextMenu && !isConnecting && (
          <div
            className="fixed z-[150] bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden py-1 zam-menu-pop"
            style={{
              left: Math.min(canvasContextMenu.screenX, window.innerWidth - 200),
              top: Math.min(canvasContextMenu.screenY, window.innerHeight - 150),
              minWidth: 190,
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => { setShowForm({ type: 'event', date: canvasContextMenu.date }); setCanvasContextMenu(null) }}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--bg-elevated)] transition-colors text-left"
            >
              <PlusIcon className="w-4 h-4 text-indigo-400 flex-shrink-0" />
              <span className="text-sm text-slate-200">New Event</span>
            </button>
            <button
              onClick={() => { setShowForm({ type: 'chapter', date: canvasContextMenu.date }); setCanvasContextMenu(null) }}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--bg-elevated)] transition-colors text-left"
            >
              <PlusIcon className="w-4 h-4 text-purple-400 flex-shrink-0" />
              <span className="text-sm text-slate-200">New Chapter</span>
            </button>
            <div className="border-t border-[var(--border)] mx-3 my-1" />
            <button
              onClick={() => {
                const color = NOTE_COLORS[stickyNotes.length % NOTE_COLORS.length]
                addStickyNote({ year: canvasContextMenu.year, yFrac: canvasContextMenu.yFrac, text: '', color })
                setCanvasContextMenu(null)
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--bg-elevated)] transition-colors text-left"
            >
              <DocumentTextIcon className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span className="text-sm text-slate-200">Add Sticky Note</span>
            </button>
          </div>
        )}

        {/* Today line */}
        {(() => {
          const x = xOnScreen(new Date().getFullYear())
          if (x < 0 || x > canvasWidth) return null
          return <div className="absolute pointer-events-none zam-today-pulse" style={{ left: x, top: AXIS_HEIGHT, width: 1, height: laneHeight * 2, background: '#f43f5e', zIndex: 4 }} />
        })()}

        {/* Undo / redo flash */}
        {flashType && (
          <div
            className="absolute inset-0 pointer-events-none zam-undo-flash"
            style={{ background: flashType === 'undo' ? '#f59e0b' : '#6366f1', zIndex: 50 }}
          />
        )}

        {/* Jump to today */}
        {(() => {
          const todayX = xOnScreen(new Date().getFullYear())
          if (todayX >= -20 && todayX <= canvasWidth + 20) return null
          const isLeft = todayX < 0
          return (
            <button
              onClick={() => {
                const target = yearToX(new Date().getFullYear(), zoom) + offsetX - canvasWidth / 2
                animateScrollTo(Math.max(0, target))
              }}
              className="absolute bottom-10 zam-enter flex items-center gap-1.5 text-xs bg-[var(--bg-surface)]/90 hover:bg-[var(--bg-elevated)] border border-[var(--border)] text-slate-400 hover:text-white px-3 py-1.5 rounded-full transition-colors shadow-lg"
              style={{ [isLeft ? 'left' : 'right']: 16, zIndex: 20 }}
            >
              {isLeft ? '← Today' : 'Today →'}
            </button>
          )
        })()}

        {/* Chapter hover tooltip */}
        {hoveredChapter && !isConnecting && hoveredChapter.chapter.id !== selectedChapter?.id && (
          <div
            className="fixed pointer-events-none z-[200] bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl shadow-2xl p-3"
            style={{ left: Math.min(hoveredChapter.x + 14, window.innerWidth - 236), top: hoveredChapter.y - 12, width: 220 }}
          >
            <p className="text-sm font-semibold leading-snug" style={{ color: hoveredChapter.chapter.color || '#6366f1' }}>
              {hoveredChapter.chapter.title}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {formatDate(hoveredChapter.chapter.date)}
              {hoveredChapter.chapter.endDate ? ` – ${formatDate(hoveredChapter.chapter.endDate)}` : ''}
            </p>
            {hoveredChapter.chapter.category && CATEGORY_MAP[hoveredChapter.chapter.category] && (() => {
              const cat = CATEGORY_MAP[hoveredChapter.chapter.category]
              return (
                <span className="inline-block mt-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: cat.color + '22', color: cat.color, border: `1px solid ${cat.color}50` }}>
                  {cat.short} {cat.label}
                </span>
              )
            })()}
            {hoveredChapter.chapter.description && (
              <p className="text-[11px] text-slate-400 mt-2 pt-2 border-t border-[var(--border)] line-clamp-3 leading-relaxed">
                {hoveredChapter.chapter.description}
              </p>
            )}
          </div>
        )}

        {/* People index sidebar */}
        {showPeopleIndex && (
          <div className="absolute right-0 top-0 bottom-0 w-56 bg-[var(--bg-base)]/95 border-l border-[var(--border)] z-20 flex flex-col zam-slide-right" style={{ backdropFilter: 'blur(8px)' }}>
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--border)] flex-shrink-0">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">People & Actors</span>
              <button onClick={() => { setShowPeopleIndex(false); setHighlightedPeople(new Set()) }} className="text-slate-500 hover:text-white text-xl leading-none transition-colors">×</button>
            </div>
            {highlightedPeople.size > 0 && (
              <button onClick={() => setHighlightedPeople(new Set())} className="text-xs text-indigo-400 hover:text-indigo-300 px-3 py-2 text-left border-b border-[var(--border)] transition-colors flex-shrink-0">
                Clear filter ({highlightedPeople.size} selected)
              </button>
            )}
            <div className="overflow-y-auto flex-1">
              {allPeople.length === 0 ? (
                <p className="text-xs text-slate-600 px-3 py-4">No people added to any entity yet.</p>
              ) : (
                allPeople.map(([name, count]) => {
                  const active = highlightedPeople.has(name)
                  return (
                    <button
                      key={name}
                      onClick={() => togglePerson(name)}
                      className="w-full flex items-center justify-between px-3 py-2 hover:bg-[var(--bg-surface)] transition-colors text-left"
                      style={{ background: active ? '#6366f115' : 'transparent' }}
                    >
                      <span className="text-xs truncate flex-1" style={{ color: active ? '#a5b4fc' : '#cbd5e1' }}>{name}</span>
                      <span className="text-[10px] text-slate-500 flex-shrink-0 ml-2 bg-[var(--bg-surface)] px-1.5 py-0.5 rounded">{count}</span>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>

      <MiniMap containerWidth={canvasWidth} />

      <div className="flex items-center justify-center gap-6 py-1.5 text-xs text-slate-600 border-t border-[var(--bg-surface)] flex-shrink-0">
        <span>Double-click lane to create · Shift+double-click for sticky note</span>
        <span>·</span>
        <span>Tab to navigate · Enter to open · Del to remove</span>
      </div>

      {showForm?.type === 'event' && (
        <EntityForm type="event" initial={showForm.entity || { date: showForm.date }} onSave={saveEvent} onClose={() => setShowForm(null)} />
      )}
      {showForm?.type === 'chapter' && (
        <EntityForm type="chapter" initial={showForm.entity || { date: showForm.date }} onSave={saveChapter} onClose={() => setShowForm(null)} />
      )}
      {showForm?.type === 'subEvent' && showForm.entity && (
        <EntityForm
          type="subEvent"
          initial={showForm.entity}
          onSave={(form) => { updateSubEvent(showForm.entity.chapterId, showForm.entity.id, form); setShowForm(null) }}
          onClose={() => setShowForm(null)}
        />
      )}

      {selectedEntity && !selectedChapter && !isConnecting && (
        <DetailPanel
          entity={selectedEntity.entity} type={selectedEntity.type}
          onClose={() => setSelectedEntity(null)}
          onEdit={() => setShowForm({ type: selectedEntity.type, entity: selectedEntity.entity })}
          onDelete={() => {
            const id = selectedEntity.entity.id
            setDeletingIds(prev => new Set([...prev, id]))
            setSelectedEntity(null)
            setTimeout(() => {
              deleteEvent(id)
              setDeletingIds(prev => { const n = new Set(prev); n.delete(id); return n })
            }, 210)
          }}
        />
      )}

      {selectedChapter && !isConnecting && (
        <ChapterModal
          chapter={chapters.find(c => c.id === selectedChapter.id) || selectedChapter}
          initialSubEventId={openSubEventId}
          onClose={() => { setSelectedChapter(null); setOpenSubEventId(null) }}
          onOpenTimeline={() => { setDrilldownChapterId(selectedChapter.id); setSelectedChapter(null); setOpenSubEventId(null) }}
        />
      )}

      {drilldownChapterId && (
        <DrilldownTimeline
          chapterId={drilldownChapterId}
          onClose={() => setDrilldownChapterId(null)}
        />
      )}

      {chapterTargetChapter && (
        <ChapterTargetPicker
          chapter={chapterTargetChapter}
          onSelectChapter={() => { setConnectingTo({ id: chapterTargetChapter.id, type: 'chapter', title: chapterTargetChapter.title, color: chapterTargetChapter.color }); setChapterTargetChapter(null) }}
          onSelectSubEvent={(se) => { setConnectingTo({ id: se.id, type: 'subEvent', chapterId: chapterTargetChapter.id, title: se.title, color: se.color }); setChapterTargetChapter(null) }}
          onCancel={() => setChapterTargetChapter(null)}
        />
      )}

      {connectingFrom && connectingTo && (
        <RelationshipPicker
          from={connectingFrom} to={connectingTo}
          onConfirm={handleConfirmConnection}
          onCancel={() => { clearConnectingFrom(); setConnectingTo(null) }}
        />
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x} y={contextMenu.y}
          entity={contextMenu.entity} type={contextMenu.type}
          isExpanded={expandedChapters.has(contextMenu.entity.id)}
          onEdit={handleCtxEdit} onOpen={handleCtxOpen} onOpenTimeline={handleCtxOpenTimeline}
          onConnect={handleCtxConnect} onDelete={handleCtxDelete}
          onExpandToggle={handleCtxExpandToggle}
          onClose={() => setContextMenu(null)}
        />
      )}

      {confirmDeleteCtx && (
        <ConfirmDialog
          message={`Delete "${confirmDeleteCtx.entity.title}"?`}
          onConfirm={handleConfirmCtxDelete}
          onCancel={() => setConfirmDeleteCtx(null)}
        />
      )}
    </div>
  )
}
