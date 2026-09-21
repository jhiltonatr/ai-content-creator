import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { fetchStory, updateStory, type Story, type StoryInput } from '../api/client'
import StoryForm from '../components/StoryForm'

function StoryEditPage() {
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

  async function handleUpdate(input: StoryInput) {
    await updateStory(id, input)
    navigate('/')
  }

  if (error) {
    return (
      <>
        <h2>Edit story</h2>
        <p className="error">{error}</p>
      </>
    )
  }

  if (story === null) {
    return (
      <>
        <h2>Edit story</h2>
        <p className="empty">Loading...</p>
      </>
    )
  }

  return (
    <>
      <h2>Edit story</h2>
      <StoryForm initial={story} onSubmit={handleUpdate} onCancel={() => navigate('/')} />
    </>
  )
}

export default StoryEditPage