import { useState, useRef } from 'react'
import { XMarkIcon, PencilIcon, TrashIcon, LinkIcon, ArrowsRightLeftIcon, DocumentIcon, UserCircleIcon } from '@heroicons/react/24/outline'
import { formatDate, formatDateRange } from '../utils/format'
import { RELATIONSHIP_MAP } from '../utils/connections'
import { CATEGORY_MAP } from '../utils/categories'
import useStore from '../store/useStore'
import ConfirmDialog from './ConfirmDialog'
import MediaLightbox from './MediaLightbox'

function normalizeRef(r) {
  return typeof r === 'string' ? { text: r } : r
}

const DEFAULT_WIDTH = 384
const MIN_WIDTH = 260
const MAX_WIDTH = 720

export default function DetailPanel({ entity, type, onClose, onEdit, onDelete }) {
  const { connections, events, chapters, peopleDb, deleteConnection, setConnectingFrom, focusModeId, setFocusMode, clearFocusMode } = useStore()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [panelWidth, setPanelWidth] = useState(DEFAULT_WIDTH)
  const [lightboxItem, setLightboxItem] = useState(null)
  const dragRef = useRef(null)

  function handleDragStart(e) {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = panelWidth

    function onMove(e) {
      const dx = startX - e.clientX
      setPanelWidth(Math.min(Math.max(startWidth + dx, MIN_WIDTH), MAX_WIDTH))
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }
  if (!entity) return null

  const dateLabel = type === 'chapter'
    ? formatDateRange(entity.date, entity.endDate)
    : formatDate(entity.date)

  const entityConnections = connections.filter(
    (c) => c.fromId === entity.id || c.toId === entity.id
  )

  function resolveEntity(id, type) {
    if (type === 'event') return events.find((e) => e.id === id)
    if (type === 'chapter') return chapters.find((c) => c.id === id)
    const allSubs = chapters.flatMap((c) => c.subEvents || [])
    return allSubs.find((s) => s.id === id)
  }

  function handleAddConnection() {
    setConnectingFrom({ id: entity.id, type, title: entity.title, color: entity.color })
    onClose()
  }

  return (
    <div
      className="fixed right-0 top-0 h-full zam-glass-strong border-l border-[var(--border)] z-40 flex flex-col zam-elevated zam-slide-right"
      style={{ width: panelWidth }}
    >
      {/* Drag handle */}
      <div
        ref={dragRef}
        onMouseDown={handleDragStart}
        onDoubleClick={() => setPanelWidth(DEFAULT_WIDTH)}
        className="absolute left-0 top-0 bottom-0 w-1 z-10 group"
        style={{ cursor: 'col-resize' }}
        title="Drag to resize · Double-click to reset"
      >
        <div className="absolute inset-0 group-hover:bg-indigo-500/40 transition-colors" />
        <div className="absolute left-0 top-1/2 -translate-y-1/2 flex flex-col gap-1 items-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ marginLeft: 2 }}>
          <span className="w-0.5 h-3 bg-indigo-400/60 rounded-full" />
          <span className="w-0.5 h-3 bg-indigo-400/60 rounded-full" />
          <span className="w-0.5 h-3 bg-indigo-400/60 rounded-full" />
        </div>
      </div>
      {/* Header */}
      <div className="flex items-start justify-between p-5 border-b border-[var(--border)]">
        <div className="flex-1 mr-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: entity.color || '#6366f1' }} />
            <span className="text-xs text-slate-400 uppercase tracking-wider">
              {type === 'chapter' ? 'Chapter' : type === 'subEvent' ? 'Sub-event' : 'Event'}
            </span>
          </div>
          <h2 className="text-lg font-semibold text-white leading-tight">{entity.title}</h2>
          <p className="text-sm text-slate-400 mt-1">{dateLabel}</p>
          {entity.category && CATEGORY_MAP[entity.category] && (
            <span
              className="inline-block mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{
                background: CATEGORY_MAP[entity.category].color + '22',
                color: CATEGORY_MAP[entity.category].color,
                border: `1px solid ${CATEGORY_MAP[entity.category].color}50`,
              }}
            >
              {CATEGORY_MAP[entity.category].short} · {CATEGORY_MAP[entity.category].label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => focusModeId === entity.id ? clearFocusMode() : setFocusMode(entity.id)}
            title={focusModeId === entity.id ? 'Exit focus mode' : 'Focus: show only connected entities'}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-base)] transition-colors"
            style={{ color: focusModeId === entity.id ? '#a78bfa' : '#6b7280' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="3" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
            </svg>
          </button>
          <button onClick={onEdit} className="text-slate-400 hover:text-indigo-400 transition-colors p-1.5 rounded-lg hover:bg-[var(--bg-base)]">
            <PencilIcon className="w-4 h-4" />
          </button>
          <button onClick={() => setConfirmOpen(true)} className="text-slate-400 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-[var(--bg-base)]">
            <TrashIcon className="w-4 h-4" />
          </button>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-[var(--bg-base)]">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="overflow-y-auto flex-1 p-5 space-y-5">
        {entity.description && (
          <Section label="Description">
            <div
              className="prose-content text-sm text-slate-300 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: entity.description }}
            />
          </Section>
        )}
        {entity.opinion && (
          <Section label="Opinion / Analysis">
            <div
              className="prose-content text-sm text-slate-300 leading-relaxed italic border-l-2 pl-3"
              style={{ borderColor: entity.color || '#6366f1' }}
              dangerouslySetInnerHTML={{ __html: entity.opinion }}
            />
          </Section>
        )}
        {entity.customBoxes?.filter((b) => b.content).map((box) => (
          <Section key={box.id} label={box.title || 'Custom'}>
            <div
              className="prose-content text-sm text-slate-300 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: box.content }}
            />
          </Section>
        ))}
        {entity.people?.length > 0 && (
          <Section label="People Involved">
            <div className="flex flex-wrap gap-2">
              {entity.people.map((p, i) => {
                const photo = peopleDb?.find((person) => person.name === p)?.photo
                return (
                  <span key={i} className="flex items-center gap-1.5 bg-[var(--bg-base)] border border-[var(--border)] text-slate-300 text-xs pl-1 pr-2.5 py-1 rounded-full">
                    {photo ? (
                      <img src={photo} alt={p} className="w-4 h-4 rounded-full object-cover" />
                    ) : (
                      <UserCircleIcon className="w-4 h-4 text-slate-500" />
                    )}
                    {p}
                  </span>
                )
              })}
            </div>
          </Section>
        )}
        {entity.images?.length > 0 && (
          <Section label="Images">
            <div className="grid grid-cols-3 gap-2">
              {entity.images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setLightboxItem(img)}
                  className="block aspect-square rounded-lg overflow-hidden border border-[var(--border)] hover:opacity-90 transition-opacity"
                >
                  <img src={img.dataUrl} alt={img.name} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </Section>
        )}
        {entity.documents?.length > 0 && (
          <Section label="Documents">
            <div className="space-y-2">
              {entity.documents.map((doc, i) => (
                <button
                  key={i}
                  onClick={() => setLightboxItem(doc)}
                  className="w-full flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors bg-[var(--bg-base)] border border-[var(--border)] rounded-lg px-3 py-2"
                >
                  <DocumentIcon className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{doc.name}</span>
                </button>
              ))}
            </div>
          </Section>
        )}
        {entity.references?.length > 0 && (
          <Section label="References">
            <ul className="space-y-2">
              {entity.references.map((r, i) => {
                const ref = normalizeRef(r)
                return (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-slate-500 mt-0.5 flex-shrink-0">–</span>
                    <div className="min-w-0">
                      <span className="text-sm text-slate-300">{ref.text}</span>
                      {ref.attachment && (
                        <div className="mt-1.5">
                          {ref.attachment.type?.startsWith('image/') ? (
                            <button onClick={() => setLightboxItem(ref.attachment)}>
                              <img
                                src={ref.attachment.dataUrl}
                                alt={ref.attachment.name}
                                className="max-h-24 w-auto rounded-lg border border-[var(--border)] object-cover hover:opacity-90 transition-opacity"
                              />
                            </button>
                          ) : (
                            <button
                              onClick={() => setLightboxItem(ref.attachment)}
                              className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                            >
                              <DocumentIcon className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className="truncate">{ref.attachment.name}</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </Section>
        )}
        {entity.links?.length > 0 && (
          <Section label="Links">
            <div className="space-y-2">
              {entity.links.map((l, i) => (
                <a key={i} href={l.url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
                  <LinkIcon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{l.label || l.url}</span>
                </a>
              ))}
            </div>
          </Section>
        )}

        {/* Connections */}
        <Section label={`Connections (${entityConnections.length})`}>
          <button
            onClick={handleAddConnection}
            className="w-full flex items-center justify-center gap-2 text-sm bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-400 rounded-lg py-2 mb-3 transition-colors"
          >
            <ArrowsRightLeftIcon className="w-4 h-4" />
            Add Connection
          </button>

          {entityConnections.length === 0 ? (
            <p className="text-xs text-slate-600 text-center py-2">No connections yet.</p>
          ) : (
            <div className="space-y-2">
              {entityConnections.map((conn) => {
                const isFrom = conn.fromId === entity.id
                const otherId = isFrom ? conn.toId : conn.fromId
                const otherType = isFrom ? conn.toType : conn.fromType
                const other = resolveEntity(otherId, otherType)
                const rel = RELATIONSHIP_MAP[conn.relationship]
                if (!rel || !other) return null
                return (
                  <div key={conn.id} className="flex items-center gap-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-lg p-2.5">
                    <span className="text-xs font-bold flex-shrink-0" style={{ color: rel.color }}>
                      {isFrom ? '→' : '←'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: rel.color }}>
                        {rel.label}
                      </span>
                      <p className="text-xs text-slate-300 truncate">{other.title}</p>
                    </div>
                    <button
                      onClick={() => deleteConnection(conn.id)}
                      className="text-slate-600 hover:text-red-400 transition-colors flex-shrink-0"
                    >
                      <XMarkIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </Section>
      </div>

      {confirmOpen && (
        <ConfirmDialog
          message={`Delete "${entity.title}"?`}
          onConfirm={() => { setConfirmOpen(false); onDelete() }}
          onCancel={() => setConfirmOpen(false)}
        />
      )}

      {lightboxItem && (
        <MediaLightbox item={lightboxItem} onClose={() => setLightboxItem(null)} />
      )}
    </div>
  )
}

function Section({ label, children }) {
  return (
    <div>
      <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">{label}</p>
      {children}
    </div>
  )
}
