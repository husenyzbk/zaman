import { useEffect } from 'react'
import { XMarkIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline'

export default function MediaLightbox({ item, onClose }) {
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  if (!item) return null
  const { dataUrl, name, type } = item
  const isImage = type?.startsWith('image/')
  const isPdf = type === 'application/pdf' || name?.toLowerCase().endsWith('.pdf')

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-4 sm:p-8" onClick={onClose}>
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        <a
          href={dataUrl}
          download={name}
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white bg-white/10 hover:bg-white/20 transition-colors rounded-lg px-3 py-1.5"
        >
          <ArrowDownTrayIcon className="w-4 h-4" />
          Download
        </a>
        <button
          onClick={onClose}
          className="text-slate-300 hover:text-white bg-white/10 hover:bg-white/20 transition-colors rounded-lg p-1.5"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>

      {isImage ? (
        <img
          src={dataUrl}
          alt={name}
          className="max-w-full max-h-full object-contain rounded-lg"
          onClick={(e) => e.stopPropagation()}
        />
      ) : isPdf ? (
        <div className="w-full h-full bg-white rounded-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
          <iframe src={dataUrl} title={name} className="w-full h-full border-0" />
        </div>
      ) : (
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-8 text-center" onClick={(e) => e.stopPropagation()}>
          <p className="text-slate-300 text-sm mb-3">Preview not available for this file type.</p>
          <a href={dataUrl} download={name} className="text-indigo-400 hover:text-indigo-300 text-sm underline">
            Download "{name}"
          </a>
        </div>
      )}

      {name && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-slate-400 bg-black/40 px-3 py-1 rounded-full max-w-[90%] truncate">
          {name}
        </div>
      )}
    </div>
  )
}
