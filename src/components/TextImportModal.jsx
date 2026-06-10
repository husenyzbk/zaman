import { useState } from 'react'
import { XMarkIcon, MagnifyingGlassIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import useStore from '../store/useStore'

const MONTHS = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7,
  sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
}
const MONTH_NAMES = Object.keys(MONTHS).filter(k => k.length > 3)

function toISO(year, month = 0, day = 1) {
  return new Date(year, month, day).toISOString().split('T')[0]
}

function parseText(raw) {
  const text = raw.replace(/\s+/g, ' ')
  const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
  const results = []
  const seen = new Set()

  for (const sentence of sentences) {
    if (sentence.trim().length < 12) continue

    // Pattern 1: "Month Day, Year" — "August 23, 1942"
    const p1 = new RegExp(
      `\\b(${MONTH_NAMES.join('|')})\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`,
      'gi'
    )
    let m
    while ((m = p1.exec(sentence)) !== null) {
      const mo = MONTHS[m[1].toLowerCase()]
      const day = parseInt(m[2]), year = parseInt(m[3])
      if (year < 1000 || year > 2200) continue
      const date = toISO(year, mo, day)
      if (seen.has(date + sentence.slice(0, 30))) continue
      seen.add(date + sentence.slice(0, 30))
      results.push({ id: crypto.randomUUID(), date, title: '', description: sentence.trim(), selected: true })
    }

    // Pattern 2: "Day Month Year" — "23 August 1942"
    const p2 = new RegExp(
      `\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_NAMES.join('|')})\\s+(\\d{4})\\b`,
      'gi'
    )
    while ((m = p2.exec(sentence)) !== null) {
      const day = parseInt(m[1])
      const mo = MONTHS[m[2].toLowerCase()]
      const year = parseInt(m[3])
      if (year < 1000 || year > 2200) continue
      const date = toISO(year, mo, day)
      if (seen.has(date + sentence.slice(0, 30))) continue
      seen.add(date + sentence.slice(0, 30))
      results.push({ id: crypto.randomUUID(), date, title: '', description: sentence.trim(), selected: true })
    }

    // Pattern 3: "Month Year" — "August 1942"
    const p3 = new RegExp(
      `\\b(${MONTH_NAMES.join('|')})\\s+(\\d{4})\\b`,
      'gi'
    )
    while ((m = p3.exec(sentence)) !== null) {
      const mo = MONTHS[m[1].toLowerCase()]
      const year = parseInt(m[2])
      if (year < 1000 || year > 2200) continue
      const date = toISO(year, mo, 1)
      if (seen.has(date + sentence.slice(0, 30))) continue
      seen.add(date + sentence.slice(0, 30))
      results.push({ id: crypto.randomUUID(), date, title: '', description: sentence.trim(), selected: true })
    }

    // Pattern 4: "in/by/during/around YEAR" — "in 1942"
    const p4 = /\b(?:in|by|on|during|around|from|since|until|after|before)\s+((?:1[0-9]|20)\d{2})\b/gi
    while ((m = p4.exec(sentence)) !== null) {
      const year = parseInt(m[1])
      const date = toISO(year, 0, 1)
      if (seen.has(date + sentence.slice(0, 30))) continue
      seen.add(date + sentence.slice(0, 30))
      results.push({ id: crypto.randomUUID(), date, title: '', description: sentence.trim(), selected: true })
    }
  }

  // Deduplicate: keep only first occurrence per sentence+date, sort by date
  return results.sort((a, b) => a.date.localeCompare(b.date))
    .map(r => ({
      ...r,
      // Auto-suggest title: first 60 chars of sentence (trimmed)
      title: r.description.length > 60 ? r.description.slice(0, 57).trimEnd() + '…' : r.description,
    }))
}

