import { useEffect } from 'react'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'

export default function ConfirmDialog({ message, onConfirm, onCancel }) {
  useEffect(() => {
    const handle = (e) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [onCancel])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="zam-glass-strong zam-glass-edge zam-elevated rounded-2xl p-6 w-full max-w-sm">
        <div className="flex items-start gap-4 mb-5">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <p className="text-white font-medium mb-1">Are you sure?</p>
            <p className="text-sm text-slate-400">{message} This cannot be undone.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 bg-[var(--bg-base)] hover:bg-[var(--bg-surface)] border border-[var(--border)] text-slate-300 rounded-lg py-2 text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="zam-lift flex-1 bg-red-600 hover:bg-red-500 text-white rounded-lg py-2 text-sm font-medium transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
