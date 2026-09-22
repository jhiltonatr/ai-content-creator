import { useCallback, useState } from 'react';
import { api } from '../../api/client';
import type { CharacterSuggestion, Lore, LoreSuggestion } from '../../api/types';
import { useExtraction } from '../../hooks/useExtraction';
import { useList } from '../../hooks/useList';
import { useMessage } from '../../hooks/useMessage';
import { useSyncMentions } from '../../hooks/useSyncMentions';
import { emitCatalogChanged } from '../../lib/catalog';
import { ExtractionResults } from '../ExtractionResults';
import MessageBanner from '../MessageBanner';
import Modal from '../Modal';
import PanelActions from './PanelActions';

interface LorePanelProps {
  storyId: number;
  nodeId: number | null;
  canWrite: boolean;
}

function addLore(storyId: number, item: CharacterSuggestion | LoreSuggestion) {
  const l = item as LoreSuggestion;
  return api.createLore(storyId, { title: l.title, category: l.category, body: l.body });
}

export function LorePanel({ storyId, nodeId, canWrite }: LorePanelProps) {
  const [draft, setDraft] = useState<{ id: number | null; title: string; category: string; body: string } | null>(null);
  const { msg, setMsg } = useMessage();

  const { items, reload } = useList<Lore>(() =>
    api.lore(storyId).catch((e) => {
      setMsg(e.message);
      return [];
    }),
  );

  const onAddSuggestion = useCallback(
    (item: CharacterSuggestion | LoreSuggestion) =>
      addLore(storyId, item).then(() => {
        reload();
        emitCatalogChanged(storyId);
      }),
    [storyId, reload],
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
      reload();
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
      reload();
      emitCatalogChanged(storyId);
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  return (
    <div className="panel">
      <MessageBanner msg={msg} onClose={() => setMsg(null)} />
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