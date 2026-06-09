import { useState } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { RELATIONSHIPS } from '../utils/connections'

export default function RelationshipPicker({ from, to, onConfirm, onCancel }) {
  const [selected, setSelected] = useState(null)
  const [notes, setNotes] = useState('')

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
          <div>
            <h2 className="text-base font-semibold text-white">Set Relationship</h2>
            <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">
              <span style={{ color: from.color || '#6366f1' }}>{from.title}</span>
              <span className="text-slate-500 mx-1.5">→</span>
              <span style={{ color: to.color || '#6366f1' }}>{to.title}</span>
            </p>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-white transition-colors">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Relationship grid */}
        <div className="p-5 space-y-3">
          <p className="text-xs text-slate-500 uppercase tracking-wider">
            How does <span style={{ color: from.color || '#6366f1' }}>{from.title}</span> relate to <span style={{ color: to.color || '#6366f1' }}>{to.title}</span>?
          </p>
          <div className="grid grid-cols-2 gap-2">
            {RELATIONSHIPS.map(r => (
              <button
                key={r.id}
                onClick={() => setSelected(r.id)}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all text-left"
                style={{
                  background: selected === r.id ? r.color + '22' : 'var(--bg-base)',
                  borderColor: selected === r.id ? r.color : 'var(--border)',
                }}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: r.color }} />
                <span className="text-sm font-medium" style={{ color: selected === r.id ? r.color : '#94a3b8' }}>
                  {r.label}
                </span>
              </button>
            ))}
          </div>

          {/* Optional notes */}
          <div className="pt-1">
            <label className="text-xs text-slate-500 uppercase tracking-wider mb-1 block">Notes (optional)</label>
            <input
              className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add context about this connection..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 pb-5">
          <button onClick={onCancel} className="flex-1 bg-[var(--bg-base)] hover:bg-[var(--bg-surface)] border border-[var(--border)] text-slate-300 rounded-lg py-2 text-sm transition-colors">
            Cancel
          </button>
          <button
            onClick={() => selected && onConfirm(selected, notes)}
            disabled={!selected}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg py-2 text-sm font-medium transition-colors"
          >
            Create Connection
          </button>
        </div>
      </div>
    </div>
  )
}
