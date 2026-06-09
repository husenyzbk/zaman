import { XMarkIcon } from '@heroicons/react/24/outline'
import { formatDate } from '../utils/format'

export default function ChapterTargetPicker({ chapter, onSelectChapter, onSelectSubEvent, onCancel }) {
  const subEvents = (chapter.subEvents || [])
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date))

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
          <div>
            <h2 className="text-base font-semibold text-white">Connect to…</h2>
            <p className="text-xs text-slate-400 mt-0.5 truncate">inside "{chapter.title}"</p>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-white transition-colors">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
          {/* The chapter itself */}
          <button
            onClick={onSelectChapter}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--border)] hover:border-indigo-500/40 hover:bg-[var(--bg-hover)] text-left transition-all"
          >
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: chapter.color || '#6366f1' }} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{chapter.title}</p>
              <p className="text-xs text-slate-500">The chapter itself</p>
            </div>
          </button>

          {subEvents.length > 0 && (
            <>
              <p className="text-xs text-slate-500 uppercase tracking-wider px-1 pt-1">Or a sub-event:</p>
              {subEvents.map(se => (
                <button
                  key={se.id}
                  onClick={() => onSelectSubEvent(se)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--border)] hover:border-indigo-500/40 hover:bg-[var(--bg-hover)] text-left transition-all"
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: se.color || '#6366f1' }} />
                  <div className="min-w-0">
                    <p className="text-sm text-slate-200 truncate">{se.title}</p>
                    <p className="text-xs text-slate-500">{formatDate(se.date)}</p>
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
