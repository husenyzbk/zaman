import { useState, useRef } from 'react'
import { XMarkIcon, UserCircleIcon, TrashIcon } from '@heroicons/react/24/outline'
import useStore from '../store/useStore'
import ConfirmDialog from './ConfirmDialog'

const MAX_PHOTO_BYTES = 10 * 1024 * 1024 // 10MB

export default function PersonProfileModal({ person, onClose }) {
  const { addPerson, updatePerson, deletePerson } = useStore()
  const [name, setName] = useState(person?.name || '')
  const [bio, setBio] = useState(person?.bio || '')
  const [photo, setPhoto] = useState(person?.photo || null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const fileRef = useRef(null)

  async function handlePhotoSelect(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > MAX_PHOTO_BYTES) {
      alert('File too large. Maximum size is 10MB.')
      e.target.value = ''
      return
    }
    const dataUrl = await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (ev) => resolve(ev.target.result)
      reader.readAsDataURL(file)
    })
    setPhoto(dataUrl)
    e.target.value = ''
  }

  function handleSave() {
    const trimmed = name.trim()
    if (!trimmed) return
    if (person) {
      updatePerson(person.id, { name: trimmed, bio, photo })
    } else {
      const id = addPerson(trimmed)
      if (bio || photo) updatePerson(id, { bio, photo })
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="zam-glass-strong zam-glass-edge zam-elevated rounded-2xl w-full max-w-sm flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-white">{person ? 'Person Profile' : 'New Person'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4 flex-1">
          {/* Photo */}
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={() => fileRef.current?.click()}
              className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-[var(--border)] hover:border-indigo-500 transition-colors group"
            >
              {photo ? (
                <img src={photo} alt={name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-[var(--bg-base)]">
                  <UserCircleIcon className="w-16 h-16 text-slate-600" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                <span className="text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity">Change</span>
              </div>
            </button>
            <input ref={fileRef} type="file" accept=".png,.jpg,.jpeg,.webp,.gif" className="hidden" onChange={handlePhotoSelect} />
            {photo && (
              <button onClick={() => setPhoto(null)} className="text-xs text-slate-500 hover:text-red-400 transition-colors">
                Remove photo
              </button>
            )}
          </div>

          {/* Name */}
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">Name</label>
            <input
              className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter name..."
              autoFocus={!person}
            />
          </div>

          {/* Bio */}
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">Bio / Notes</label>
            <textarea
              className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors resize-y"
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Who is this person..."
            />
          </div>

          {person && (
            <button
              onClick={() => setConfirmOpen(true)}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-400 transition-colors"
            >
              <TrashIcon className="w-3.5 h-3.5" />
              Delete profile
            </button>
          )}
        </div>

        <div className="flex gap-3 p-5 border-t border-[var(--border)]">
          <button onClick={onClose} className="flex-1 bg-[var(--bg-base)] hover:bg-[var(--bg-surface)] border border-[var(--border)] text-slate-300 rounded-lg py-2 text-sm transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="zam-lift flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg py-2 text-sm font-medium transition-colors"
          >
            Save
          </button>
        </div>
      </div>

      {person && confirmOpen && (
        <ConfirmDialog
          message={`Delete profile for "${person.name}"? They'll remain tagged on existing entities, but their photo and bio will be lost.`}
          onConfirm={() => { deletePerson(person.id); onClose() }}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </div>
  )
}
