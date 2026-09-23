import { useCallback, useEffect, useState } from 'react';
import { api, authToken, setAuthToken } from './api/client';
import type { Me, UserSettings } from './api/types';
import StoryList from './pages/StoryList';
import Workspace from './pages/Workspace';
import StoryDashboard from './pages/StoryDashboard';
import AdminUsers from './pages/AdminUsers';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Header from './components/Header';

export default function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [route, setRoute] = useState<string>(() => window.location.hash);
  const [token, setToken] = useState<string | null>(() => authToken());
  const [settings, setSettings] = useState<UserSettings>({ language: null, theme: 'DARK' });

  useEffect(() => {
    const onHash = () => {
      setRoute(window.location.hash);
      setToken(authToken());
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const reloadMe = useCallback(() => {
    if (!token) {
      setMe(null);
      return;
    }
    api
      .me()
      .then(setMe)
      .catch(() => setMe(null));
  }, [token]);

  useEffect(() => {
    reloadMe();
  }, [reloadMe, route]);

  useEffect(() => {
    if (!token) {
      setSettings({ language: null, theme: 'DARK' });
      return;
    }
    api.getSettings().then(setSettings).catch(() => {});
  }, [token]);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme === 'LIGHT' ? 'light' : 'dark';
  }, [settings]);

  const onAuthed = () => {
    setToken(authToken());
    window.location.hash = '';
  };

  const onLogout = () => {
    api.logout().catch(() => {});
    setAuthToken(null);
    setToken(null);
    setMe(null);
    window.location.hash = '#/login';
  };

  const storyMatch = route.match(/^#\/story\/(\d+)(?:\/(dashboard|node\/(\d+)))?$/);
  const storyRoute = storyMatch
    ? {
        storyId: Number(storyMatch[1]),
        dashboard: storyMatch[2] === 'dashboard',
        nodeId: storyMatch[3] ? Number(storyMatch[3]) : null,
      }
    : null;
  const storyId = storyRoute?.storyId ?? null;
  const myRole = storyId === null ? null : (me?.stories.find((s) => s.storyId === storyId)?.role ?? null);
  const isAdmin = me?.user.systemRole === 'ADMIN';

  useEffect(() => {
    if (route.startsWith('#/admin') && me && !isAdmin) {
      window.location.hash = '';
    }
  }, [route, me, isAdmin]);

  if (!token || route.startsWith('#/login')) {
    return (
      <div className="app">
        <main>
          <Login onAuthed={onAuthed} />
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <Header
        me={me}
        isAdmin={isAdmin}
        inStory={storyId !== null && !Number.isNaN(storyId)}
        onHome={() => {
          window.location.hash = '';
        }}
        onLogout={onLogout}
      />
      <main>
        {route.startsWith('#/admin') ? (
          <AdminUsers meId={me?.user.id ?? null} />
        ) : route.startsWith('#/profile') ? (
          <Profile me={me} onProfileUpdated={reloadMe} />
        ) : route.startsWith('#/settings') ? (
          <Settings settings={settings} onSettings={setSettings} />
        ) : route.startsWith('#/story/') && storyRoute && storyRoute.storyId !== null ? (
          myRole === 'VIEWER' || !storyRoute.dashboard ? (
            <Workspace
              key={`story-${storyRoute.storyId}-${me?.user.id ?? 'anon'}`}
              storyId={storyRoute.storyId}
              myRole={myRole}
              initialNodeId={storyRoute.nodeId}
            />
          ) : (
            <StoryDashboard
              key={`dash-${storyRoute.storyId}-${me?.user.id ?? 'anon'}`}
              storyId={storyRoute.storyId}
              myRole={myRole}
            />
          )
        ) : (
          <StoryList />
        )}
      </main>
    </div>
  );
}