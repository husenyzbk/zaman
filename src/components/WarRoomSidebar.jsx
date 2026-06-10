import { useState } from 'react'
import { XMarkIcon, PlusIcon, PencilIcon, TrashIcon, CheckIcon } from '@heroicons/react/24/outline'
import useStore from '../store/useStore'

export default function WarRoomSidebar({ isOpen, onClose }) {
  const {
    warRooms, activeWarRoomId,
    switchWarRoom, addWarRoom, updateWarRoom, deleteWarRoom,
    events, chapters,
  } = useStore()

  const [isCreating, setIsCreating] = useState(false)
  const [creatingName, setCreatingName] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editingName, setEditingName] = useState('')

  function handleCreate() {
    const name = creatingName.trim()
    if (!name) { setIsCreating(false); return }
    addWarRoom(name)
    setCreatingName('')
    setIsCreating(false)
  }

  function handleRename(id) {
    const name = editingName.trim()
    if (name) updateWarRoom(id, { name })
    setEditingId(null)
  }

  function countItems(room) {
    if (room.id === activeWarRoomId) {
      return events.length + chapters.length
    }
    return (room.events?.length || 0) + (room.chapters?.length || 0)
  }

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      <div
        className="fixed left-0 top-0 bottom-0 w-56 zam-glass-strong border-r border-[var(--border)] z-50 flex flex-col zam-elevated"
        style={{
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.2s ease',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] flex-shrink-0">
          <span className="text-sm font-semibold text-white tracking-tight">War Rooms</span>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-0.5">
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Room list */}
        <div className="flex-1 overflow-y-auto py-2 space-y-0.5">
          {warRooms.map((room) => {
            const isActive = room.id === activeWarRoomId
            const count = countItems(room)

            if (editingId === room.id) {
              return (
                <div key={room.id} className="px-2 py-1">
                  <div className="flex items-center gap-1">
                    <input
                      autoFocus
                      className="flex-1 bg-[var(--bg-surface)] border border-indigo-500 rounded-lg px-2.5 py-1.5 text-white text-sm outline-none"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename(room.id)
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      onBlur={() => handleRename(room.id)}
                    />
                    <button
                      onClick={() => handleRename(room.id)}
                      className="text-indigo-400 hover:text-indigo-300 p-1 flex-shrink-0"
                    >
                      <CheckIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            }

            return (
              <div
                key={room.id}
                onClick={() => { if (!isActive) { switchWarRoom(room.id); onClose() } }}
                className={`group flex items-center gap-2.5 px-3 py-2.5 mx-1.5 rounded-xl cursor-pointer transition-all ${
                  isActive
                    ? 'bg-indigo-600/15 border border-indigo-500/30'
                    : 'hover:bg-[var(--bg-surface)] border border-transparent'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: room.color || '#6366f1' }}
                />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm truncate ${isActive ? 'text-white font-medium' : 'text-slate-300'}`}>
                    {room.name}
                  </p>
                  <p className="text-[10px] text-slate-600">{count} item{count !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditingId(room.id)
                      setEditingName(room.name)
                    }}
                    className="text-slate-600 hover:text-slate-300 p-0.5 transition-colors"
                    title="Rename"
                  >
                    <PencilIcon className="w-3 h-3" />
                  </button>
                  {warRooms.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (window.confirm(`Delete "${room.name}"? All data in this room will be lost.`)) {
                          deleteWarRoom(room.id)
                        }
                      }}
                      className="text-slate-600 hover:text-red-400 p-0.5 transition-colors"
                      title="Delete"
                    >
                      <TrashIcon className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Create new room */}
        <div className="border-t border-[var(--border)] p-3 flex-shrink-0">
          {isCreating ? (
            <div className="flex items-center gap-1.5">
              <input
                autoFocus
                className="flex-1 bg-[var(--bg-surface)] border border-indigo-500 rounded-lg px-2.5 py-1.5 text-white text-sm outline-none placeholder-slate-600"
                placeholder="Room name..."
                value={creatingName}
                onChange={(e) => setCreatingName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate()
                  if (e.key === 'Escape') { setIsCreating(false); setCreatingName('') }
                }}
                onBlur={() => { if (!creatingName.trim()) { setIsCreating(false); setCreatingName('') } }}
              />
              <button
                onClick={handleCreate}
                className="text-indigo-400 hover:text-indigo-300 p-1 flex-shrink-0"
              >
                <CheckIcon className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsCreating(true)}
              className="w-full flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-white bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border border-[var(--border)] hover:border-[#3e4268] rounded-xl py-2 transition-all"
            >
              <PlusIcon className="w-4 h-4" />
              New War Room
            </button>
          )}
        </div>
      </div>
    </>
  )
}
