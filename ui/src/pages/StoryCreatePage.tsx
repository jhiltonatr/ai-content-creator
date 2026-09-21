import { useNavigate } from 'react-router-dom'
import { createStory, type StoryInput } from '../api/client'
import StoryForm from '../components/StoryForm'

function StoryCreatePage() {
  const navigate = useNavigate()

  async function handleCreate(input: StoryInput) {
    const story = await createStory(input)
    navigate(`/stories/${story.id}/content`)
  }

  return (
    <>
      <h2>New story</h2>
      <StoryForm onSubmit={handleCreate} onCancel={() => navigate('/')} />
    </>
  )
}

export default StoryCreatePage