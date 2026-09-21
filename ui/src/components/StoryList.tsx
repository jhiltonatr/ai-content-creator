import type { Story } from '../api/client'
import { LANGUAGE_FLAGS } from '../constants'

interface StoryListProps {
  stories: Story[]
  onEdit: (story: Story) => void
  onDelete: (story: Story) => void
}

function StoryList({ stories, onEdit, onDelete }: StoryListProps) {
  if (stories.length === 0) {
    return <p className="empty">No stories yet.</p>
  }
  return (
    <ul className="story-list">
      {stories.map((story) => (
        <li key={story.id}>
          <div className="story-info">
            <strong>{story.title}</strong>
            <div className="story-meta">
              <span className="badge">{story.storyType}</span>
              <span className="genre">{story.genre}</span>
              <span className="flag" title={story.language}>
                {LANGUAGE_FLAGS[story.language]}
              </span>
            </div>
          </div>
          <div className="story-actions">
            <button type="button" className="button" onClick={() => onEdit(story)}>
              Edit
            </button>
            <button type="button" className="button button-danger-outline" onClick={() => onDelete(story)}>
              Delete
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}

export default StoryList