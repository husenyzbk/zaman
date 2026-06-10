import { useState } from 'react'
import { XMarkIcon, PlusIcon, PencilIcon, TrashIcon, ArrowsRightLeftIcon, MapIcon, LinkIcon, DocumentIcon, UserCircleIcon } from '@heroicons/react/24/outline'
import useStore from '../store/useStore'
import EntityForm from './EntityForm'
import ConfirmDialog from './ConfirmDialog'
import RelationshipPicker from './RelationshipPicker'
import EntityPicker from './EntityPicker'
import MediaLightbox from './MediaLightbox'
import { formatDate, formatDateRange } from '../utils/format'
import { RELATIONSHIP_MAP } from '../utils/connections'
import { CATEGORY_MAP } from '../utils/categories'

function normalizeRef(r) {
  return typeof r === 'string' ? { text: r } : r
}

function RichContent({ html, className }) {
  if (!html) return null
  return (
    <div
      className={`prose-content leading-relaxed ${className || ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

export default function ChapterModal({ chapter, onClose, onOpenTimeline, initialSubEventId }) {
  const { addSubEvent, updateSubEvent, deleteSubEvent, updateChapter, deleteChapter, connections, addConnection, deleteConnection, events, chapters, peopleDb } = useStore()

  const [showSubEventForm, setShowSubEventForm] = useState(false)
  const [editingSubEvent, setEditingSubEvent] = useState(null)
  const [editingChapter, setEditingChapter] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [showChapterDetails, setShowChapterDetails] = useState(false)
  const [lightboxItem, setLightboxItem] = useState(null)

  // Sub-event connection flow
  const [pickingTarget, setPickingTarget] = useState(false)
  const [pendingConnTarget, setPendingConnTarget] = useState(null)

  const subEvents = chapter.subEvents || []
  const [selectedSubEvent, setSelectedSubEvent] = useState(
    initialSubEventId ? (subEvents.find((se) => se.id === initialSubEventId) || null) : null
  )

  const hasChapterDetails = chapter.opinion || (chapter.people?.length > 0) || (chapter.references?.length > 0) || (chapter.links?.length > 0)
    || (chapter.customBoxes?.some((b) => b.content)) || (chapter.images?.length > 0) || (chapter.documents?.length > 0)

  function personPhoto(name) {
    return peopleDb?.find((p) => p.name === name)?.photo
  }

  function handleAddSubEvent(form) {
    addSubEvent(chapter.id, form)
    setShowSubEventForm(false)
  }

  function handleEditSubEvent(form) {
    updateSubEvent(chapter.id, editingSubEvent.id, form)
    if (selectedSubEvent?.id === editingSubEvent.id) setSelectedSubEvent({ ...editingSubEvent, ...form })
    setEditingSubEvent(null)
  }

  function handleDeleteSubEvent(id) {
    deleteSubEvent(chapter.id, id)
    if (selectedSubEvent?.id === id) setSelectedSubEvent(null)
  }

  function handleEditChapter(form) {
    updateChapter(chapter.id, form)
    setEditingChapter(false)
  }

  function handleConfirmDelete() {
    if (confirmDelete?.type === 'chapter') {
      deleteChapter(chapter.id)
      onClose()
    } else if (confirmDelete?.type === 'subEvent') {
      handleDeleteSubEvent(confirmDelete.id)
    }
    setConfirmDelete(null)
  }

  function getSubEventConnections(seId) {
    return connections.filter((c) => c.fromId === seId || c.toId === seId)
  }

  function resolveConnTarget(conn, seId) {
    const isFrom = conn.fromId === seId
    const id = isFrom ? conn.toId : conn.fromId
    const type = isFrom ? conn.toType : conn.fromType
    if (type === 'event') return { entity: events.find((e) => e.id === id), type, isFrom }
    if (type === 'chapter') return { entity: chapters.find((c) => c.id === id), type, isFrom }
    const allSubs = chapters.flatMap((c) => (c.subEvents || []).map((s) => ({ ...s, _chId: c.id })))
    return { entity: allSubs.find((s) => s.id === id), type, isFrom }
  }

  function handleConfirmSubEventConn(relationship, notes) {
    if (!selectedSubEvent || !pendingConnTarget) return
    addConnection({
      fromId: selectedSubEvent.id,
      fromType: 'subEvent',
      fromChapterId: chapter.id,
      toId: pendingConnTarget.id,
      toType: pendingConnTarget.type,
      relationship,
      notes,
    })
    setPendingConnTarget(null)
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
      <div className="zam-glass-strong zam-glass-edge zam-elevated rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Chapter header */}
        <div className="flex items-center justify-between p-5 rounded-t-2xl flex-shrink-0" style={{ borderBottom: `2px solid ${chapter.color || '#6366f1'}` }}>
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full" style={{ background: chapter.color || '#6366f1' }} />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-white">{chapter.title}</h2>
                {chapter.category && CATEGORY_MAP[chapter.category] && (
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background: CATEGORY_MAP[chapter.category].color + '22',
                      color: CATEGORY_MAP[chapter.category].color,
                      border: `1px solid ${CATEGORY_MAP[chapter.category].color}50`,
                    }}
                  >
                    {CATEGORY_MAP[chapter.category].short} · {CATEGORY_MAP[chapter.category].label}
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-400">{formatDateRange(chapter.date, chapter.endDate)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onOpenTimeline && (
              <button onClick={onOpenTimeline} className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors px-2 py-1.5 rounded-lg hover:bg-[var(--bg-surface)] border border-indigo-500/30 hover:border-indigo-400/50">
                <MapIcon className="w-3.5 h-3.5" /> Open Timeline
              </button>
            )}
            <button onClick={() => setEditingChapter(true)} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-indigo-400 transition-colors px-2 py-1.5 rounded-lg hover:bg-[var(--bg-surface)]">
              <PencilIcon className="w-3.5 h-3.5" /> Edit
            </button>
            <button onClick={() => setConfirmDelete({ type: 'chapter' })} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-400 transition-colors px-2 py-1.5 rounded-lg hover:bg-[var(--bg-surface)]">
              <TrashIcon className="w-3.5 h-3.5" /> Delete
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors ml-1 p-1">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: chapter details + sub-events list */}
          <div className="flex-1 overflow-y-auto p-5">
            {/* Chapter description */}
            {chapter.description && (
              <div className="mb-4 pb-4 border-b border-[var(--border)]">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Description</p>
                <RichContent html={chapter.description} className="text-sm text-slate-400" />
              </div>
            )}

            {/* Toggle for extra chapter details */}
            {hasChapterDetails && (
              <button
                onClick={() => setShowChapterDetails(!showChapterDetails)}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 mb-4 transition-colors"
              >
                <span>{showChapterDetails ? '▾' : '▸'}</span>
                {showChapterDetails ? 'Hide chapter details' : 'Show chapter details (opinion, people, images, documents, references, links)'}
              </button>
            )}

            {/* Expanded chapter details */}
            {showChapterDetails && (
              <div className="mb-5 space-y-4 pb-5 border-b border-[var(--border)]">
                {chapter.opinion && (
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Opinion / Analysis</p>
                    <RichContent
                      html={chapter.opinion}
                      className="text-sm text-slate-400 italic border-l-2 pl-3"
                    />
                  </div>
                )}
                {chapter.customBoxes?.filter((b) => b.content).map((box) => (
                  <div key={box.id}>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">{box.title || 'Custom'}</p>
                    <RichContent html={box.content} className="text-sm text-slate-400" />
                  </div>
                ))}
                {chapter.people?.length > 0 && (
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">People Involved</p>
                    <div className="flex flex-wrap gap-1.5">
                      {chapter.people.map((p, i) => {
                        const photo = personPhoto(p)
                        return (
                          <span key={i} className="flex items-center gap-1.5 bg-[var(--bg-surface)] border border-[var(--border)] text-slate-300 text-xs pl-1 pr-2.5 py-1 rounded-full">
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
                  </div>
                )}
                {chapter.images?.length > 0 && (
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Images</p>
                    <div className="grid grid-cols-6 gap-2">
                      {chapter.images.map((img, i) => (
                        <button
                          key={i}
                          onClick={() => setLightboxItem(img)}
                          className="block aspect-square rounded-lg overflow-hidden border border-[var(--border)] hover:opacity-90 transition-opacity"
                        >
                          <img src={img.dataUrl} alt={img.name} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {chapter.documents?.length > 0 && (
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Documents</p>
                    <div className="space-y-2">
                      {chapter.documents.map((doc, i) => (
                        <button
                          key={i}
                          onClick={() => setLightboxItem(doc)}
                          className="w-full flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2"
                        >
                          <DocumentIcon className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">{doc.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {chapter.references?.length > 0 && (
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">References</p>
                    <ul className="space-y-2">
                      {chapter.references.map((r, i) => {
                        const ref = normalizeRef(r)
                        return (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-slate-500 flex-shrink-0">–</span>
                            <div className="min-w-0">
                              <span className="text-sm text-slate-300">{ref.text}</span>
                              {ref.attachment && (
                                <div className="mt-1">
                                  {ref.attachment.type?.startsWith('image/') ? (
                                    <button onClick={() => setLightboxItem(ref.attachment)}>
                                      <img src={ref.attachment.dataUrl} alt={ref.attachment.name} className="max-h-20 w-auto rounded-lg border border-[var(--border)] object-cover hover:opacity-90 transition-opacity" />
                                    </button>
                                  ) : (
                                    <button onClick={() => setLightboxItem(ref.attachment)} className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300">
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
                  </div>
                )}
                {chapter.links?.length > 0 && (
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Links</p>
                    <div className="space-y-1.5">
                      {chapter.links.map((l, i) => (
                        <a key={i} href={l.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
                          <LinkIcon className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate">{l.label || l.url}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-slate-300">
                Sub-events <span className="text-slate-500">({subEvents.length})</span>
              </h3>
              <button
                onClick={() => setShowSubEventForm(true)}
                className="zam-lift flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                <PlusIcon className="w-3.5 h-3.5" /> Add Sub-event
              </button>
            </div>

            {subEvents.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">
                No sub-events yet. Click "Add Sub-event" to create one.
              </div>
            ) : (
              <div className="space-y-2">
                {subEvents
                  .slice()
                  .sort((a, b) => new Date(a.date) - new Date(b.date))
                  .map((se) => {
                    const connCount = getSubEventConnections(se.id).length
                    return (
                      <div
                        key={se.id}
                        onClick={() => setSelectedSubEvent(se)}
                        className="flex items-center gap-3 bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] border border-[var(--border)] rounded-xl p-3 cursor-pointer transition-colors group"
                        style={{ borderColor: selectedSubEvent?.id === se.id ? (se.color || '#6366f1') + '88' : 'var(--border)' }}
                      >
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: se.color || '#6366f1' }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{se.title}</p>
                          <p className="text-xs text-slate-500">{formatDate(se.date)}</p>
                        </div>
                        {connCount > 0 && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: (se.color || '#6366f1') + '22', color: se.color || '#6366f1' }}>
                            {connCount}
                          </span>
                        )}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={(e) => { e.stopPropagation(); setEditingSubEvent(se) }} className="text-slate-400 hover:text-indigo-400 p-1">
                            <PencilIcon className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); setConfirmDelete({ type: 'subEvent', id: se.id, title: se.title }) }} className="text-slate-400 hover:text-red-400 p-1">
                            <TrashIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>

          {/* Sub-event detail panel */}
          {selectedSubEvent && (
            <div className="w-72 border-l border-[var(--border)] overflow-y-auto flex-shrink-0 flex flex-col">
              <div className="p-4 border-b border-[var(--border)] flex-shrink-0">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: selectedSubEvent.color || '#6366f1' }} />
                      <span className="text-xs text-slate-400 uppercase tracking-wider">Sub-event</span>
                    </div>
                    <h3 className="text-sm font-semibold text-white">{selectedSubEvent.title}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{formatDate(selectedSubEvent.date)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setEditingSubEvent(selectedSubEvent)} className="text-slate-400 hover:text-indigo-400 p-1">
                      <PencilIcon className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setConfirmDelete({ type: 'subEvent', id: selectedSubEvent.id, title: selectedSubEvent.title })} className="text-slate-400 hover:text-red-400 p-1">
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setSelectedSubEvent(null)} className="text-slate-500 hover:text-white p-1">
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {selectedSubEvent.description && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Description</p>
                    <RichContent html={selectedSubEvent.description} className="text-xs text-slate-300" />
                  </div>
                )}
                {selectedSubEvent.opinion && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Opinion</p>
                    <RichContent
                      html={selectedSubEvent.opinion}
                      className="text-xs text-slate-300 italic border-l-2 pl-2"
                    />
                  </div>
                )}
                {selectedSubEvent.customBoxes?.filter((b) => b.content).map((box) => (
                  <div key={box.id}>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{box.title || 'Custom'}</p>
                    <RichContent html={box.content} className="text-xs text-slate-300" />
                  </div>
                ))}
                {selectedSubEvent.people?.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">People</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedSubEvent.people.map((p, i) => {
                        const photo = personPhoto(p)
                        return (
                          <span key={i} className="flex items-center gap-1 bg-[var(--bg-base)] border border-[var(--border)] text-slate-300 text-xs pl-1 pr-2 py-0.5 rounded-full">
                            {photo ? (
                              <img src={photo} alt={p} className="w-3.5 h-3.5 rounded-full object-cover" />
                            ) : (
                              <UserCircleIcon className="w-3.5 h-3.5 text-slate-500" />
                            )}
                            {p}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )}
                {selectedSubEvent.images?.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Images</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {selectedSubEvent.images.map((img, i) => (
                        <button
                          key={i}
                          onClick={() => setLightboxItem(img)}
                          className="block aspect-square rounded-lg overflow-hidden border border-[var(--border)] hover:opacity-90 transition-opacity"
                        >
                          <img src={img.dataUrl} alt={img.name} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {selectedSubEvent.documents?.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Documents</p>
                    <div className="space-y-1.5">
                      {selectedSubEvent.documents.map((doc, i) => (
                        <button
                          key={i}
                          onClick={() => setLightboxItem(doc)}
                          className="w-full flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors bg-[var(--bg-base)] border border-[var(--border)] rounded-lg px-2 py-1.5"
                        >
                          <DocumentIcon className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate">{doc.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {selectedSubEvent.references?.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">References</p>
                    <ul className="space-y-2">
                      {selectedSubEvent.references.map((r, i) => {
                        const ref = normalizeRef(r)
                        return (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-slate-500 text-xs flex-shrink-0">–</span>
                            <div className="min-w-0">
                              <span className="text-xs text-slate-300">{ref.text}</span>
                              {ref.attachment && (
                                <div className="mt-1">
                                  {ref.attachment.type?.startsWith('image/') ? (
                                    <button onClick={() => setLightboxItem(ref.attachment)}>
                                      <img src={ref.attachment.dataUrl} alt={ref.attachment.name} className="max-h-16 w-auto rounded border border-[var(--border)] object-cover hover:opacity-90 transition-opacity" />
                                    </button>
                                  ) : (
                                    <button onClick={() => setLightboxItem(ref.attachment)} className="flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300">
                                      <DocumentIcon className="w-3 h-3 flex-shrink-0" />
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
                  </div>
                )}
                {selectedSubEvent.links?.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Links</p>
                    {selectedSubEvent.links.map((l, i) => (
                      <a key={i} href={l.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 block truncate mb-1">
                        <LinkIcon className="w-3 h-3 flex-shrink-0 inline" />
                        {l.label || l.url}
                      </a>
                    ))}
                  </div>
                )}

                {/* Connections */}
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">
                    Connections ({getSubEventConnections(selectedSubEvent.id).length})
                  </p>
                  <button
                    onClick={() => setPickingTarget(true)}
                    className="w-full flex items-center justify-center gap-1.5 text-xs bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-400 rounded-lg py-1.5 mb-2 transition-colors"
                  >
                    <ArrowsRightLeftIcon className="w-3.5 h-3.5" /> Add Connection
                  </button>

                  {getSubEventConnections(selectedSubEvent.id).length === 0 ? (
                    <p className="text-xs text-slate-600 text-center py-1">No connections yet.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {getSubEventConnections(selectedSubEvent.id).map((conn) => {
                        const { entity: other, type: otherType, isFrom } = resolveConnTarget(conn, selectedSubEvent.id)
                        const rel = RELATIONSHIP_MAP[conn.relationship]
                        if (!rel || !other) return null
                        return (
                          <div key={conn.id} className="flex items-center gap-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-lg p-2">
                            <span className="text-xs font-bold" style={{ color: rel.color }}>{isFrom ? '→' : '←'}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: rel.color }}>{rel.label}</p>
                              <p className="text-xs text-slate-300 truncate">{other.title}</p>
                            </div>
                            <button onClick={() => deleteConnection(conn.id)} className="text-slate-600 hover:text-red-400 transition-colors flex-shrink-0">
                              <XMarkIcon className="w-3 h-3" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sub-event forms */}
      {(showSubEventForm || editingSubEvent) && (
        <EntityForm
          type="subEvent"
          initial={editingSubEvent || {}}
          minDate={chapter.date}
          maxDate={chapter.endDate}
          onSave={editingSubEvent ? handleEditSubEvent : handleAddSubEvent}
          onClose={() => { setShowSubEventForm(false); setEditingSubEvent(null) }}
        />
      )}
      {editingChapter && (
        <EntityForm type="chapter" initial={chapter} onSave={handleEditChapter} onClose={() => setEditingChapter(false)} />
      )}
      {confirmDelete && (
        <ConfirmDialog
          message={`Delete "${confirmDelete.type === 'chapter' ? chapter.title : confirmDelete.title}"?`}
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* Sub-event connection flow */}
      {pickingTarget && selectedSubEvent && (
        <EntityPicker
          excludeId={selectedSubEvent.id}
          onSelect={(target) => { setPendingConnTarget(target); setPickingTarget(false) }}
          onCancel={() => setPickingTarget(false)}
        />
      )}
      {pendingConnTarget && selectedSubEvent && (
        <RelationshipPicker
          from={{ id: selectedSubEvent.id, type: 'subEvent', title: selectedSubEvent.title, color: selectedSubEvent.color }}
          to={pendingConnTarget}
          onConfirm={handleConfirmSubEventConn}
          onCancel={() => setPendingConnTarget(null)}
        />
      )}

      {lightboxItem && (
        <MediaLightbox item={lightboxItem} onClose={() => setLightboxItem(null)} />
      )}
    </div>
  )
}
