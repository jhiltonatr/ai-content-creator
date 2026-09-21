import { useCallback, useEffect, useState } from 'react'
import {
  createStory,
  deleteStory,
  fetchStories,
  updateStory,
  type Story,
  type StoryInput,
} from './api/client'
import ConfirmDialog from './components/ConfirmDialog'
import StoryContentEditor from './components/StoryContentEditor'
import StoryForm from './components/StoryForm'
import StoryList from './components/StoryList'
import './index.css'

type View = { name: 'list' } | { name: 'create' } | { name: 'edit'; story: Story } | { name: 'content'; story: Story }

function App() {
  const [stories, setStories] = useState<Story[]>([])
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<View>({ name: 'list' })
  const [pendingDelete, setPendingDelete] = useState<Story | null>(null)

  const refresh = useCallback(() => {
    fetchStories()
      .then((data) => setStories(data))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function handleCreate(input: StoryInput) {
    const story = await createStory(input)
    setView({ name: 'content', story })
  }

  async function handleUpdate(input: StoryInput) {
    if (view.name !== 'edit') {
      return
    }
    await updateStory(view.story.id, input)
    setView({ name: 'list' })
    refresh()
  }

  async function handleDeleteConfirm() {
    if (pendingDelete === null) {
      return
    }
    await deleteStory(pendingDelete.id)
    setPendingDelete(null)
    refresh()
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>AI Content Creator</h1>
        <p>Editor workspace for novels, RPG-style stories and more</p>
      </header>
      <main>
        {view.name === 'list' && (
          <>
            <div className="list-header">
              <h2>Stories</h2>
              <button type="button" className="button button-primary" onClick={() => setView({ name: 'create' })}>
                New story
              </button>
            </div>
            {error && <p className="error">{error}</p>}
            <StoryList
              stories={stories}
              onEdit={(story) => setView({ name: 'edit', story })}
              onDelete={(story) => setPendingDelete(story)}
            />
          </>
        )}
        {view.name === 'create' && (
          <>
            <h2>New story</h2>
            <StoryForm onSubmit={handleCreate} onCancel={() => setView({ name: 'list' })} />
          </>
        )}
        {view.name === 'edit' && (
          <>
            <h2>Edit story</h2>
            <StoryForm
              initial={view.story}
              onSubmit={handleUpdate}
              onCancel={() => setView({ name: 'list' })}
            />
          </>
        )}
        {view.name === 'content' && (
          <StoryContentEditor story={view.story} onBack={() => setView({ name: 'list' })} />
        )}
      </main>
      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete story?"
        message={`Are you sure you want to delete "${pendingDelete?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}

export default App