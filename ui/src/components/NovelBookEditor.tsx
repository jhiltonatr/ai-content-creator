import { useEffect, useState } from 'react'
import {
  createChapter,
  deleteBook,
  deleteChapter,
  fetchBook,
  updateBook,
  updateChapter,
  type BookDetails,
  type Chapter,
  type Story,
} from '../api/client'
import ConfirmDialog from './ConfirmDialog'

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

interface ChapterEditorProps {
  storyId: number
  bookId: number
  chapter: Chapter
  onSaved: (chapter: Chapter) => void
  onDeleted: (chapterId: number) => void
  onCancel: () => void
}

function ChapterEditor({ storyId, bookId, chapter, onSaved, onDeleted, onCancel }: ChapterEditorProps) {
  const [title, setTitle] = useState(chapter.title)
  const [content, setContent] = useState(chapter.content)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const dirty = title.trim() !== chapter.title || content !== chapter.content

  async function handleSave() {
    try {
      setPending(true)
      setError(null)
      const updated = await updateChapter(storyId, bookId, chapter.id, {
        title: title.trim() || 'Untitled chapter',
        content,
      })
      onSaved(updated)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setPending(false)
    }
  }

  async function handleDelete() {
    try {
      setError(null)
      await deleteChapter(storyId, bookId, chapter.id)
      onDeleted(chapter.id)
    } catch (err) {
      setError(errorMessage(err))
      setConfirmDelete(false)
    }
  }

  return (
    <div className="chapter-editor">
      <div className="chapter-editor-row">
        <input
          className="chapter-title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Chapter title"
        />
        <button type="button" className="button" disabled={!dirty || pending} onClick={handleSave}>
          Save
        </button>
        <button type="button" className="button" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="button button-danger-outline" onClick={() => setConfirmDelete(true)}>
          Delete
        </button>
      </div>
      <textarea
        className="chapter-content-input"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={10}
        placeholder="Write the chapter text here..."
      />
      {error && <p className="error">{error}</p>}
      <ConfirmDialog
        open={confirmDelete}
        title="Delete chapter?"
        message={`Delete "${title.trim() || chapter.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}

function chapterWordCount(content: string): number {
  return content.trim() ? content.trim().split(/\s+/).length : 0
}

interface NovelBookEditorProps {
  story: Story
  bookId: number
  focusChapterId?: number
  onBack: () => void
  onDeleted: () => void
}

function NovelBookEditor({ story, bookId, focusChapterId, onBack, onDeleted }: NovelBookEditorProps) {
  const [book, setBook] = useState<BookDetails | null>(null)
  const [newChapterTitle, setNewChapterTitle] = useState('')
  const [openChapterId, setOpenChapterId] = useState<number | null>(focusChapterId ?? null)
  const [editingChapterId, setEditingChapterId] = useState<number | null>(null)
  const [confirmingChapterId, setConfirmingChapterId] = useState<number | null>(null)
  const [confirmBookDelete, setConfirmBookDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchBook(story.id, bookId)
      .then((data) => {
        if (!cancelled) {
          setBook(data)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(errorMessage(err))
        }
      })
    return () => {
      cancelled = true
    }
  }, [story.id, bookId])

  function toggleChapter(chapterId: number) {
    setOpenChapterId((prev) => (prev === chapterId ? null : chapterId))
    setEditingChapterId((prev) => (prev === chapterId ? null : prev))
    setConfirmingChapterId(null)
  }

  async function handleRename() {
    if (book === null) {
      return
    }
    try {
      setPending(true)
      setError(null)
      const updated = await updateBook(story.id, book.id, book.title.trim() || book.title)
      setBook(updated)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setPending(false)
    }
  }

  async function handleAddChapter() {
    if (book === null) {
      return
    }
    try {
      setError(null)
      const created = await createChapter(story.id, book.id, {
        title: newChapterTitle.trim() || 'Untitled chapter',
        content: '',
      })
      setBook((prev) => (prev ? { ...prev, chapters: [...prev.chapters, created] } : prev))
      setNewChapterTitle('')
      setOpenChapterId(created.id)
      setEditingChapterId(created.id)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  function replaceChapter(updated: Chapter) {
    setBook((prev) =>
      prev ? { ...prev, chapters: prev.chapters.map((c) => (c.id === updated.id ? updated : c)) } : prev,
    )
    setEditingChapterId((prev) => (prev === updated.id ? null : prev))
  }

  function removeChapter(chapterId: number) {
    setBook((prev) => (prev ? { ...prev, chapters: prev.chapters.filter((c) => c.id !== chapterId) } : prev))
    setOpenChapterId((prev) => (prev === chapterId ? null : prev))
    setEditingChapterId((prev) => (prev === chapterId ? null : prev))
    setConfirmingChapterId((prev) => (prev === chapterId ? null : prev))
  }

  async function handleDeleteBook() {
    try {
      setError(null)
      await deleteBook(story.id, bookId)
      onDeleted()
    } catch (err) {
      setError(errorMessage(err))
      setConfirmBookDelete(false)
    }
  }

  return (
    <div>
      <div className="content-editor-header">
        <button type="button" className="button" onClick={onBack}>
          Back to content
        </button>
      </div>
      <p className="story-meta">
        <span className="badge">{story.storyType}</span>
        <span>{story.title}</span>
      </p>
      {error && <p className="error">{error}</p>}
      {book === null ? (
        <p className="empty">Loading...</p>
      ) : (
        <>
          <div className="book-editor-header">
            <input
              className="book-title-input"
              value={book.title}
              onChange={(e) => setBook((prev) => (prev ? { ...prev, title: e.target.value } : prev))}
              placeholder="Book title"
            />
            <button
              type="button"
              className="button"
              disabled={!book.title.trim() || pending}
              onClick={handleRename}
            >
              Rename
            </button>
            <button
              type="button"
              className="button button-danger-outline"
              onClick={() => setConfirmBookDelete(true)}
            >
              Delete book
            </button>
          </div>
          <form className="add-chapter-form" onSubmit={(e) => e.preventDefault()}>
            <input
              value={newChapterTitle}
              onChange={(e) => setNewChapterTitle(e.target.value)}
              placeholder="New chapter title"
            />
            <button type="button" className="button button-primary" onClick={handleAddChapter}>
              Add chapter
            </button>
          </form>
          {book.chapters.length === 0 ? (
            <p className="empty">No chapters yet. Add one to start writing this book.</p>
          ) : (
            <ul className="accordion">
              {book.chapters.map((chapter, index) => {
                const open = openChapterId === chapter.id
                const editing = editingChapterId === chapter.id
                return (
                  <li key={chapter.id} className={`accordion-item${open ? ' open' : ''}`}>
                    <div className="accordion-header">
                      <button
                        type="button"
                        className="accordion-toggle"
                        onClick={() => toggleChapter(chapter.id)}
                        aria-expanded={open}
                      >
                        <span className={`chevron${open ? ' down' : ''}`}>▸</span>
                        <span className="accordion-title">
                          {index + 1}. {chapter.title}
                        </span>
                        <span className="chapter-count">
                          {chapterWordCount(chapter.content)} words
                        </span>
                      </button>
                      <div className="accordion-actions">
                        <button
                          type="button"
                          className="button"
                          onClick={() => {
                            setOpenChapterId(chapter.id)
                            setEditingChapterId(chapter.id)
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="button button-danger-outline"
                          onClick={() => setConfirmingChapterId(chapter.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    {open && (
                      <div className="accordion-body">
                        {editing ? (
                          <ChapterEditor
                            storyId={story.id}
                            bookId={book.id}
                            chapter={chapter}
                            onSaved={replaceChapter}
                            onDeleted={removeChapter}
                            onCancel={() => setEditingChapterId(null)}
                          />
                        ) : (
                          <div className="chapter-read">
                            {chapter.content.trim() ? (
                              <p>{chapter.content}</p>
                            ) : (
                              <p className="empty">This chapter is empty.</p>
                            )}
                            <button
                              type="button"
                              className="button"
                              onClick={() => setEditingChapterId(chapter.id)}
                            >
                              Edit
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
      <ConfirmDialog
        open={confirmBookDelete}
        title="Delete book?"
        message={`Delete "${book?.title}" and all its chapters? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDeleteBook}
        onCancel={() => setConfirmBookDelete(false)}
      />
      <ConfirmDialog
        open={confirmingChapterId !== null}
        title="Delete chapter?"
        message={`Delete the selected chapter? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => {
          if (confirmingChapterId !== null) {
            removeChapter(confirmingChapterId)
          }
        }}
        onCancel={() => setConfirmingChapterId(null)}
      />
    </div>
  )
}

export default NovelBookEditor