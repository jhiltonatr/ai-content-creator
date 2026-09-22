import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import type { Character, CharacterSuggestion, Lore, LoreSuggestion, Membership, Release, Role } from '../api/types';
import { emitCatalogChanged } from '../catalog';
import { ExtractionResults, useExtraction } from './ExtractionSuggestions';
import Modal from './Modal';
import {
  emitSyncMentions,
  SYNC_MENTIONS_DONE_EVENT,
  type MentionSyncKind,
  type MentionSyncResult,
} from './mentionSync';

interface PanelsProps {
  storyId: number;
  nodeId: number | null;
  myRole: Role | null;
  canWrite: boolean;
  canPublish: boolean;
  tab: Tab;
  onTabChange: (tab: Tab) => void;
}

export type Tab = 'characters' | 'lore' | 'members' | 'releases';

export const TABS: { id: Tab; label: string }[] = [
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

function useSyncMentions(storyId: number, nodeId: number | null, kind: MentionSyncKind) {
  const [state, setState] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<MentionSyncResult>).detail;
      if (!detail || detail.storyId !== storyId || detail.nodeId !== nodeId || detail.kind !== kind) return;
      setState(
        detail.count > 0
          ? `Replaced ${detail.count} matching mention${detail.count === 1 ? '' : 's'} in the open chapter.`
          : 'No plain-text matches to replace in the open chapter.',
      );
    };
    window.addEventListener(SYNC_MENTIONS_DONE_EVENT, handler);
    return () => window.removeEventListener(SYNC_MENTIONS_DONE_EVENT, handler);
  }, [storyId, nodeId, kind]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setState(null);
  }, [storyId, nodeId, kind]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const sync = useCallback(() => {
    if (!nodeId) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setState('Syncing…');
    emitSyncMentions({ storyId, nodeId, kind });
    timerRef.current = setTimeout(() => {
      setState((prev) => (prev === 'Syncing…' ? null : prev));
    }, 3000);
  }, [storyId, nodeId, kind]);

  return { state, syncing: state === 'Syncing…', sync };
}

function PanelActions({
  canWrite,
  addLabel,
  onAdd,
  nodeId,
  busy,
  onExtract,
  onSync,
  syncing,
  extractHint,
  syncHint,
  helpText,
}: {
  canWrite: boolean;
  addLabel: string;
  onAdd: () => void;
  nodeId: number | null;
  busy: boolean;
  onExtract: () => void;
  onSync: () => void;
  syncing: boolean;
  extractHint: string;
  syncHint: string;
  helpText: string;
}) {
  if (!canWrite) return null;
  return (
    <div className="panel-actions">
      <button className="small primary" onClick={onAdd}>
        {addLabel}
      </button>
      <button className="small" disabled={!nodeId || busy} onClick={onExtract} title={extractHint}>
        {busy ? 'Extracting…' : 'Suggest from text'}
      </button>
      <button className="small" disabled={!nodeId} onClick={onSync} title={syncHint}>
        {syncing ? 'Syncing…' : 'Sync mentions'}
      </button>
      <span className="panel-help" title={helpText}>
        ?
      </span>
    </div>
  );
}

function addCharacter(storyId: number, item: CharacterSuggestion | LoreSuggestion) {
  const c = item as CharacterSuggestion;
  return api.createCharacter(storyId, { name: c.name, bio: c.bio });
}

function addLore(storyId: number, item: CharacterSuggestion | LoreSuggestion) {
  const l = item as LoreSuggestion;
  return api.createLore(storyId, { title: l.title, category: l.category, body: l.body });
}

