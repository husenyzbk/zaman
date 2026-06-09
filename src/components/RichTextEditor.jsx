import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect } from 'react'

function ToolbarBtn({ onMouseDown, active, title, children }) {
  return (
    <button
      type="button"
      onMouseDown={onMouseDown}
      title={title}
      className="px-2 py-1 rounded text-xs font-medium transition-colors select-none"
      style={{
        background: active ? '#6366f122' : 'transparent',
        color: active ? '#818cf8' : '#6b7280',
      }}
    >
      {children}
    </button>
  )
}

export default function RichTextEditor({ value, onChange, placeholder, minHeight = 72 }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: placeholder || '' }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: { class: 'tiptap-editor outline-none text-sm text-white leading-relaxed' },
    },
  })

  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      const current = editor.getHTML()
      if (value !== current) {
        editor.commands.setContent(value || '', false)
      }
    }
  }, [value, editor])

  useEffect(() => {
    return () => { editor?.destroy() }
  }, [editor])

  if (!editor) return null

  return (
    <div className="bg-[var(--bg-base)] border border-[var(--border)] rounded-lg overflow-hidden focus-within:border-indigo-500 transition-colors">
      <div className="flex items-center gap-0.5 px-1.5 py-1 border-b border-[var(--border)]">
        <ToolbarBtn
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBold().run() }}
          active={editor.isActive('bold')}
          title="Bold"
        >
          <strong>B</strong>
        </ToolbarBtn>
        <ToolbarBtn
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleItalic().run() }}
          active={editor.isActive('italic')}
          title="Italic"
        >
          <em>I</em>
        </ToolbarBtn>
        <span className="w-px h-3.5 bg-[var(--border)] mx-1" />
        <ToolbarBtn
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBulletList().run() }}
          active={editor.isActive('bulletList')}
          title="Bullet list"
        >
          • List
        </ToolbarBtn>
        <ToolbarBtn
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleOrderedList().run() }}
          active={editor.isActive('orderedList')}
          title="Numbered list"
        >
          1. List
        </ToolbarBtn>
      </div>
      <div style={{ minHeight }} className="px-3 py-2">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
