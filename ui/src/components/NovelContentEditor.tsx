import { useEffect, useMemo, useState } from 'react'
import {
  createBook,
  deleteBook,
  fetchBooks,
  reorderBooks,
  type BookDetails,
  type Story,
} from '../api/client'
import ConfirmDialog from './ConfirmDialog'

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

interface NovelContentEditorProps {
  story: Story
  onBack: () => void
  onOpenBook: (bookId: number, chapterId?: number) => void
}

function NovelContentEditor({ story, onBack, onOpenBook }: NovelContentEditorProps) {
  const [books, setBooks] = useState<BookDetails[] | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [search, setSearch] = useState('')
  const [openBookId, setOpenBookId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<BookDetails | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchBooks(story.id)
      .then((data) => {
        if (!cancelled) {
          setBooks(data)
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
  }, [story.id])

  const query = search.trim().toLowerCase()
  const filtered = useMemo(() => {
    return (books ?? []).filter((book) => !query || book.title.toLowerCase().includes(query))
  }, [books, query])

  function toggleBook(bookId: number) {
    setOpenBookId((prev) => (prev === bookId ? null : bookId))
  }

  async function handleAddBook() {
    try {
      setError(null)
      const created = await createBook(story.id, newTitle.trim())
      setBooks((prev) => [...(prev ?? []), created])
      setNewTitle('')
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  async function handleMove(index: number, direction: -1 | 1) {
    if (books === null) {
      return
    }
    const target = index + direction
    if (target < 0 || target >= books.length) {
      return
    }
    const original = books
    const next = [...books]
    ;[next[index], next[target]] = [next[target], next[index]]
    setBooks(next)
    try {
      await reorderBooks(story.id, next.map((book) => book.id))
    } catch (err) {
      setError(errorMessage(err))
      setBooks(original)
    }
  }

  async function handleDeleteConfirm() {
    if (pendingDelete === null) {
      return
    }
    try {
      setError(null)
      await deleteBook(story.id, pendingDelete.id)
      setBooks((prev) => (prev ?? []).filter((book) => book.id !== pendingDelete.id))
      setOpenBookId((prev) => (prev === pendingDelete.id ? null : prev))
      setPendingDelete(null)
    } catch (err) {
      setError(errorMessage(err))
      setPendingDelete(null)
    }
  }

  return (
    <div>
      <div className="content-editor-header">
        <button type="button" className="button" onClick={onBack}>
          Back to stories
        </button>
      </div>
      <h2>{story.title}</h2>
      <p className="story-meta">
        <span className="badge">{story.storyType}</span>
      </p>
      {error && <p className="error">{error}</p>}
      <form className="add-book-form" onSubmit={(e) => e.preventDefault()}>
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="New book title"
        />
        <button type="button" className="button button-primary" onClick={handleAddBook}>
          Add book
        </button>
      </form>
      <div className="content-toolbar">
        <input
          className="search-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search books by title..."
        />
      </div>
      {books === null ? (
        <p className="empty">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="empty">
          {books.length === 0
            ? 'No books yet. Add one to organize this novel.'
            : 'No books match your search.'}
        </p>
      ) : (
        <ul className="accordion">
          {filtered.map((book) => {
            const bookIndex = books.findIndex((entry) => entry.id === book.id)
            const filteredIndex = filtered.findIndex((entry) => entry.id === book.id)
            const open = openBookId === book.id
            const count = book.chapters.length
            return (
              <li key={book.id} className={`accordion-item${open ? ' open' : ''}`}>
                <div className="accordion-header">
                  <button
                    type="button"
                    className="accordion-toggle"
                    onClick={() => toggleBook(book.id)}
                    aria-expanded={open}
                  >
                    <span className={`chevron${open ? ' down' : ''}`}>▸</span>
                    <span className="accordion-title">{book.title}</span>
                    <span className="chapter-count">
                      {count} chapter{count === 1 ? '' : 's'}
                    </span>
                  </button>
                  <div className="accordion-actions">
                    <button
                      type="button"
                      className="button icon-button"
                      disabled={filteredIndex === 0}
                      title="Move up"
                      onClick={() => handleMove(bookIndex, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="button icon-button"
                      disabled={filteredIndex === filtered.length - 1}
                      title="Move down"
                      onClick={() => handleMove(bookIndex, 1)}
                    >
                      ↓
                    </button>
                    <button type="button" className="button" onClick={() => onOpenBook(book.id)}>
                      Open
                    </button>
                    <button
                      type="button"
                      className="button button-danger-outline"
                      onClick={() => setPendingDelete(book)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {open && (
                  <div className="accordion-body">
                    {book.chapters.length === 0 ? (
                      <p className="empty">No chapters yet.</p>
                    ) : (
                      <ul className="chapter-links">
                        {book.chapters.map((chapter, index) => (
                          <li key={chapter.id}>
                            <button
                              type="button"
                              className="chapter-link"
                              onClick={() => onOpenBook(book.id, chapter.id)}
                            >
                              <span className="chapter-index">{index + 1}.</span> {chapter.title}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete book?"
        message={`Delete "${pendingDelete?.title}" and all its chapters? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}

export default NovelContentEditor