import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { fetchStory, type Story } from '../api/client'
import StoryContentEditor from '../components/StoryContentEditor'

function StoryContentPage() {
  const navigate = useNavigate()
  const { storyId } = useParams()
  const id = Number(storyId)
  const [story, setStory] = useState<Story | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchStory(id)
      .then((data) => {
        if (!cancelled) {
          setStory(data)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
        }
      })
    return () => {
      cancelled = true
    }
  }, [id])

  if (error) {
    return (
      <div>
        <div className="content-editor-header">
          <button type="button" className="button" onClick={() => navigate('/')}>
            Back to stories
          </button>
        </div>
        <p className="error">{error}</p>
      </div>
    )
  }

  if (story === null) {
    return <p className="empty">Loading...</p>
  }

  return (
    <StoryContentEditor
      story={story}
      onBack={() => navigate('/')}
      onOpenBook={(bookId, chapterId) =>
        navigate(
          chapterId !== undefined
            ? `/stories/${id}/books/${bookId}?chapter=${chapterId}`
            : `/stories/${id}/books/${bookId}`,
        )
      }
    />
  )
}

export default StoryContentPage