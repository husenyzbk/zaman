import { useState, useMemo, useRef } from 'react'
import { XMarkIcon, PlusIcon, TrashIcon, PaperClipIcon, DocumentIcon, PhotoIcon } from '@heroicons/react/24/outline'
import { CATEGORIES } from '../utils/categories'
import RichTextEditor from './RichTextEditor'
import PersonPicker from './PersonPicker'

const EMPTY_FORM = {
  title: '',
  date: '',
  endDate: '',
  description: '',
  opinion: '',
  customBoxes: [],
  people: [],
  references: [],
  links: [],
  images: [],
  documents: [],
  color: '#6366f1',
  category: '',
  milestone: false,
}

const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#06b6d4',
]

const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10MB

function normalizeRef(r) {
  return typeof r === 'string' ? { text: r } : r
}

export default function EntityForm({ type, initial, onSave, onClose, minDate, maxDate }) {
  const [form, setForm] = useState({ ...EMPTY_FORM, ...initial })
  const [dateError, setDateError] = useState('')
  const fileRef = useRef(null)
  const imageFileRef = useRef(null)
  const docFileRef = useRef(null)
  const [pendingFile, setPendingFile] = useState(null)

  const willPromoteToChapter = useMemo(() => {
    if (type !== 'event' || !form.endDate || !form.date) return false
    const days = (new Date(form.endDate) - new Date(form.date)) / (1000 * 60 * 60 * 24)
    return days > 30
  }, [type, form.date, form.endDate])

  const [newRef, setNewRef] = useState('')
  const [newLink, setNewLink] = useState({ label: '', url: '' })

  const isChapter = type === 'chapter'

  function setField(field, val) {
    setForm((f) => ({ ...f, [field]: val }))
  }

  function addToList(field, val, reset) {
    if (!val || (typeof val === 'object' && !val.url && !val.text)) return
    setForm((f) => ({ ...f, [field]: [...(f[field] || []), val] }))
    reset()
  }

  function removeFromList(field, idx) {
    setForm((f) => ({ ...f, [field]: f[field].filter((_, i) => i !== idx) }))
  }

  function validateDate(date) {
    if (!date) return ''
    if (minDate && date < minDate) return `Date must be on or after ${minDate}`
    if (maxDate && date > maxDate) return `Date must be on or before ${maxDate}`
    return ''
  }

  function handleDateChange(val) {
    setField('date', val)
    setDateError(validateDate(val))
  }

  async function handleFileSelect(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > MAX_FILE_BYTES) {
      alert('File too large. Maximum size is 10MB.')
      e.target.value = ''
      return
    }
    const dataUrl = await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (ev) => resolve(ev.target.result)
      reader.readAsDataURL(file)
    })
    setPendingFile({ name: file.name, dataUrl, type: file.type })
    e.target.value = ''
  }

  async function handleMultiFileSelect(e, field) {
    const files = [...e.target.files]
    e.target.value = ''
    const tooBig = files.filter((f) => f.size > MAX_FILE_BYTES)
    if (tooBig.length) alert(`Skipped ${tooBig.length} file(s) over 10MB.`)
    const valid = files.filter((f) => f.size <= MAX_FILE_BYTES)
    const items = await Promise.all(valid.map((file) => new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (ev) => resolve({ name: file.name, dataUrl: ev.target.result, type: file.type })
      reader.readAsDataURL(file)
    })))
    setForm((f) => ({ ...f, [field]: [...(f[field] || []), ...items] }))
  }

  function addRef() {
    const text = newRef.trim()
    if (!text && !pendingFile) return
    const refObj = {
      text: text || (pendingFile ? pendingFile.name : ''),
      ...(pendingFile ? { attachment: pendingFile } : {}),
    }
    setForm((f) => ({ ...f, references: [...(f.references || []), refObj] }))
    setNewRef('')
    setPendingFile(null)
  }

  function handleSave() {
    if (!form.title.trim() || !form.date) return
    const err = validateDate(form.date)
    if (err) { setDateError(err); return }
    onSave(form)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="zam-glass-strong zam-glass-edge zam-elevated rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-white">
            {initial?.id ? 'Edit' : 'New'} {isChapter ? 'Chapter' : type === 'subEvent' ? 'Sub-event' : 'Event'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-5 space-y-4 flex-1">
          {/* Color */}
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setField('color', c)}
                  className="w-7 h-7 rounded-full transition-transform hover:scale-110"
                  style={{
                    background: c,
                    outline: form.color === c ? `3px solid white` : 'none',
                    outlineOffset: '2px',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Category — events and chapters only */}
          {type !== 'subEvent' && (
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">Category</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setField('category', '')}
                  className="text-xs px-2.5 py-1 rounded-full border transition-all"
                  style={{
                    background: form.category === '' ? 'var(--border)' : 'transparent',
                    borderColor: form.category === '' ? '#6366f1' : 'var(--border)',
                    color: form.category === '' ? '#a5b4fc' : '#6b7280',
                  }}
                >
                  None
                </button>
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setField('category', form.category === cat.id ? '' : cat.id)}
                    className="text-xs px-2.5 py-1 rounded-full border transition-all"
                    style={{
                      background: form.category === cat.id ? cat.color + '25' : 'transparent',
                      borderColor: form.category === cat.id ? cat.color : 'var(--border)',
                      color: form.category === cat.id ? cat.color : '#6b7280',
                    }}
                  >
                    {cat.short} {cat.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Milestone — events only */}
          {type === 'event' && (
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">Milestone</label>
              <button
                type="button"
                onClick={() => setField('milestone', !form.milestone)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-all text-sm"
                style={{
                  background: form.milestone ? '#f59e0b18' : 'transparent',
                  borderColor: form.milestone ? '#f59e0b' : 'var(--border)',
                  color: form.milestone ? '#f59e0b' : '#6b7280',
                }}
              >
                <span style={{
                  display: 'inline-block',
                  width: 10, height: 10,
                  background: form.milestone ? '#f59e0b' : 'transparent',
                  border: `2px solid ${form.milestone ? '#f59e0b' : '#6b7280'}`,
                  transform: 'rotate(45deg)',
                  borderRadius: 2,
                  flexShrink: 0,
                }} />
                {form.milestone ? 'Marked as milestone' : 'Mark as milestone'}
              </button>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">Title *</label>
            <input
              className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
              placeholder="Enter title..."
            />
          </div>

          {/* Date(s) */}
          <div className={`grid ${isChapter ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">
                {isChapter ? 'Start Date *' : 'Date *'}
              </label>
              <input
                type="date"
                className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                value={form.date}
                min={minDate || undefined}
                max={maxDate || undefined}
                onChange={(e) => handleDateChange(e.target.value)}
                style={{ borderColor: dateError ? '#f43f5e' : undefined }}
              />
              {dateError && (
                <p className="text-xs text-red-400 mt-1">{dateError}</p>
              )}
              {minDate && maxDate && !dateError && (
                <p className="text-xs text-slate-600 mt-1">Must be between {minDate} and {maxDate}</p>
              )}
            </div>
            {isChapter && (
              <div>
                <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">End Date *</label>
                <input
                  type="date"
                  className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                  value={form.endDate || ''}
                  min={form.date || undefined}
                  onChange={(e) => setField('endDate', e.target.value)}
                />
              </div>
            )}
          </div>

          {/* End date for events and sub-events */}
          {(type === 'event' || type === 'subEvent') && (
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">
                End Date <span className="text-slate-600 normal-case">(optional — adds duration)</span>
              </label>
              <input
                type="date"
                className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                value={form.endDate || ''}
                min={form.date || minDate || undefined}
                max={maxDate || undefined}
                onChange={(e) => setField('endDate', e.target.value || '')}
              />
              {willPromoteToChapter && (
                <div className="mt-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <p className="text-xs text-amber-400 font-medium">Duration exceeds 1 month — will be saved as a Chapter</p>
                </div>
              )}
            </div>
          )}

          {/* Description */}
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">Description</label>
            <RichTextEditor
              value={form.description}
              onChange={(val) => setField('description', val)}
              placeholder="Describe this event..."
              minHeight={72}
            />
          </div>

          {/* Opinion */}
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">Opinion / Analysis</label>
            <RichTextEditor
              value={form.opinion}
              onChange={(val) => setField('opinion', val)}
              placeholder="Your personal take..."
              minHeight={48}
            />
          </div>

          {/* Custom boxes */}
          {(form.customBoxes || []).map((box) => (
            <div key={box.id}>
              <div className="flex items-center gap-2 mb-1">
                <input
                  className="flex-1 bg-transparent border-b border-[var(--border)] text-xs text-slate-300 uppercase tracking-wider pb-0.5 focus:outline-none focus:border-indigo-500 transition-colors"
                  value={box.title}
                  onChange={(e) => setField('customBoxes', form.customBoxes.map((b) => b.id === box.id ? { ...b, title: e.target.value } : b))}
                  placeholder="Box title..."
                />
                <button
                  onClick={() => setField('customBoxes', form.customBoxes.filter((b) => b.id !== box.id))}
                  className="text-slate-600 hover:text-red-400 transition-colors flex-shrink-0"
                >
                  <TrashIcon className="w-3.5 h-3.5" />
                </button>
              </div>
              <RichTextEditor
                value={box.content}
                onChange={(val) => setField('customBoxes', form.customBoxes.map((b) => b.id === box.id ? { ...b, content: val } : b))}
                placeholder="Write here..."
                minHeight={48}
              />
            </div>
          ))}
          <button
            onClick={() => setField('customBoxes', [...(form.customBoxes || []), { id: crypto.randomUUID(), title: '', content: '' }])}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-400 transition-colors"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            Add custom box
          </button>

          {/* People */}
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">People Involved</label>
            <PersonPicker people={form.people} onChange={(people) => setField('people', people)} />
          </div>

          {/* Images */}
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">Images</label>
            <input
              ref={imageFileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleMultiFileSelect(e, 'images')}
            />
            <button
              onClick={() => imageFileRef.current?.click()}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-400 transition-colors mb-2"
            >
              <PhotoIcon className="w-3.5 h-3.5" />
              Add image{form.images?.length ? 's' : ''} <span className="text-slate-600">(max 10MB each)</span>
            </button>
            {form.images?.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {form.images.map((img, i) => (
                  <div key={i} className="relative group aspect-square rounded-lg overflow-hidden border border-[var(--border)]">
                    <img src={img.dataUrl} alt={img.name} className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeFromList('images', i)}
                      className="absolute top-1 right-1 bg-black/60 hover:bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <XMarkIcon className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Documents */}
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">Documents</label>
            <input
              ref={docFileRef}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
              multiple
              className="hidden"
              onChange={(e) => handleMultiFileSelect(e, 'documents')}
            />
            <button
              onClick={() => docFileRef.current?.click()}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-400 transition-colors mb-2"
            >
              <DocumentIcon className="w-3.5 h-3.5" />
              Add document{form.documents?.length ? 's' : ''} <span className="text-slate-600">(max 10MB each)</span>
            </button>
            {form.documents?.length > 0 && (
              <div className="space-y-1.5">
                {form.documents.map((doc, i) => (
                  <div key={i} className="flex items-center gap-2 bg-[var(--bg-base)] px-3 py-2 rounded-lg text-sm">
                    <DocumentIcon className="w-4 h-4 text-slate-500 flex-shrink-0" />
                    <span className="text-slate-300 truncate flex-1">{doc.name}</span>
                    <button onClick={() => removeFromList('documents', i)} className="text-slate-500 hover:text-red-400 flex-shrink-0">
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* References */}
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">References</label>
            <div className="flex gap-2 mb-2">
              <input
                className="flex-1 bg-[var(--bg-base)] border border-[var(--border)] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                value={newRef}
                onChange={(e) => setNewRef(e.target.value)}
                placeholder="Book, article, source..."
                onKeyDown={(e) => e.key === 'Enter' && addRef()}
              />
              <button
                onClick={() => fileRef.current?.click()}
                className="bg-[var(--bg-base)] hover:bg-[var(--bg-surface)] border border-[var(--border)] text-slate-400 hover:text-white rounded-lg px-3 transition-colors"
                title="Attach a file (PDF, PNG, JPG — max 10MB)"
              >
                <PaperClipIcon className="w-4 h-4" />
              </button>
              <button
                onClick={addRef}
                className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-3 transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
            {pendingFile && (
              <div className="flex items-center gap-2 bg-indigo-600/10 border border-indigo-500/30 rounded-lg px-3 py-1.5 mb-2 text-xs">
                <PaperClipIcon className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                <span className="text-indigo-300 truncate flex-1">{pendingFile.name}</span>
                <button onClick={() => setPendingFile(null)} className="text-slate-500 hover:text-red-400 flex-shrink-0">
                  <XMarkIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <div className="space-y-1.5">
              {form.references?.map((r, i) => {
                const ref = normalizeRef(r)
                return (
                  <div key={i} className="flex items-start gap-2 bg-[var(--bg-base)] px-3 py-2 rounded-lg text-sm">
                    <div className="flex-1 min-w-0">
                      <span className="text-slate-300">{ref.text}</span>
                      {ref.attachment && (
                        <div className="flex items-center gap-1.5 mt-1">
                          {ref.attachment.type?.startsWith('image/') ? (
                            <img
                              src={ref.attachment.dataUrl}
                              alt={ref.attachment.name}
                              className="h-8 w-auto rounded object-cover border border-[var(--border)]"
                            />
                          ) : (
                            <DocumentIcon className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                          )}
                          <span className="text-xs text-slate-500 truncate">{ref.attachment.name}</span>
                        </div>
                      )}
                    </div>
                    <button onClick={() => removeFromList('references', i)} className="text-slate-500 hover:text-red-400 mt-0.5 flex-shrink-0">
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Links */}
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">Links</label>
            <div className="flex gap-2 mb-2">
              <input
                className="flex-1 bg-[var(--bg-base)] border border-[var(--border)] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                value={newLink.label}
                onChange={(e) => setNewLink((l) => ({ ...l, label: e.target.value }))}
                placeholder="Label"
              />
              <input
                className="flex-1 bg-[var(--bg-base)] border border-[var(--border)] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                value={newLink.url}
                onChange={(e) => setNewLink((l) => ({ ...l, url: e.target.value }))}
                placeholder="https://..."
                onKeyDown={(e) =>
                  e.key === 'Enter' &&
                  addToList('links', { ...newLink }, () => setNewLink({ label: '', url: '' }))
                }
              />
              <button
                onClick={() => addToList('links', { ...newLink }, () => setNewLink({ label: '', url: '' }))}
                className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-3 transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1">
              {form.links?.map((l, i) => (
                <div key={i} className="flex items-center justify-between bg-[var(--bg-base)] px-3 py-1.5 rounded-lg text-sm">
                  <span className="text-indigo-400">{l.label || l.url}</span>
                  <button onClick={() => removeFromList('links', i)} className="text-slate-500 hover:text-red-400 ml-2">
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t border-[var(--border)]">
          <button onClick={onClose} className="flex-1 bg-[var(--bg-base)] hover:bg-[var(--bg-surface)] border border-[var(--border)] text-slate-300 rounded-lg py-2 text-sm transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!form.title.trim() || !form.date || (isChapter && !form.endDate) || !!dateError}
            className="zam-lift flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg py-2 text-sm font-medium transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
