import { useState, useMemo, useRef, useEffect } from 'react'
import {
  MagnifyingGlassMinusIcon, MagnifyingGlassPlusIcon, PlusIcon,
  MagnifyingGlassIcon, ArrowUturnLeftIcon, ArrowUturnRightIcon,
  ArrowDownTrayIcon, ArrowUpTrayIcon, TableCellsIcon,
  Squares2X2Icon, EyeIcon, EyeSlashIcon,
} from '@heroicons/react/24/outline'
import useStore from '../store/useStore'
import { formatDate } from '../utils/format'
import { CATEGORY_MAP } from '../utils/categories'
import CsvImportModal from './CsvImportModal'

const DENSITY_OPTIONS = [
  { value: 'compact',     label: 'S', title: 'Compact' },
  { value: 'default',     label: 'M', title: 'Default' },
  { value: 'comfortable', label: 'L', title: 'Comfortable' },
]

function matches(entity, q) {
  return (
    entity.title?.toLowerCase().includes(q) ||
    entity.description?.toLowerCase().includes(q) ||
    entity.opinion?.toLowerCase().includes(q) ||
    entity.people?.some((p) => p.toLowerCase().includes(q)) ||
    entity.references?.some((r) => r.toLowerCase().includes(q)) ||
    (entity.category && CATEGORY_MAP[entity.category]?.label.toLowerCase().includes(q))
  )
}

const TYPE_LABEL = { event: 'Event', chapter: 'Chapter', subEvent: 'Sub-event' }
const TYPE_COLOR = { event: '#6366f1', chapter: '#8b5cf6', subEvent: '#14b8a6' }

