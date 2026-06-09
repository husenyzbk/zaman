import { useState, useEffect } from 'react'
import Header from './components/Header'
import Timeline from './components/Timeline'
import GraphView from './components/GraphView'
import EntityForm from './components/EntityForm'
import WarRoomSidebar from './components/WarRoomSidebar'
import TextImportModal from './components/TextImportModal'
import useStore from './store/useStore'

export default function App() {
  const { addEvent, addChapter, warRooms, activeWarRoomId, theme, view } = useStore()
  const [newEventForm, setNewEventForm] = useState(false)
  const [newChapterForm, setNewChapterForm] = useState(false)
  const [warRoomSidebarOpen, setWarRoomSidebarOpen] = useState(false)
  const [textImportOpen, setTextImportOpen] = useState(false)

  const activeRoom = warRooms.find((r) => r.id === activeWarRoomId)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  return (
    <div className="flex flex-col h-screen" style={{ background: 'var(--bg-base)' }}>
      <Header
        onNewEvent={() => setNewEventForm(true)}
        onNewChapter={() => setNewChapterForm(true)}
        onToggleWarRooms={() => setWarRoomSidebarOpen((v) => !v)}
        onOpenTextImport={() => setTextImportOpen(true)}
        activeWarRoomName={activeRoom?.name}
        activeWarRoomColor={activeRoom?.color}
      />

      {view === 'graph' ? <GraphView /> : <Timeline />}

      <WarRoomSidebar isOpen={warRoomSidebarOpen} onClose={() => setWarRoomSidebarOpen(false)} />

      {textImportOpen && <TextImportModal onClose={() => setTextImportOpen(false)} />}

      {newEventForm && (
        <EntityForm
          type="event"
          initial={{}}
          onSave={(form) => { addEvent(form); setNewEventForm(false) }}
          onClose={() => setNewEventForm(false)}
        />
      )}
      {newChapterForm && (
        <EntityForm
          type="chapter"
          initial={{}}
          onSave={(form) => { addChapter(form); setNewChapterForm(false) }}
          onClose={() => setNewChapterForm(false)}
        />
      )}
    </div>
  )
}
