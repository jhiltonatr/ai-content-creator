import type { Me } from '../api/types';

interface HeaderProps {
  me: Me | null;
  isAdmin: boolean;
  inStory: boolean;
  onHome: () => void;
  onLogout: () => void;
}

export default function Header({ me, isAdmin, inStory, onHome, onLogout }: HeaderProps) {
  return (
    <header className="header">
      <div className="header-title" onClick={onHome} role="button">
        <span className="brand">
          <img className="brand-icon" src="/app-icon.svg" width="20" height="20" alt="StoryForge" />
          Storyforge
        </span>
        {inStory && <button className="linkish">← Stories</button>}
      </div>
      <div className="header-right">
        {me && (
          <span className="who">
            {me.user.displayName} ({me.user.email})
            {isAdmin && <span className="tag">admin</span>}
          </span>
        )}
        <button className="small" onClick={() => (window.location.hash = '#/profile')}>
          Profile
        </button>
        <button className="small" onClick={() => (window.location.hash = '#/settings')}>
          Settings
        </button>
        {isAdmin && (
          <button className="small" onClick={() => (window.location.hash = '#/admin')}>
            Admin
          </button>
        )}
        <button className="small" onClick={onLogout}>
          Sign out
        </button>
      </div>
    </header>
  );
}