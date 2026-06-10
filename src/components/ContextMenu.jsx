import { useEffect, useRef } from 'react'
import { PencilIcon, TrashIcon, ArrowsRightLeftIcon, FolderOpenIcon, ChevronDownIcon, ChevronUpIcon, MapIcon } from '@heroicons/react/24/outline'

export default function ContextMenu({ x, y, entity, type, isExpanded, onEdit, onOpen, onOpenTimeline, onConnect, onDelete, onExpandToggle, onClose }) {
  const ref = useRef(null)

  useEffect(() => {
    function handleDown(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleDown)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleDown)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  const hasSubEvents = type === 'chapter' && (entity.subEvents?.length ?? 0) > 0
  const menuW = 196
  const itemCount = 2 + (type === 'chapter' ? 2 : 0) + (hasSubEvents ? 1 : 0) + 1
  const menuH = 52 + itemCount * 36
  const px = Math.min(x + 2, window.innerWidth - menuW - 8)
  const py = Math.min(y + 2, window.innerHeight - menuH - 8)

  return (
    <div
      ref={ref}
      className="fixed z-[100] zam-glass zam-glass-edge zam-elevated-sm rounded-xl py-1 overflow-hidden zam-menu-pop"
      style={{ left: px, top: py, width: menuW }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="px-3 py-2.5 border-b border-[var(--border)]">
        <p className="text-xs font-semibold text-white truncate">{entity.title}</p>
        <p className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">
          {type === 'chapter' ? 'Chapter' : type === 'subEvent' ? 'Sub-event' : 'Event'}
        </p>
      </div>
      <div className="py-1">
        <Item icon={<PencilIcon className="w-3.5 h-3.5" />} label="Edit" onClick={onEdit} />
        {type === 'chapter' && (
          <Item icon={<FolderOpenIcon className="w-3.5 h-3.5" />} label="Open Details" onClick={onOpen} />
        )}
        {type === 'chapter' && (
          <Item icon={<MapIcon className="w-3.5 h-3.5" />} label="Open Timeline" onClick={onOpenTimeline} accent />
        )}
        {hasSubEvents && (
          <Item
            icon={isExpanded ? <ChevronUpIcon className="w-3.5 h-3.5" /> : <ChevronDownIcon className="w-3.5 h-3.5" />}
            label={isExpanded ? 'Collapse sub-events' : 'Expand sub-events'}
            onClick={onExpandToggle}
            accent
          />
        )}
        <Item icon={<ArrowsRightLeftIcon className="w-3.5 h-3.5" />} label="Add Connection" onClick={onConnect} />
        <Item icon={<TrashIcon className="w-3.5 h-3.5" />} label="Delete" onClick={onDelete} danger />
      </div>
    </div>
  )
}

function Item({ icon, label, onClick, danger, accent }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-[var(--bg-base)] text-left ${
        danger ? 'text-red-400 hover:text-red-300'
        : accent ? 'text-indigo-400 hover:text-indigo-300'
        : 'text-slate-300 hover:text-white'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}