export default function TextImportModal({ onClose }) {
  const { addEvent } = useStore()
  const [step, setStep] = useState(1)
  const [text, setText] = useState('')
  const [proposals, setProposals] = useState([])

  function handleParse() {
    const found = parseText(text)
    if (found.length === 0) {
      alert('No dates found in the text. Try pasting text that contains explicit dates like "August 1942" or "September 1, 1939".')
      return
    }
    setProposals(found)
    setStep(2)
  }

  function updateProposal(id, field, value) {
    setProposals(p => p.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  function removeProposal(id) {
    setProposals(p => p.filter(r => r.id !== id))
  }

  function toggleProposal(id) {
    setProposals(p => p.map(r => r.id === id ? { ...r, selected: !r.selected } : r))
  }

  function handleImport() {
    const toAdd = proposals.filter(r => r.selected && r.title.trim())
    toAdd.forEach(r => {
      addEvent({
        title: r.title.trim(),
        date: r.date,
        description: r.description,
        color: '#6366f1',
        people: [],
        references: [],
        links: [],
        opinion: '',
        category: '',
        milestone: false,
      })
    })
    onClose()
  }

  const selectedCount = proposals.filter(r => r.selected).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="zam-glass-strong zam-glass-edge zam-elevated rounded-2xl w-full max-w-2xl max-h-[88vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h2 className="text-lg font-semibold text-white">Import from Text</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {step === 1 ? 'Paste any text containing dates — Wikipedia articles, notes, book excerpts…' : `Found ${proposals.length} date${proposals.length !== 1 ? 's' : ''} — review and edit before importing`}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 px-5 py-2.5 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          {['Paste text', 'Review & edit', 'Done'].map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              {i > 0 && <div className="w-8 h-px" style={{ background: 'var(--border)' }} />}
              <div className="flex items-center gap-1.5">
                <span
                  className="w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0"
                  style={{
                    background: step > i + 1 ? '#6366f1' : step === i + 1 ? '#6366f122' : 'transparent',
                    border: `1.5px solid ${step >= i + 1 ? '#6366f1' : 'var(--border)'}`,
                    color: step >= i + 1 ? '#818cf8' : 'var(--text-dim)',
                  }}
                >
                  {i + 1}
                </span>
                <span className="text-xs" style={{ color: step === i + 1 ? '#a5b4fc' : 'var(--text-dim)' }}>{label}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {step === 1 && (
            <textarea
              className="w-full h-72 rounded-xl px-4 py-3 text-sm text-white resize-none focus:outline-none focus:border-indigo-500 transition-colors leading-relaxed"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
              placeholder={`Paste any text here. For example:\n\nThe Battle of Stalingrad began on August 23, 1942, when Germany attacked. By February 2, 1943, German forces surrendered. This was a major turning point of World War II.\n\nThe parser will detect dates like "August 23, 1942", "23 August 1942", "August 1942", and "in 1942".`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoFocus
            />
          )}

          {step === 2 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {selectedCount} of {proposals.length} selected
                </span>
                <div className="flex gap-2">
                  <button onClick={() => setProposals(p => p.map(r => ({ ...r, selected: true })))} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">Select all</button>
                  <button onClick={() => setProposals(p => p.map(r => ({ ...r, selected: false })))} className="text-xs transition-colors" style={{ color: 'var(--text-muted)' }}>Deselect all</button>
                </div>
              </div>

              {proposals.map(r => (
                <div
                  key={r.id}
                  className="rounded-xl p-3 border transition-all"
                  style={{
                    background: r.selected ? 'var(--bg-surface)' : 'transparent',
                    borderColor: r.selected ? '#6366f150' : 'var(--border)',
                    opacity: r.selected ? 1 : 0.5,
                  }}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={r.selected}
                      onChange={() => toggleProposal(r.id)}
                      className="mt-1 flex-shrink-0 accent-indigo-500"
                    />
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          value={r.date}
                          onChange={(e) => updateProposal(r.id, 'date', e.target.value)}
                          className="text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-indigo-500 transition-colors flex-shrink-0"
                          style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-main)' }}
                        />
                        <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
                          {new Date(r.date + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: r.date.endsWith('-01-01') ? undefined : 'numeric' })}
                        </span>
                      </div>
                      <input
                        className="w-full text-sm text-white rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500 transition-colors"
                        style={{ background: 'var(--bg-base)', border: '1px solid var(--border)' }}
                        value={r.title}
                        onChange={(e) => updateProposal(r.id, 'title', e.target.value)}
                        placeholder="Event title (required to import)"
                      />
                      <p className="text-xs leading-relaxed line-clamp-2" style={{ color: 'var(--text-muted)' }}>
                        {r.description}
                      </p>
                    </div>
                    <button onClick={() => removeProposal(r.id)} className="text-slate-600 hover:text-red-400 transition-colors flex-shrink-0 p-0.5">
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-5 border-t flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          {step === 1 ? (
            <>
              <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm transition-colors border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-body)' }}>
                Cancel
              </button>
              <button
                onClick={handleParse}
                disabled={!text.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
              >
                <MagnifyingGlassIcon className="w-4 h-4" />
                Find dates
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setStep(1)} className="px-4 py-2 rounded-lg text-sm transition-colors border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-body)' }}>
                ← Back
              </button>
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
                  {selectedCount} event{selectedCount !== 1 ? 's' : ''} will be added
                </span>
                <button
                  onClick={handleImport}
                  disabled={selectedCount === 0 || proposals.filter(r => r.selected && !r.title.trim()).length > 0}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
                >
                  <PlusIcon className="w-4 h-4" />
                  Add to timeline
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
