import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const TIMELINE_START = 1850
const TIMELINE_END = 2100
const BASE_PX_PER_YEAR = 80

const defaultScrollX = Math.max(
  0,
  (new Date().getFullYear() - TIMELINE_START) * BASE_PX_PER_YEAR -
    (typeof window !== 'undefined' ? window.innerWidth / 3 : 400)
)

const ROOM_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#06b6d4',
]

function createRoom(name, colorIndex) {
  return {
    id: crypto.randomUUID(),
    name,
    color: ROOM_COLORS[colorIndex % ROOM_COLORS.length],
    createdAt: new Date().toISOString(),
    events: [],
    chapters: [],
    connections: [],
    stickyNotes: [],
    peopleDb: [],
    zoom: 1,
    scrollX: defaultScrollX,
    density: 'default',
  }
}

function snap(get) {
  const { events, chapters, connections, stickyNotes, past } = get()
  return {
    past: [...past.slice(-19), { events, chapters, connections, stickyNotes }],
    future: [],
  }
}

const _defaultRoom = createRoom('War Room 1', 0)

const useStore = create(
  persist(
    (set, get) => ({
      // War rooms
      warRooms: [_defaultRoom],
      activeWarRoomId: _defaultRoom.id,

      // Active room flat state
      events: [],
      chapters: [],
      connections: [],
      stickyNotes: [],
      peopleDb: [],

      past: [],
      future: [],

      zoom: 1,
      scrollX: defaultScrollX,
      density: 'default',

      // Connection visibility & focus
      showConnections: true,
      focusModeId: null,

      // Theme & view
      theme: 'dark',
      view: 'timeline',

      // Transient
      jumpToYear: null,
      highlightId: null,
      connectingFrom: null,
      jumpToSubEvent: null,

      toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
      setView: (v) => set({ view: v }),
      toggleConnections: () => set((s) => ({ showConnections: !s.showConnections })),
      setFocusMode: (id) => set({ focusModeId: id }),
      clearFocusMode: () => set({ focusModeId: null }),

      setZoom: (zoom) => set({ zoom: Math.min(Math.max(zoom, 0.2), 8) }),
      setScrollX: (scrollX) => set({ scrollX }),
      setJumpToYear: (year) => set({ jumpToYear: year }),
      clearJumpToYear: () => set({ jumpToYear: null }),
      setHighlightId: (id) => set({ highlightId: id }),
      clearHighlightId: () => set({ highlightId: null }),
      setJumpToSubEvent: (data) => set({ jumpToSubEvent: data }),
      clearJumpToSubEvent: () => set({ jumpToSubEvent: null }),
      setConnectingFrom: (entity) => set({ connectingFrom: entity }),
      clearConnectingFrom: () => set({ connectingFrom: null }),
      setDensity: (density) => set({ density }),

      undo: () => {
        const { past, events, chapters, connections, stickyNotes, future } = get()
        if (!past.length) return
        const prev = past[past.length - 1]
        set({
          ...prev,
          past: past.slice(0, -1),
          future: [{ events, chapters, connections, stickyNotes }, ...future.slice(0, 19)],
        })
      },
      redo: () => {
        const { future, events, chapters, connections, stickyNotes, past } = get()
        if (!future.length) return
        const next = future[0]
        set({
          ...next,
          past: [...past.slice(-19), { events, chapters, connections, stickyNotes }],
          future: future.slice(1),
        })
      },

      // --- War room actions ---
      switchWarRoom: (id) => {
        const { activeWarRoomId, warRooms, events, chapters, connections, stickyNotes, peopleDb, zoom, scrollX, density } = get()
        if (activeWarRoomId === id) return
        const updatedRooms = warRooms.map((r) =>
          r.id === activeWarRoomId
            ? { ...r, events, chapters, connections, stickyNotes, peopleDb, zoom, scrollX, density }
            : r
        )
        const newRoom = updatedRooms.find((r) => r.id === id)
        if (!newRoom) return
        set({
          warRooms: updatedRooms,
          activeWarRoomId: id,
          events: newRoom.events || [],
          chapters: newRoom.chapters || [],
          connections: newRoom.connections || [],
          stickyNotes: newRoom.stickyNotes || [],
          peopleDb: newRoom.peopleDb || [],
          zoom: newRoom.zoom || 1,
          scrollX: newRoom.scrollX ?? defaultScrollX,
          density: newRoom.density || 'default',
          past: [],
          future: [],
        })
      },

      addWarRoom: (name) => {
        const { warRooms, activeWarRoomId, events, chapters, connections, stickyNotes, peopleDb, zoom, scrollX, density } = get()
        const updatedRooms = warRooms.map((r) =>
          r.id === activeWarRoomId
            ? { ...r, events, chapters, connections, stickyNotes, peopleDb, zoom, scrollX, density }
            : r
        )
        const newRoom = createRoom(name || `War Room ${warRooms.length + 1}`, warRooms.length)
        set({
          warRooms: [...updatedRooms, newRoom],
          activeWarRoomId: newRoom.id,
          events: [],
          chapters: [],
          connections: [],
          stickyNotes: [],
          peopleDb: [],
          zoom: 1,
          scrollX: defaultScrollX,
          density: 'default',
          past: [],
          future: [],
        })
      },

      updateWarRoom: (id, updates) => {
        set((s) => ({ warRooms: s.warRooms.map((r) => (r.id === id ? { ...r, ...updates } : r)) }))
      },

      deleteWarRoom: (id) => {
        const { warRooms, activeWarRoomId } = get()
        if (warRooms.length <= 1) return
        const remaining = warRooms.filter((r) => r.id !== id)
        if (activeWarRoomId === id) {
          const next = remaining[0]
          set({
            warRooms: remaining,
            activeWarRoomId: next.id,
            events: next.events || [],
            chapters: next.chapters || [],
            connections: next.connections || [],
            stickyNotes: next.stickyNotes || [],
            peopleDb: next.peopleDb || [],
            zoom: next.zoom || 1,
            scrollX: next.scrollX ?? defaultScrollX,
            density: next.density || 'default',
            past: [],
            future: [],
          })
        } else {
          set({ warRooms: remaining })
        }
      },

      // --- Event actions ---
      addEvent: (event) => {
        const s = get()
        set({ ...snap(get), events: [...s.events, { ...event, id: crypto.randomUUID() }] })
      },
      updateEvent: (id, updates) => {
        const s = get()
        set({ ...snap(get), events: s.events.map((e) => (e.id === id ? { ...e, ...updates } : e)) })
      },
      deleteEvent: (id) => {
        const s = get()
        set({
          ...snap(get),
          events: s.events.filter((e) => e.id !== id),
          connections: s.connections.filter((c) => c.fromId !== id && c.toId !== id),
        })
      },

      // --- Chapter actions ---
      addChapter: (chapter) => {
        const s = get()
        set({ ...snap(get), chapters: [...s.chapters, { ...chapter, id: crypto.randomUUID(), subEvents: [] }] })
      },
      updateChapter: (id, updates) => {
        const s = get()
        set({ ...snap(get), chapters: s.chapters.map((c) => (c.id === id ? { ...c, ...updates } : c)) })
      },
      deleteChapter: (id) => {
        const s = get()
        set({
          ...snap(get),
          chapters: s.chapters.filter((c) => c.id !== id),
          connections: s.connections.filter((c) => c.fromId !== id && c.toId !== id),
        })
      },

      addSubEvent: (chapterId, subEvent) => {
        const s = get()
        set({
          ...snap(get),
          chapters: s.chapters.map((c) =>
            c.id === chapterId
              ? { ...c, subEvents: [...(c.subEvents || []), { ...subEvent, id: crypto.randomUUID(), chapterId }] }
              : c
          ),
        })
      },
      updateSubEvent: (chapterId, subEventId, updates) => {
        const s = get()
        set({
          ...snap(get),
          chapters: s.chapters.map((c) =>
            c.id === chapterId
              ? { ...c, subEvents: c.subEvents.map((se) => (se.id === subEventId ? { ...se, ...updates } : se)) }
              : c
          ),
        })
      },
      deleteSubEvent: (chapterId, subEventId) => {
        const s = get()
        set({
          ...snap(get),
          chapters: s.chapters.map((c) =>
            c.id === chapterId
              ? { ...c, subEvents: c.subEvents.filter((se) => se.id !== subEventId) }
              : c
          ),
          connections: s.connections.filter((c) => c.fromId !== subEventId && c.toId !== subEventId),
        })
      },

      addConnection: (conn) => {
        const s = get()
        set({ ...snap(get), connections: [...s.connections, { ...conn, id: crypto.randomUUID() }] })
      },
      deleteConnection: (id) => {
        const s = get()
        set({ ...snap(get), connections: s.connections.filter((c) => c.id !== id) })
      },

      addStickyNote: (note) => {
        const s = get()
        set({ ...snap(get), stickyNotes: [...s.stickyNotes, { ...note, id: crypto.randomUUID() }] })
      },
      updateStickyNote: (id, updates) => {
        const s = get()
        set({ ...snap(get), stickyNotes: s.stickyNotes.map((n) => (n.id === id ? { ...n, ...updates } : n)) })
      },
      moveStickyNote: (id, updates) => {
        set((s) => ({ stickyNotes: s.stickyNotes.map((n) => (n.id === id ? { ...n, ...updates } : n)) }))
      },
      deleteStickyNote: (id) => {
        const s = get()
        set({ ...snap(get), stickyNotes: s.stickyNotes.filter((n) => n.id !== id) })
      },

      // --- People database ---
      addPerson: (name) => {
        const trimmed = name.trim()
        if (!trimmed) return null
        const { peopleDb } = get()
        const existing = peopleDb.find((p) => p.name.toLowerCase() === trimmed.toLowerCase())
        if (existing) return existing.id
        const person = { id: crypto.randomUUID(), name: trimmed, photo: null, bio: '' }
        set({ peopleDb: [...peopleDb, person] })
        return person.id
      },
      updatePerson: (id, updates) => {
        const { peopleDb, events, chapters } = get()
        const person = peopleDb.find((p) => p.id === id)
        if (!person) return
        const renaming = updates.name && updates.name.trim() && updates.name.trim() !== person.name
        const newName = renaming ? updates.name.trim() : person.name
        set({
          peopleDb: peopleDb.map((p) => (p.id === id ? { ...p, ...updates, name: newName } : p)),
          ...(renaming ? {
            events: events.map((e) => ({ ...e, people: (e.people || []).map((n) => n === person.name ? newName : n) })),
            chapters: chapters.map((c) => ({
              ...c,
              people: (c.people || []).map((n) => n === person.name ? newName : n),
              subEvents: (c.subEvents || []).map((se) => ({ ...se, people: (se.people || []).map((n) => n === person.name ? newName : n) })),
            })),
          } : {}),
        })
      },
      deletePerson: (id) => {
        const { peopleDb } = get()
        set({ peopleDb: peopleDb.filter((p) => p.id !== id) })
      },
    }),
    {
      name: 'zaman-storage',
      version: 2,
      migrate: (persisted, version) => {
        if (version < 2) {
          // Migrate pre-warrooms data into a default war room
          const room = {
            id: crypto.randomUUID(),
            name: 'War Room 1',
            color: '#6366f1',
            createdAt: new Date().toISOString(),
            events: persisted.events || [],
            chapters: persisted.chapters || [],
            connections: persisted.connections || [],
            stickyNotes: persisted.stickyNotes || [],
            zoom: persisted.zoom || 1,
            scrollX: persisted.scrollX ?? defaultScrollX,
            density: persisted.density || 'default',
          }
          return { ...persisted, warRooms: [room], activeWarRoomId: room.id }
        }
        return persisted
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return
        // Sync flat state back into the active war room entry (flat state is always most current)
        if (state.warRooms && state.activeWarRoomId) {
          state.warRooms = state.warRooms.map((r) =>
            r.id === state.activeWarRoomId
              ? {
                  ...r,
                  events: state.events || [],
                  chapters: state.chapters || [],
                  connections: state.connections || [],
                  stickyNotes: state.stickyNotes || [],
                  peopleDb: state.peopleDb || [],
                  zoom: state.zoom || 1,
                  scrollX: state.scrollX ?? defaultScrollX,
                  density: state.density || 'default',
                }
              : r
          )
        }
      },
      partialize: (s) => ({
        warRooms: s.warRooms,
        activeWarRoomId: s.activeWarRoomId,
        events: s.events,
        chapters: s.chapters,
        connections: s.connections,
        stickyNotes: s.stickyNotes,
        peopleDb: s.peopleDb,
        zoom: s.zoom,
        scrollX: s.scrollX,
        density: s.density,
        showConnections: s.showConnections,
        theme: s.theme,
      }),
    }
  )
)

export { TIMELINE_START, TIMELINE_END }
export default useStore