function CharactersPanel({ storyId, nodeId, canWrite }: { storyId: number; nodeId: number | null; canWrite: boolean }) {
  const [items, setItems] = useState<Character[]>([]);
  const [draft, setDraft] = useState<{ id: number | null; name: string; bio: string } | null>(null);
  const { setMsg, banner } = useMessage();

  const load = useCallback(() => {
    api.characters(storyId).then(setItems).catch((e) => setMsg(e.message));
  }, [storyId, setMsg]);

  useEffect(load, [load]);

  const onAddSuggestion = useCallback(
    (item: CharacterSuggestion | LoreSuggestion) =>
      addCharacter(storyId, item).then(() => {
        load();
        emitCatalogChanged(storyId);
      }),
    [storyId, load],
  );

  const extraction = useExtraction(storyId, nodeId, 'characters', onAddSuggestion);
  const sync = useSyncMentions(storyId, nodeId, 'characters');

  const saveDraft = async () => {
    if (!draft?.name.trim()) return;
    try {
      if (draft.id === null) {
        await api.createCharacter(storyId, { name: draft.name, bio: draft.bio });
      } else {
        await api.updateCharacter(storyId, draft.id, { name: draft.name, bio: draft.bio });
      }
      setDraft(null);
      load();
      emitCatalogChanged(storyId);
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  const remove = async (id: number, name: string) => {
    if (!window.confirm(`Remove ${name}?`)) return;
    try {
      await api.deleteCharacter(storyId, id);
      load();
      emitCatalogChanged(storyId);
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  return (
    <div className="panel">
      {banner}
      <PanelActions
        canWrite={canWrite}
        addLabel="Add character"
        onAdd={() => setDraft({ id: null, name: '', bio: '' })}
        nodeId={nodeId}
        busy={extraction.busy}
        onExtract={extraction.extract}
        onSync={sync.sync}
        syncing={sync.syncing}
        extractHint="Extracts only characters from the selected node's saved prose. Suggestions only — add what fits."
        syncHint="Replaces plain-text characters in the open chapter with @-mentions."
        helpText={`Suggest from text — AI-picked characters from the selected node's saved prose; suggestions only, add what fits.\nSync mentions — replaces plain-text characters in the open chapter with @-mentions.`}
      />
      <ExtractionResults state={extraction} kind="characters" />
      {sync.state && sync.state !== 'Syncing…' && <div className="muted small sync-status">{sync.state}</div>}
      <ul className="plain">
        {items.map((c) => (
          <li key={c.id} className="card tight">
            <strong>{c.name}</strong>
            {c.bio && <p className="muted small">{c.bio}</p>}
            {canWrite && (
              <div className="actions">
                <button
                  className="small linkish"
                  onClick={() => setDraft({ id: c.id, name: c.name, bio: c.bio ?? '' })}
                >
                  edit
                </button>
                <button className="small linkish" onClick={() => remove(c.id, c.name)}>
                  remove
                </button>
              </div>
            )}
          </li>
        ))}
        {items.length === 0 && <li className="muted">No characters yet.</li>}
      </ul>
      {draft && (
        <Modal title={draft.id === null ? 'Add character' : `Edit ${draft.name}`} onClose={() => setDraft(null)}>
          <div className="modal-body">
            <div className="field">
              <label>Name</label>
              <input
                autoFocus
                value={draft.name}
                onChange={(e) => setDraft((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
                placeholder="Character name"
              />
            </div>
            <div className="field field-grow">
              <label>Bio</label>
              <textarea
                value={draft.bio}
                onChange={(e) => setDraft((prev) => (prev ? { ...prev, bio: e.target.value } : prev))}
                placeholder="Full bio, background, notes…"
              />
            </div>
          </div>
          <div className="modal-foot">
            <button className="small" onClick={() => setDraft(null)}>
              Cancel
            </button>
            <button className="small primary" disabled={!draft.name.trim()} onClick={saveDraft}>
              {draft.id === null ? 'Add' : 'Save'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function LorePanel({ storyId, nodeId, canWrite }: { storyId: number; nodeId: number | null; canWrite: boolean }) {
  const [items, setItems] = useState<Lore[]>([]);
  const [draft, setDraft] = useState<{ id: number | null; title: string; category: string; body: string } | null>(null);
  const { setMsg, banner } = useMessage();

  const load = useCallback(() => {
    api.lore(storyId).then(setItems).catch((e) => setMsg(e.message));
  }, [storyId, setMsg]);

  useEffect(load, [load]);

  const onAddSuggestion = useCallback(
    (item: CharacterSuggestion | LoreSuggestion) =>
      addLore(storyId, item).then(() => {
        load();
        emitCatalogChanged(storyId);
      }),
    [storyId, load],
  );

  const extraction = useExtraction(storyId, nodeId, 'lore', onAddSuggestion);
  const sync = useSyncMentions(storyId, nodeId, 'lore');

  const saveDraft = async () => {
    if (!draft?.title.trim()) return;
    try {
      if (draft.id === null) {
        await api.createLore(storyId, { title: draft.title, category: draft.category, body: draft.body });
      } else {
        await api.updateLore(storyId, draft.id, {
          title: draft.title,
          category: draft.category,
          body: draft.body,
        });
      }
      setDraft(null);
      load();
      emitCatalogChanged(storyId);
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  const remove = async (id: number, title: string) => {
    if (!window.confirm(`Remove ${title}?`)) return;
    try {
      await api.deleteLore(storyId, id);
      if (draft?.id === id) setDraft(null);
      load();
      emitCatalogChanged(storyId);
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  return (
    <div className="panel">
      {banner}
      <PanelActions
        canWrite={canWrite}
        addLabel="Add lore"
        onAdd={() => setDraft({ id: null, title: '', category: '', body: '' })}
        nodeId={nodeId}
        busy={extraction.busy}
        onExtract={extraction.extract}
        onSync={sync.sync}
        syncing={sync.syncing}
        extractHint="Extracts only lore from the selected node's saved prose. Suggestions only — add what fits."
        syncHint="Replaces plain-text lore in the open chapter with #-mentions."
        helpText={`Suggest from text — AI-picked lore from the selected node's saved prose; suggestions only, add what fits.\nSync mentions — replaces plain-text lore in the open chapter with #-mentions.`}
      />
      <ExtractionResults state={extraction} kind="lore" />
      {sync.state && sync.state !== 'Syncing…' && <div className="muted small sync-status">{sync.state}</div>}
      <ul className="plain">
        {items.map((l) => (
          <li key={l.id} className="card tight">
            <strong>{l.title}</strong>
            {l.category && <span className="badge">{l.category}</span>}
            {l.body && <p className="muted small">{l.body}</p>}
            {canWrite && (
              <div className="actions">
                <button
                  className="small linkish"
                  onClick={() => setDraft({ id: l.id, title: l.title, category: l.category ?? '', body: l.body ?? '' })}
                >
                  edit
                </button>
                <button className="small linkish" onClick={() => remove(l.id, l.title)}>
                  remove
                </button>
              </div>
            )}
          </li>
        ))}
        {items.length === 0 && <li className="muted">No lore yet.</li>}
      </ul>
      {draft && (
        <Modal title={draft.id === null ? 'Add lore' : `Edit ${draft.title}`} onClose={() => setDraft(null)}>
          <div className="modal-body">
            <div className="field">
              <label>Title</label>
              <input
                autoFocus
                value={draft.title}
                onChange={(e) => setDraft((prev) => (prev ? { ...prev, title: e.target.value } : prev))}
                placeholder="Entry title"
              />
            </div>
            <div className="field">
              <label>Category</label>
              <input
                value={draft.category}
                onChange={(e) => setDraft((prev) => (prev ? { ...prev, category: e.target.value } : prev))}
                placeholder="e.g. History, Magic, Places"
              />
            </div>
            <div className="field field-grow">
              <label>Body</label>
              <textarea
                value={draft.body}
                onChange={(e) => setDraft((prev) => (prev ? { ...prev, body: e.target.value } : prev))}
                placeholder="Full entry text…"
              />
            </div>
          </div>
          <div className="modal-foot">
            <button className="small" onClick={() => setDraft(null)}>
              Cancel
            </button>
            <button className="small primary" disabled={!draft.title.trim()} onClick={saveDraft}>
              {draft.id === null ? 'Add' : 'Save'}
            </button>
          </div>
        </Modal>
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

export default function Panels({ storyId, nodeId, myRole, canWrite, canPublish, tab, onTabChange }: PanelsProps) {
  return (
    <div className="panels">
      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'tab active' : 'tab'} onClick={() => onTabChange(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'characters' && <CharactersPanel storyId={storyId} nodeId={nodeId} canWrite={canWrite} />}
      {tab === 'lore' && <LorePanel storyId={storyId} nodeId={nodeId} canWrite={canWrite} />}
      {tab === 'members' && <MembersPanel storyId={storyId} canWrite={myRole === 'OWNER'} />}
      {tab === 'releases' && <ReleasesPanel storyId={storyId} canPublish={canPublish} />}
    </div>
  );
}