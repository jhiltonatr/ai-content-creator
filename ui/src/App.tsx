import { useEffect, useState } from 'react';
import { api, currentUserId, setCurrentUserId } from './api/client';
import type { Me } from './api/types';
import StoryList from './components/StoryList';
import Workspace from './components/Workspace';
import Header from './components/Header';

const DEMO_USERS = [
  { id: 1, label: 'Alice (owner)' },
  { id: 2, label: 'Bob (collaborator)' },
  { id: 3, label: 'Carol (editor)' },
];

export default function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [route, setRoute] = useState<string>(() => window.location.hash);
  const [userId, setUserId] = useState<number>(() => currentUserId());

  useEffect(() => {
    const onHash = () => setRoute(window.location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    api.me()
      .then(setMe)
      .catch(() => setMe(null));
  }, [userId, route]);

  const switchUser = (id: number) => {
    setCurrentUserId(id);
    setUserId(id);
  };

  const storyId = route.startsWith('#/story/') ? Number(route.slice('#/story/'.length)) : null;

  return (
    <div className="app">
      <Header
        me={me}
        userId={userId}
        demoUsers={DEMO_USERS}
        onSwitchUser={switchUser}
        inStory={storyId !== null && !Number.isNaN(storyId)}
        onHome={() => {
          window.location.hash = '';
        }}
      />
      <main>
        {route.startsWith('#/story/') && storyId !== null && !Number.isNaN(storyId) ? (
          <Workspace key={`story-${storyId}-${userId}`} storyId={storyId} myRole={
            me?.stories.find((s) => s.storyId === storyId)?.role ?? null
          } />
        ) : (
          <StoryList />
        )}
      </main>
    </div>
  );
}