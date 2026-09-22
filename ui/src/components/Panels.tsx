import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Character, Lore, Membership, Release, Role } from '../api/types';
import { emitCatalogChanged } from '../catalog';

interface PanelsProps {
  storyId: number;
  myRole: Role | null;
  canWrite: boolean;
  canPublish: boolean;
}

type Tab = 'characters' | 'lore' | 'members' | 'releases';

const TABS: { id: Tab; label: string }[] = [
  { id: 'characters', label: 'Characters' },
  { id: 'lore', label: 'Lore' },
  { id: 'members', label: 'Members' },
  { id: 'releases', label: 'Releases' },
];

function useMessage() {
  const [msg, setMsg] = useState<string | null>(null);
  const banner = msg ? (
    <div className="banner error" onClick={() => setMsg(null)}>
      {msg}
    </div>
  ) : null;
  return { msg, setMsg, banner };
}

function CharactersPanel({ storyId, canWrite }: { storyId: number; canWrite: boolean }) {
  const [items, setItems] = useState<Character[]>([]);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const { setMsg, banner } = useMessage();

  const load = useCallback(() => {
    api.characters(storyId).then(setItems).catch((e) => setMsg(e.message));
  }, [storyId, setMsg]);

  useEffect(load, [load]);

  const create = async () => {
    try {
      await api.createCharacter(storyId, { name, bio });
      setName('');
      setBio('');
      load();
      emitCatalogChanged(storyId);
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  return (
    <div className="panel">
      {banner}
      <ul className="plain">
        {items.map((c) => (
          <li key={c.id} className="card tight">
            <strong>{c.name}</strong>
            {c.bio && <p className="muted small">{c.bio}</p>}
            {canWrite && (
              <button
                className="small linkish"
                onClick={async () => {
                  const nextBio = window.prompt('Bio', c.bio ?? '') ?? null;
                  if (nextBio !== null) {
                    try {
                      await api.updateCharacter(storyId, c.id, { name: c.name, bio: nextBio });
                      load();
                      emitCatalogChanged(storyId);
                    } catch (e) {
                      setMsg((e as Error).message);
                    }
                  }
                }}
              >
                edit bio
              </button>
            )}
          </li>
        ))}
      </ul>
      {canWrite && (
        <div className="add-form">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Character name" />
          <input value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Short bio" />
          <button className="small primary" disabled={!name.trim()} onClick={create}>
            Add
          </button>
        </div>
      )}
    </div>
  );
}

function LorePanel({ storyId, canWrite }: { storyId: number; canWrite: boolean }) {
  const [items, setItems] = useState<Lore[]>([]);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [body, setBody] = useState('');
  const { setMsg, banner } = useMessage();

  const load = useCallback(() => {
    api.lore(storyId).then(setItems).catch((e) => setMsg(e.message));
  }, [storyId, setMsg]);

  useEffect(load, [load]);

  const create = async () => {
    try {
      await api.createLore(storyId, { title, category, body });
      setTitle('');
      setCategory('');
      setBody('');
      load();
      emitCatalogChanged(storyId);
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  return (
    <div className="panel">
      {banner}
      <ul className="plain">
        {items.map((l) => (
          <li key={l.id} className="card tight">
            <strong>{l.title}</strong>
            {l.category && <span className="badge">{l.category}</span>}
            {l.body && <p className="muted small">{l.body}</p>}
          </li>
        ))}
        {items.length === 0 && <li className="muted">No lore yet.</li>}
      </ul>
      {canWrite && (
        <div className="add-form">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
          <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Body" rows={3} />
          <button className="small primary" disabled={!title.trim()} onClick={create}>
            Add
          </button>
        </div>
      )}
    </div>
  );
}

function MembersPanel({ storyId, canWrite }: { storyId: number; canWrite: boolean }) {
  const [items, setItems] = useState<Membership[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('EDITOR');
  const { setMsg, banner } = useMessage();

  const load = useCallback(() => {
    api.members(storyId).then(setItems).catch((e) => setMsg(e.message));
  }, [storyId, setMsg]);

  useEffect(load, [load]);

  const add = async () => {
    try {
      await api.addMember(storyId, { email, role });
      setEmail('');
      load();
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  const changeRole = async (userId: number, nextRole: string) => {
    try {
      await api.updateMemberRole(storyId, userId, nextRole);
      load();
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  const remove = async (userId: number, displayName: string) => {
    if (!window.confirm(`Remove ${displayName}?`)) return;
    try {
      await api.removeMember(storyId, userId);
      load();
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  return (
    <div className="panel">
      {banner}
      <ul className="plain">
        {items.map((m) => (
          <li key={m.id} className="card tight member">
            <div>
              <strong>{m.displayName}</strong>
              <div className="muted small">{m.email}</div>
            </div>
            <select value={m.role} disabled={!canWrite} onChange={(e) => changeRole(m.userId, e.target.value)}>
              <option value="OWNER">owner</option>
              <option value="COLLABORATOR">collaborator</option>
              <option value="EDITOR">editor</option>
              <option value="VIEWER">viewer</option>
            </select>
            {canWrite && (
              <button className="small linkish" onClick={() => remove(m.userId, m.displayName)}>
                remove
              </button>
            )}
          </li>
        ))}
      </ul>
      {canWrite && (
        <div className="add-form">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" />
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="COLLABORATOR">collaborator</option>
            <option value="EDITOR">editor</option>
            <option value="VIEWER">viewer</option>
          </select>
          <button className="small primary" disabled={!email.trim()} onClick={add}>
            Add
          </button>
        </div>
      )}
    </div>
  );
}

function ReleasesPanel({ storyId, canPublish }: { storyId: number; canPublish: boolean }) {
  const [items, setItems] = useState<Release[]>([]);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [selected, setSelected] = useState<Release | null>(null);
  const { setMsg, banner } = useMessage();

  const load = useCallback(() => {
    api.releases(storyId).then(setItems).catch((e) => setMsg(e.message));
  }, [storyId, setMsg]);

  useEffect(load, [load]);

  const publish = async () => {
    try {
      await api.createRelease(storyId, { name, notes });
      setName('');
      setNotes('');
      load();
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  const nodeCount = (r: Release) => r.nodes?.length ?? 0;

  return (
    <div className="panel">
      {banner}
      {selected ? (
        <div>
          <button className="small linkish" onClick={() => setSelected(null)}>
            ← releases
          </button>
          <h4>
            v{selected.version} · {selected.name ?? 'untitled'}
          </h4>
          <ul className="plain">
            {selected.nodes?.map((n) => (
              <li key={n.id} className="card tight">
                <span className={`status-dot ${n.status === 'DONE' ? 'done' : ''}`} />
                {n.title}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div>
          <ul className="plain">
            {items.map((r) => (
              <li key={r.id} className="card tight release" onClick={() => setSelected(r)}>
                <div>
                  <strong>
                    v{r.version} {r.name && `· ${r.name}`}
                  </strong>
                  <div className="muted small">
                    {nodeCount(r)} nodes · {new Date(r.publishedAt).toLocaleString()}
                  </div>
                </div>
                <button
                  className="small linkish"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelected(r);
                  }}
                >
                  view
                </button>
              </li>
            ))}
            {items.length === 0 && <li className="muted">No releases yet.</li>}
          </ul>
          {canPublish && (
            <div className="add-form">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Release name" />
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" />
              <button className="small primary" onClick={publish}>
                Publish (snapshot of done nodes)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Panels({ storyId, myRole, canWrite, canPublish }: PanelsProps) {
  const [tab, setTab] = useState<Tab>('characters');

  return (
    <div className="panels">
      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'tab active' : 'tab'} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'characters' && <CharactersPanel storyId={storyId} canWrite={canWrite} />}
      {tab === 'lore' && <LorePanel storyId={storyId} canWrite={canWrite} />}
      {tab === 'members' && <MembersPanel storyId={storyId} canWrite={myRole === 'OWNER'} />}
      {tab === 'releases' && <ReleasesPanel storyId={storyId} canPublish={canPublish} />}
    </div>
  );
}