import { useState, useRef } from 'react'
import { XMarkIcon, ArrowUpTrayIcon, CheckIcon } from '@heroicons/react/24/outline'
import useStore from '../store/useStore'
import { CATEGORY_MAP } from '../utils/categories'

const REQUIRED_COLS = ['date', 'title']
const OPTIONAL_COLS = ['enddate', 'description', 'opinion', 'category', 'people', 'color']
const ALL_COLS = [...REQUIRED_COLS, ...OPTIONAL_COLS]

function parseCsvLine(line) {
  const cols = []
  let cur = '', inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') { inQ = !inQ }
    else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = '' }
    else { cur += ch }
  }
  cols.push(cur.trim())
  return cols
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return { headers: [], rows: [] }

  const firstLine = parseCsvLine(lines[0])
  const lowerFirst = firstLine.map(h => h.toLowerCase().replace(/\s+/g, ''))
  const isHeader = lowerFirst.some(h => ALL_COLS.includes(h))

  let headers, dataLines
  if (isHeader) {
    headers = lowerFirst
    dataLines = lines.slice(1)
  } else {
    // Auto-assign columns: date, title, description, ...
    headers = ['date', 'title', 'description', 'opinion', 'category', 'people']
    dataLines = lines
  }

  const rows = dataLines.map(line => {
    const cols = parseCsvLine(line)
    const row = {}
    headers.forEach((h, i) => { if (cols[i] !== undefined) row[h] = cols[i] })
    return row
  })

  return { headers, rows }
}

function rowToEvent(row) {
  if (!row.date || !row.title) return null
  const dateVal = row.date.trim()
  if (!dateVal.match(/^\d{4}(-\d{2}(-\d{2})?)?$/)) return null

  // Normalize date to YYYY-MM-DD
  const dateParts = dateVal.split('-')
  const normalized = [
    dateParts[0],
    dateParts[1] || '01',
    dateParts[2] || '01',
  ].join('-')

  const people = row.people
    ? row.people.split(/[;|]/).map(p => p.trim()).filter(Boolean)
    : []

  // Resolve category by label or id
  const catInput = (row.category || '').trim().toLowerCase()
  const category = catInput
    ? Object.values(CATEGORY_MAP).find(c =>
        c.label.toLowerCase() === catInput || c.id?.toLowerCase() === catInput
      )?.id || ''
    : ''

  return {
    title: row.title.trim(),
    date: normalized,
    endDate: row.enddate?.trim() || '',
    description: (row.description || '').trim(),
    opinion: (row.opinion || '').trim(),
    category,
    people,
    color: row.color?.trim() || '#6366f1',
    references: [],
    links: [],
    milestone: false,
  }
}

export default function CsvImportModal({ onClose }) {
  const { addEvent } = useStore()
  const fileRef = useRef(null)
  const [rawText, setRawText] = useState('')
  const [parsed, setParsed] = useState(null) // { valid: [], invalid: [] }
  const [imported, setImported] = useState(false)

  function handleText(text) {
    setRawText(text)
    setImported(false)
    if (!text.trim()) { setParsed(null); return }
    const { rows } = parseCsv(text)
    const valid = [], invalid = []
    rows.forEach((row, i) => {
      const ev = rowToEvent(row)
      if (ev) valid.push(ev)
      else invalid.push({ row, idx: i + 1 })
    })
    setParsed({ valid, invalid })
  }

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => handleText(ev.target.result)
    reader.readAsText(file)
    e.target.value = ''
  }

  function handleImport() {
    if (!parsed?.valid.length) return
    parsed.valid.forEach(ev => addEvent(ev))
    setImported(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl w-full max-w-2xl max-h-[88vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
          <div>
            <h2 className="text-lg font-semibold text-white">Import from CSV</h2>
            <p className="text-xs text-slate-500 mt-0.5">Required columns: <span className="text-slate-400">date, title</span> · Optional: enddate, description, opinion, category, people (semicolon-separated), color</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* File or paste */}
          <div className="flex gap-3">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 text-sm bg-[var(--bg-base)] hover:bg-[var(--bg-elevated)] border border-[var(--border)] text-slate-300 px-4 py-2 rounded-lg transition-colors"
            >
              <ArrowUpTrayIcon className="w-4 h-4" /> Pick CSV file
            </button>
            <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />
            <span className="text-slate-600 text-sm self-center">or paste below</span>
          </div>

          <textarea
            className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-indigo-500 transition-colors resize-none"
            rows={6}
            placeholder={'date,title,description,people\n1939-09-01,Invasion of Poland,,Adolf Hitler;Neville Chamberlain\n1941-12-07,Pearl Harbor Attack'}
            value={rawText}
            onChange={(e) => handleText(e.target.value)}
          />

          {/* Preview */}
          {parsed && (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-sm text-green-400 font-medium">{parsed.valid.length} valid row{parsed.valid.length !== 1 ? 's' : ''}</span>
                {parsed.invalid.length > 0 && (
                  <span className="text-sm text-red-400">{parsed.invalid.length} skipped (missing date or title)</span>
                )}
              </div>

              {parsed.valid.length > 0 && (
                <div className="border border-[var(--border)] rounded-xl overflow-hidden">
                  <div className="overflow-x-auto max-h-56">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-[var(--bg-base)] border-b border-[var(--border)]">
                          <th className="text-left px-3 py-2 text-slate-500 font-medium">Date</th>
                          <th className="text-left px-3 py-2 text-slate-500 font-medium">Title</th>
                          <th className="text-left px-3 py-2 text-slate-500 font-medium">Description</th>
                          <th className="text-left px-3 py-2 text-slate-500 font-medium">People</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsed.valid.slice(0, 20).map((ev, i) => (
                          <tr key={i} className="border-b border-[var(--bg-surface)] hover:bg-[var(--bg-base)]/50">
                            <td className="px-3 py-2 text-slate-400 whitespace-nowrap">{ev.date}</td>
                            <td className="px-3 py-2 text-white max-w-[160px] truncate">{ev.title}</td>
                            <td className="px-3 py-2 text-slate-500 max-w-[200px] truncate">{ev.description || '—'}</td>
                            <td className="px-3 py-2 text-slate-500 max-w-[120px] truncate">{ev.people.join(', ') || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {parsed.valid.length > 20 && (
                    <p className="text-xs text-slate-600 px-3 py-2 border-t border-[var(--border)]">… and {parsed.valid.length - 20} more</p>
                  )}
                </div>
              )}

              {imported && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-green-500/10 border border-green-500/30 mt-3">
                  <CheckIcon className="w-4 h-4 text-green-400 flex-shrink-0" />
                  <p className="text-sm text-green-400">{parsed.valid.length} event{parsed.valid.length !== 1 ? 's' : ''} imported successfully.</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3 p-5 border-t border-[var(--border)]">
          <button onClick={onClose} className="flex-1 bg-[var(--bg-base)] hover:bg-[var(--bg-surface)] border border-[var(--border)] text-slate-300 rounded-lg py-2 text-sm transition-colors">
            {imported ? 'Close' : 'Cancel'}
          </button>
          <button
            onClick={handleImport}
            disabled={!parsed?.valid.length || imported}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg py-2 text-sm font-medium transition-colors"
          >
            {imported ? `Imported ${parsed.valid.length}` : `Import ${parsed?.valid.length || 0} Event${parsed?.valid.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
