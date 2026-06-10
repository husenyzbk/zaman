import { useState, useMemo, useRef, useEffect } from 'react'
import { XMarkIcon, PlusIcon, UserCircleIcon } from '@heroicons/react/24/outline'
import useStore from '../store/useStore'

export default function PersonPicker({ people, onChange }) {
  const { peopleDb, addPerson } = useStore()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase()
    return peopleDb
      .filter((p) => !(people || []).includes(p.name))
      .filter((p) => !q || p.name.toLowerCase().includes(q))
      .slice(0, 8)
  }, [peopleDb, people, query])

  const exactMatch = peopleDb.some((p) => p.name.toLowerCase() === query.trim().toLowerCase())

  function addName(name) {
    const trimmed = name.trim()
    if (!trimmed || (people || []).includes(trimmed)) return
    addPerson(trimmed)
    onChange([...(people || []), trimmed])
    setQuery('')
    setOpen(false)
  }

  function removeName(name) {
    onChange((people || []).filter((p) => p !== name))
  }

  function personPhoto(name) {
    return peopleDb.find((p) => p.name === name)?.photo
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex gap-2 mb-2">
        <input
          className="flex-1 bg-[var(--bg-base)] border border-[var(--border)] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Search or add a person..."
          onKeyDown={(e) => e.key === 'Enter' && addName(query)}
        />
        <button
          onClick={() => addName(query)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-3 transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
        </button>
      </div>

      {open && (suggestions.length > 0 || (query.trim() && !exactMatch)) && (
        <div className="absolute z-20 left-0 right-0 mt-[-6px] zam-glass zam-glass-edge zam-elevated-sm rounded-lg overflow-hidden max-h-48 overflow-y-auto">
          {suggestions.map((p) => (
            <button
              key={p.id}
              onClick={() => addName(p.name)}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--bg-elevated)] transition-colors text-left"
            >
              {p.photo ? (
                <img src={p.photo} alt={p.name} className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
              ) : (
                <UserCircleIcon className="w-5 h-5 text-slate-600 flex-shrink-0" />
              )}
              <span className="text-sm text-slate-200 truncate">{p.name}</span>
            </button>
          ))}
          {query.trim() && !exactMatch && (
            <button
              onClick={() => addName(query)}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--bg-elevated)] transition-colors text-left border-t border-[var(--border)]"
            >
              <PlusIcon className="w-4 h-4 text-indigo-400 flex-shrink-0" />
              <span className="text-sm text-indigo-400">Add "{query.trim()}"</span>
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {(people || []).map((name) => {
          const photo = personPhoto(name)
          return (
            <span key={name} className="flex items-center gap-1.5 bg-[var(--border)] text-slate-200 text-xs pl-1 pr-2 py-1 rounded-full">
              {photo ? (
                <img src={photo} alt={name} className="w-4 h-4 rounded-full object-cover" />
              ) : (
                <UserCircleIcon className="w-4 h-4 text-slate-400" />
              )}
              {name}
              <button onClick={() => removeName(name)} className="text-slate-400 hover:text-red-400">
                <XMarkIcon className="w-3 h-3" />
              </button>
            </span>
          )
        })}
      </div>
    </div>
  )
}
