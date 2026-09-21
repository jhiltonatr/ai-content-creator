import type { Story } from '../api/client'

interface StoryContentEditorProps {
  story: Story
  onBack: () => void
}

function StoryContentEditor({ story, onBack }: StoryContentEditorProps) {
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
        Content editing for <strong>{story.storyType}</strong> stories is not implemented yet. This page is reserved
        for the story-content-edit spec.
      </p>
    </div>
  )
}

export default StoryContentEditor