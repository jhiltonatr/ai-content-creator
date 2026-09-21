import { useState, type FormEvent } from 'react'
import type { Language, Story, StoryInput, StoryType } from '../api/client'
import { LANGUAGES, LANGUAGE_FLAGS, STORY_TYPES } from '../constants'
import ConfirmDialog from './ConfirmDialog'

interface StoryFormProps {
  initial?: Story
  onSubmit: (input: StoryInput) => void | Promise<void>
  onCancel: () => void
}

function StoryForm({ initial, onSubmit, onCancel }: StoryFormProps) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [storyType, setStoryType] = useState<StoryType>(initial?.storyType ?? 'NOVEL')
  const [genre, setGenre] = useState(initial?.genre ?? '')
  const [language, setLanguage] = useState<Language>(initial?.language ?? 'ENGLISH')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [tags, setTags] = useState(initial?.tags.join(', ') ?? '')
  const [error, setError] = useState<string | null>(null)
  const [pendingType, setPendingType] = useState<StoryType | null>(null)

  const isEditing = initial !== undefined

  function handleTypeChange(nextType: StoryType) {
    if (isEditing && nextType !== storyType) {
      setPendingType(nextType)
      return
    }
    setStoryType(nextType)
  }

  function handleTypeChangeConfirm() {
    if (pendingType !== null) {
      setStoryType(pendingType)
    }
    setPendingType(null)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const input: StoryInput = {
      title: title.trim(),
      storyType,
      genre: genre.trim(),
      language,
      description: description.trim() || undefined,
      tags: tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    }
    try {
      setError(null)
      await onSubmit(input)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <form className="story-form" onSubmit={handleSubmit}>
      {isEditing && (
        <label className="field">
          <span>Id</span>
          <input value={initial.id} disabled />
        </label>
      )}
      <label className="field">
        <span>Story title *</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </label>
      <label className="field">
        <span>Story type *</span>
        <select value={storyType} onChange={(e) => handleTypeChange(e.target.value as StoryType)}>
          {STORY_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Genre *</span>
        <input value={genre} onChange={(e) => setGenre(e.target.value)} required />
      </label>
      <label className="field">
        <span>Language *</span>
        <select value={language} onChange={(e) => setLanguage(e.target.value as Language)}>
          {LANGUAGES.map((lang) => (
            <option key={lang} value={lang}>
              {LANGUAGE_FLAGS[lang]} {lang}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Description</span>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
      </label>
      <label className="field">
        <span>Tags</span>
        <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="comma, separated, tags" />
      </label>
      {error && <p className="error">{error}</p>}
      <div className="form-actions">
        <button type="button" className="button" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="button button-primary">
          {isEditing ? 'Save story' : 'Create story'}
        </button>
      </div>
      <ConfirmDialog
        open={pendingType !== null}
        title="Change story type?"
        message="Changing the story type will reset its content. Do you want to continue?"
        confirmLabel="Continue"
        onConfirm={handleTypeChangeConfirm}
        onCancel={() => setPendingType(null)}
      />
    </form>
  )
}

export default StoryForm