export default function Header({ onNewEvent, onNewChapter, onToggleWarRooms, onOpenTextImport, activeWarRoomName, activeWarRoomColor }) {
  const {
    zoom, setZoom,
    scrollX, setScrollX,
    events, chapters,
    setJumpToYear, setHighlightId, setJumpToSubEvent,
    density, setDensity,
    past, future, undo, redo,
    showConnections, toggleConnections,
    theme, toggleTheme,
    view, setView,
  } = useStore()

  function zoomCentered(factor) {
    const newZoom = Math.min(Math.max(zoom * factor, 0.2), 8)
    const anchorX = window.innerWidth / 2
    const newScrollX = Math.max(0, (scrollX + anchorX) * (newZoom / zoom) - anchorX)
    setZoom(newZoom)
    setScrollX(newScrollX)
  }

  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const [showCsvImport, setShowCsvImport] = useState(false)
  const [shakingUndo, setShakingUndo] = useState(false)
  const inputRef = useRef(null)
  const importRef = useRef(null)

  useEffect(() => {
    function handle(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && past.length === 0) {
        setShakingUndo(true)
        setTimeout(() => setShakingUndo(false), 450)
      }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [past])

  function handleExport() {
    const { events, chapters, connections, stickyNotes } = useStore.getState()
    const data = JSON.stringify({ version: 1, events, chapters, connections, stickyNotes }, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `zaman-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImportFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result)
        if (!Array.isArray(data.events)) throw new Error()
        useStore.setState({
          events: data.events || [],
          chapters: data.chapters || [],
          connections: data.connections || [],
          stickyNotes: data.stickyNotes || [],
          past: [], future: [],
        })
      } catch {
        alert('Invalid Zaman file — make sure you\'re importing a .json file exported from Zaman.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const results = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    const res = []
    events.forEach((e) => {
      if (matches(e, q)) res.push({ ...e, _type: 'event' })
    })
    chapters.forEach((c) => {
      if (matches(c, q)) res.push({ ...c, _type: 'chapter' })
      c.subEvents?.forEach((se) => {
        if (matches(se, q)) res.push({ ...se, _type: 'subEvent', _chapterTitle: c.title, _chapterId: c.id })
      })
    })
    return res.slice(0, 10)
  }, [query, events, chapters])

  function handleSelect(result) {
    if (result._type === 'subEvent') {
      setJumpToSubEvent({ chapterId: result._chapterId, subEventId: result.id })
    } else {
      const year = new Date(result.date).getFullYear()
      setJumpToYear(year)
      setHighlightId(result.id)
    }
    setQuery('')
    setFocused(false)
    inputRef.current?.blur()
  }

  // Match snippet — which field matched?
  function getSnippet(result, q) {
    const low = q.toLowerCase()
    if (result.description?.toLowerCase().includes(low)) return 'in description'
    if (result.opinion?.toLowerCase().includes(low)) return 'in opinion'
    if (result.people?.some(p => p.toLowerCase().includes(low))) return 'person match'
    if (result.references?.some(r => r.toLowerCase().includes(low))) return 'in references'
    if (result.category && CATEGORY_MAP[result.category]?.label.toLowerCase().includes(low)) return CATEGORY_MAP[result.category].label
    if (result._chapterTitle) return `in ${result._chapterTitle}`
    return null
  }

  const showDropdown = focused && query.trim().length > 0

  return (
    <>
    <header className="flex items-center justify-between px-5 py-3 border-b border-[var(--bg-surface)] bg-[var(--bg-base)] z-30 flex-shrink-0 gap-4">
      {/* Logo + War Rooms */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <button
          onClick={onToggleWarRooms}
          className="flex items-center gap-2 hover:bg-[var(--bg-surface)] rounded-lg px-2 py-1.5 transition-colors group"
          title="War Rooms"
        >
          <span className="text-xl font-bold tracking-tight text-white">
            Z<span className="text-indigo-400">a</span>man
          </span>
          {activeWarRoomName && (
            <span className="flex items-center gap-1.5 text-xs text-slate-500 group-hover:text-slate-300 transition-colors">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: activeWarRoomColor || '#6366f1' }} />
              {activeWarRoomName}
            </span>
          )}
          <Squares2X2Icon className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
        </button>
      </div>

      {/* Search */}
      <div className="flex-1 max-w-sm relative">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            ref={inputRef}
            className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg pl-9 pr-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            placeholder="Search titles, descriptions, people…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
          />
        </div>

      {showDropdown && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl shadow-2xl z-50 overflow-hidden">
            {results.length === 0 ? (
              <p className="text-sm text-slate-500 px-4 py-3">No results for "{query}"</p>
            ) : (
              results.map((r) => {
                const snippet = getSnippet(r, query)
                return (
                  <button
                    key={`${r._type}-${r.id}`}
                    onClick={() => handleSelect(r)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--bg-elevated)] transition-colors text-left"
                  >
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0"
                      style={{ background: (r.color || TYPE_COLOR[r._type]) + '22', color: r.color || TYPE_COLOR[r._type] }}
                    >
                      {TYPE_LABEL[r._type]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{r.title}</p>
                      {snippet && (
                        <p className="text-xs text-slate-500 truncate">{snippet}</p>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 flex-shrink-0">{formatDate(r.date)}</span>
                  </button>
                )
              })
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 flex-shrink-0">

        {/* View toggle: Timeline / Graph */}
        <div className="flex items-center gap-0 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg overflow-hidden">
          {[{ v: 'timeline', label: 'Timeline' }, { v: 'graph', label: 'Graph' }].map(opt => (
            <button
              key={opt.v}
              onClick={() => setView(opt.v)}
              className="px-3 py-1.5 text-xs font-semibold transition-colors"
              style={{
                background: view === opt.v ? '#6366f122' : 'transparent',
                color: view === opt.v ? '#818cf8' : '#6b7280',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Connections toggle */}
        <button
          onClick={toggleConnections}
          title={showConnections ? 'Hide connections' : 'Show connections'}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-all"
          style={{
            background: showConnections ? '#6366f122' : 'transparent',
            borderColor: showConnections ? '#6366f155' : 'var(--border)',
            color: showConnections ? '#818cf8' : '#6b7280',
          }}
        >
          {showConnections ? <EyeIcon className="w-4 h-4" /> : <EyeSlashIcon className="w-4 h-4" />}
          <span>Connections</span>
        </button>

        {/* Export / Import */}
        <div className="flex items-center gap-0.5 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-1">
          <button onClick={handleExport} className="text-slate-400 hover:text-white p-1.5 transition-colors" title="Export timeline as JSON">
            <ArrowDownTrayIcon className="w-4 h-4" />
          </button>
          <button onClick={() => importRef.current?.click()} className="text-slate-400 hover:text-white p-1.5 transition-colors" title="Import timeline from JSON">
            <ArrowUpTrayIcon className="w-4 h-4" />
          </button>
          <button onClick={() => setShowCsvImport(true)} className="text-slate-400 hover:text-white p-1.5 transition-colors" title="Import events from CSV">
            <TableCellsIcon className="w-4 h-4" />
          </button>
          <button onClick={onOpenTextImport} className="text-slate-400 hover:text-white p-1.5 transition-colors" title="Import events from pasted text">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>
          <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="p-1.5 rounded-lg border transition-all"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'var(--bg-surface)' }}
        >
          {theme === 'dark' ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 7a5 5 0 100 10A5 5 0 0012 7z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>

        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-1">
          <button
            onClick={undo}
            disabled={past.length === 0}
            className={`text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed p-1.5 transition-colors${shakingUndo ? ' zam-shake' : ''}`}
            title="Undo (Ctrl+Z)"
          >
            <ArrowUturnLeftIcon className="w-4 h-4" />
          </button>
          <button
            onClick={redo}
            disabled={future.length === 0}
            className="text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed p-1.5 transition-colors"
            title="Redo (Ctrl+Y)"
          >
            <ArrowUturnRightIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Density toggle */}
        <div className="flex items-center gap-0 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg overflow-hidden">
          {DENSITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDensity(opt.value)}
              title={opt.title}
              className="px-2.5 py-1.5 text-xs font-semibold transition-colors"
              style={{
                background: density === opt.value ? '#6366f122' : 'transparent',
                color: density === opt.value ? '#818cf8' : '#6b7280',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-1 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-1">
          <button onClick={() => zoomCentered(1 / 1.3)} className="text-slate-400 hover:text-white p-1.5 transition-colors" title="Zoom out">
            <MagnifyingGlassMinusIcon className="w-4 h-4" />
          </button>
          <span className="text-xs text-slate-500 w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => zoomCentered(1.3)} className="text-slate-400 hover:text-white p-1.5 transition-colors" title="Zoom in">
            <MagnifyingGlassPlusIcon className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={onNewChapter}
          className="flex items-center gap-1.5 text-sm bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border border-[var(--border)] text-slate-300 px-3 py-1.5 rounded-lg transition-colors"
        >
          <PlusIcon className="w-4 h-4" /> Chapter
        </button>
        <button
          onClick={onNewEvent}
          className="flex items-center gap-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition-colors"
        >
          <PlusIcon className="w-4 h-4" /> Event
        </button>
      </div>
    </header>

    {showCsvImport && <CsvImportModal onClose={() => setShowCsvImport(false)} />}
    </>
  )
}
