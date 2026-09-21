import type { Story } from '../api/client'
import NovelContentEditor from './NovelContentEditor'

interface StoryContentEditorProps {
  story: Story
  onBack: () => void
  onOpenBook: (bookId: number, chapterId?: number) => void
}

function StoryContentEditor({ story, onBack, onOpenBook }: StoryContentEditorProps) {
  switch (story.storyType) {
    case 'NOVEL':
      return <NovelContentEditor story={story} onBack={onBack} onOpenBook={onOpenBook} />
    default:
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
          <p className="empty">
            Content editing for <strong>{story.storyType}</strong> stories is not implemented yet.
          </p>
        </div>
      )
  }
}

export default StoryContentEditor