import { useCallback, useState } from 'react';
import { api } from '../../api/client';
import type { Character, CharacterSuggestion, LoreSuggestion } from '../../api/types';
import { useExtraction } from '../../hooks/useExtraction';
import { useList } from '../../hooks/useList';
import { useMessage } from '../../hooks/useMessage';
import { useSyncMentions } from '../../hooks/useSyncMentions';
import { emitCatalogChanged } from '../../lib/catalog';
import { ExtractionResults } from '../ExtractionResults';
import MessageBanner from '../MessageBanner';
import Modal from '../Modal';
import PanelActions from './PanelActions';

interface CharactersPanelProps {
  storyId: number;
  nodeId: number | null;
  canWrite: boolean;
}

function addCharacter(storyId: number, item: CharacterSuggestion | LoreSuggestion) {
  const c = item as CharacterSuggestion;
  return api.createCharacter(storyId, { name: c.name, bio: c.bio });
}

export function CharactersPanel({ storyId, nodeId, canWrite }: CharactersPanelProps) {
  const [draft, setDraft] = useState<{ id: number | null; name: string; bio: string } | null>(null);
  const { msg, setMsg } = useMessage();

  const { items, reload } = useList<Character>(() =>
    api.characters(storyId).catch((e) => {
      setMsg(e.message);
      return [];
    }),
  );

  const onAddSuggestion = useCallback(
    (item: CharacterSuggestion | LoreSuggestion) =>
      addCharacter(storyId, item).then(() => {
        reload();
        emitCatalogChanged(storyId);
      }),
    [storyId, reload],
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
      reload();
      emitCatalogChanged(storyId);
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  const remove = async (id: number, name: string) => {
    if (!window.confirm(`Remove ${name}?`)) return;
    try {
      await api.deleteCharacter(storyId, id);
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