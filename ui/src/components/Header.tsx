import type { Me } from '../api/types';

interface HeaderProps {
  me: Me | null;
  userId: number;
  demoUsers: { id: number; label: string }[];
  onSwitchUser: (id: number) => void;
  inStory: boolean;
  onHome: () => void;
}

export default function Header({ me, userId, demoUsers, onSwitchUser, inStory, onHome }: HeaderProps) {
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
          </span>
        )}
        <select value={userId} onChange={(e) => onSwitchUser(Number(e.target.value))} title="Act as user (MVP auth)">
          {demoUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label}
            </option>
          ))}
        </select>
      </div>
    </header>
  );
}
