import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Story, StoryType } from '../api/types';

const STORY_TYPES: { value: StoryType; label: string }[] = [
  { value: 'NOVEL', label: 'Novel' },
  { value: 'RPG', label: 'RPG-like game' },
  { value: 'SCRIPT', label: 'TV/Movie script' },
];

export default function StoryList() {
  const [stories, setStories] = useState<Story[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [storyType, setStoryType] = useState<StoryType>('NOVEL');
  const [synopsis, setSynopsis] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    api.stories().then(setStories).catch((e) => setMessage(e.message));
  }, []);

  useEffect(load, [load]);

  const create = async () => {
    try {
      const story = await api.createStory({ title, storyType, synopsis });
      setShowCreate(false);
      setTitle('');
      setSynopsis('');
      window.location.hash = `#/story/${story.id}`;
    } catch (e) {
      setMessage((e as Error).message);
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>Your stories</h1>
        <button className="primary" onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? 'Cancel' : 'New story'}
        </button>
      </div>
      {message && <div className="banner error">{message}</div>}
      {showCreate && (
        <div className="card">
          <div className="field">
            <label>Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="A story has many names" />
          </div>
          <div className="field">
            <label>Type</label>
            <select value={storyType} onChange={(e) => setStoryType(e.target.value as StoryType)}>
              {STORY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Synopsis</label>
            <textarea value={synopsis} onChange={(e) => setSynopsis(e.target.value)} rows={3} />
          </div>
          <button className="primary" disabled={!title.trim()} onClick={create}>
            Create
          </button>
        </div>
      )}
      {stories.length === 0 && <p className="muted">No stories yet.</p>}
      <ul className="story-grid">
        {stories.map((s) => (
          <li key={s.id} className="card story-card" onClick={() => (window.location.hash = `#/story/${s.id}`)}>
            <div className="story-card-top">
              <span className="badge">{s.storyType}</span>
              <span className="badge role">{s.myRole}</span>
            </div>
            <strong>{s.title}</strong>
            {s.myRole === 'VIEWER' && <div className="muted small">published content only</div>}
            {s.synopsis && <p className="muted">{s.synopsis}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}