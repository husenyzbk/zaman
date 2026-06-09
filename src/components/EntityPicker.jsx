import { useState, useMemo } from 'react'
import { XMarkIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import useStore from '../store/useStore'
import { formatDate } from '../utils/format'

export default function EntityPicker({ excludeId, onSelect, onCancel }) {
  const { events, chapters } = useStore()
  const [query, setQuery] = useState('')

  const all = useMemo(() => {
    const evts = events.map(e => ({ ...e, _type: 'event' }))
    const chaps = chapters.map(c => ({ ...c, _type: 'chapter' }))
    return [...evts, ...chaps].filter(e => e.id !== excludeId)
  }, [events, chapters, excludeId])

  const filtered = useMemo(() => {
    if (!query.trim()) return all
    const q = query.toLowerCase()
    return all.filter(e => e.title?.toLowerCase().includes(q) || e.description?.toLowerCase().includes(q))
  }, [all, query])

  const TYPE_COLOR = { event: '#6366f1', chapter: '#8b5cf6' }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[70vh]">
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)] flex-shrink-0">
          <h2 className="text-base font-semibold text-white">Select Target Entity</h2>
          <button onClick={onCancel} className="text-slate-400 hover:text-white">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 border-b border-[var(--border)] flex-shrink-0">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            <input
              autoFocus
              className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="Search events and chapters..."
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          {filtered.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">No results found.</p>
          ) : (
            filtered.map(entity => (
              <button
                key={entity.id}
                onClick={() => onSelect({ id: entity.id, type: entity._type, title: entity.title, color: entity.color })}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-elevated)] transition-colors text-left border-b border-[var(--bg-hover)] last:border-0"
              >
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0"
                  style={{ background: (entity.color || TYPE_COLOR[entity._type]) + '22', color: entity.color || TYPE_COLOR[entity._type] }}
                >
                  {entity._type === 'event' ? 'Event' : 'Chapter'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{entity.title}</p>
                </div>
                <span className="text-xs text-slate-500 flex-shrink-0">{formatDate(entity.date)}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
