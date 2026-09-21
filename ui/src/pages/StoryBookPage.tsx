import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { fetchStory, type Story } from '../api/client'
import NovelBookEditor from '../components/NovelBookEditor'

function StoryBookPage() {
  const navigate = useNavigate()
  const { storyId, bookId } = useParams()
  const [searchParams] = useSearchParams()
  const storyIdNum = Number(storyId)
  const bookIdNum = Number(bookId)
  const focusChapterId = Number(searchParams.get('chapter')) || undefined
  const [story, setStory] = useState<Story | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchStory(storyIdNum)
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
  }, [storyIdNum])

  if (error) {
    return (
      <div>
        <div className="content-editor-header">
          <button type="button" className="button" onClick={() => navigate(`/stories/${storyIdNum}/content`)}>
            Back to content
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
    <NovelBookEditor
      story={story}
      bookId={bookIdNum}
      focusChapterId={focusChapterId}
      onBack={() => navigate(`/stories/${storyIdNum}/content`)}
      onDeleted={() => navigate(`/stories/${storyIdNum}/content`)}
    />
  )
}

export default StoryBookPage