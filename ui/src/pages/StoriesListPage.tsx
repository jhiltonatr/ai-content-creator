import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { deleteStory, fetchStories, type Story } from '../api/client'
import ConfirmDialog from '../components/ConfirmDialog'
import StoryList from '../components/StoryList'

function StoriesListPage() {
  const navigate = useNavigate()
  const [stories, setStories] = useState<Story[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Story | null>(null)

  const refresh = useCallback(() => {
    fetchStories()
      .then((data) => setStories(data))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function handleDeleteConfirm() {
    if (pendingDelete === null) {
      return
    }
    try {
      await deleteStory(pendingDelete.id)
      setPendingDelete(null)
      refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <>
      <div className="list-header">
        <h2>Stories</h2>
        <button type="button" className="button button-primary" onClick={() => navigate('/stories/new')}>
          New story
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      <StoryList
        stories={stories}
        onOpenContent={(story) => navigate(`/stories/${story.id}/content`)}
        onEdit={(story) => navigate(`/stories/${story.id}/edit`)}
        onDelete={(story) => setPendingDelete(story)}
      />
      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete story?"
        message={`Are you sure you want to delete "${pendingDelete?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  )
}

export default StoriesListPage