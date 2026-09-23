import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import type { Checkpoint, CheckpointSummary, NodeFull } from '../api/types';
import { changedStats, diffSnapshots, fromCheckpoint, fromNode, type DiffSection } from '../lib/diff';
import MessageBanner from './MessageBanner';
import Modal from './Modal';

interface CheckpointsPanelProps {
  storyId: number;
  node: NodeFull;
  checkpoints: CheckpointSummary[];
  canWrite: boolean;
  checkpointing: boolean;
  restoring: boolean;
  onSaveCheckpoint: (note?: string | null) => Promise<boolean>;
  onRestore: (checkpointId: number) => Promise<boolean>;
  onClose: () => void;
}

function DiffBlock({ sections }: { sections: DiffSection[] }) {
  if (sections.length === 0) {
    return <p className="muted small">No differences.</p>;
  }
  return (
    <div className="diff-block">
      {sections.map((section) => {
        const { added, removed } = changedStats(section.lines);
        return (
          <div key={section.label} className="diff-section">
            <div className="diff-head">
              <strong>{section.label}</strong>
              <span className="muted small">
                +{added} −{removed}
              </span>
            </div>
            <pre className="diff-lines">
              {section.lines.map((line, i) => (
                <div key={i} className={`diff-line diff-${line.kind}`}>
                  <span className="diff-sign">{line.kind === 'added' ? '+' : line.kind === 'removed' ? '−' : ' '}</span>
                  {line.text || ' '}
                </div>
              ))}
            </pre>
          </div>
        );
      })}
    </div>
  );
}

export default function CheckpointsPanel({
  storyId,
  node,
  checkpoints,
  canWrite,
  checkpointing,
  restoring,
  onSaveCheckpoint,
  onRestore,
  onClose,
}: CheckpointsPanelProps) {
  const [msg, setMsg] = useState<{ text: string; kind: 'error' | 'ok' } | null>(null);
  const [note, setNote] = useState('');
  const [details, setDetails] = useState<Record<number, Checkpoint>>({});
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const last = checkpoints[0] ?? null;

  useEffect(() => {
    if (!selectedId && last) {
      setSelectedId(last.id);
    }
  }, [selectedId, last]);

  const ensureDetail = (id: number) => {
    if (!id || details[id]) return;
    api
      .checkpoint(storyId, node.id, id)
      .then((cp: Checkpoint) => setDetails((d) => ({ ...d, [id]: cp })))
      .catch((e) => setMsg({ text: e.message, kind: 'error' }));
  };

  useEffect(() => {
    if (last) {
      ensureDetail(last.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last?.id, storyId, node.id]);

  useEffect(() => {
    if (!selectedId) return;
    ensureDetail(selectedId);
    const index = checkpoints.findIndex((c) => c.id === selectedId);
    const previous = checkpoints[index + 1];
    if (previous) ensureDetail(previous.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, checkpoints, storyId, node.id]);

  const workingDiff = useMemo(() => {
    if (!last) return [];
    const cp = details[last.id];
    if (!cp) return [];
    return diffSnapshots(fromCheckpoint(cp), fromNode(node));
  }, [last, details, node]);

  const selected = checkpoints.find((c) => c.id === selectedId) ?? null;
  const selectedDetail = selected ? details[selected.id] : null;
  const previousDetail = useMemo(() => {
    if (!selected) return null;
    const index = checkpoints.findIndex((c) => c.id === selected.id);
    const previous = checkpoints[index + 1];
    return previous ? details[previous.id] ?? null : null;
  }, [selected, checkpoints, details]);

  const entryDiff = useMemo(() => {
    if (!selectedDetail) return [];
    if (previousDetail) {
      return diffSnapshots(fromCheckpoint(previousDetail), fromCheckpoint(selectedDetail));
    }
    return diffSnapshots(
      { title: '', body: null, script: null, meta: null },
      fromCheckpoint(selectedDetail),
    );
  }, [selectedDetail, previousDetail]);

  const lastRestoreDisabled = !canWrite || restoring || node.version === last?.nodeVersion;

  const create = async () => {
    const ok = await onSaveCheckpoint(note.trim() === '' ? null : note.trim());
    if (ok) {
      setNote('');
      setMsg({ text: 'Checkpoint saved.', kind: 'ok' });
    } else {
      setMsg({ text: 'Checkpoint failed — please try again.', kind: 'error' });
    }
  };

  const restore = async (checkpointId: number) => {
    setMsg(null);
    if (!window.confirm('Restore this checkpoint? Your current working copy will be preserved as a new checkpoint so you can undo this.')) {
      return;
    }
    const ok = await onRestore(checkpointId);
    if (ok) {
      setMsg({ text: `Restored checkpoint #${checkpointId}.`, kind: 'ok' });
      setSelectedId(checkpointId);
    } else {
      setMsg({ text: 'Restore failed — please try again.', kind: 'error' });
    }
  };

  return (
    <Modal title="Revision history" onClose={onClose}>
      <div className="modal-body checkpoint-panel">
        <MessageBanner msg={msg?.text ?? null} kind={msg?.kind ?? 'error'} onClose={() => setMsg(null)} />

        {canWrite && (
          <div className="add-form">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Checkpoint note (optional)"
            />
            <button className="small primary" disabled={checkpointing} onClick={create}>
              {checkpointing ? 'Checking point…' : 'New checkpoint'}
            </button>
          </div>
        )}

        {!last ? (
          <p className="muted card tight">
            No checkpoints yet. Saving one snapshots this node so you can diff and jump back to it
            later — the 409 conflict flow alone is not a history.
          </p>
        ) : (
          <>
            <div className="card tight">
              <div className="diff-head">
                <strong>Since your last checkpoint</strong>
                <button
                  className="small primary"
                  disabled={lastRestoreDisabled}
                  onClick={() => restore(last.id)}
                >
                  Back to last checkpoint
                </button>
              </div>
              <DiffBlock sections={workingDiff} />
            </div>

            <h5>Timeline</h5>
            <ul className="plain checkpoint-list">
              {checkpoints.map((c, index) => {
                const previousVersion = checkpoints[index + 1]?.nodeVersion ?? null;
                const capturedChanges = previousVersion !== null && previousVersion !== c.nodeVersion;
                return (
                  <li
                    key={c.id}
                    className={`card tight checkpoint-item${selected?.id === c.id ? ' selected' : ''}`}
                    onClick={() => setSelectedId(c.id)}
                  >
                    <span
                      className={capturedChanges ? 'cp-badge changed' : 'cp-badge'}
                      title={capturedChanges ? 'Captured edits vs the checkpoint before it' : 'No content change vs the checkpoint before it'}
                    >
                      #{c.id}
                    </span>
                    <div className="cp-main">
                      <div>
                        {c.note ? <strong>{c.note}</strong> : <em className="muted">no note</em>}
                        <span className="muted small">
                          {' '}
                          · v{c.nodeVersion} · {new Date(c.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="muted small">
                        {c.authorName} · {c.wordCount} words
                      </div>
                    </div>
                    {selected?.id === c.id && canWrite && (
                      <button
                        className="small linkish"
                        disabled={restoring}
                        onClick={(e) => {
                          e.stopPropagation();
                          void restore(c.id);
                        }}
                      >
                        restore
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>

            {selectedDetail && (
              <div className="card tight">
                <div className="diff-head">
                  <strong>Checkpoint #{selectedDetail.id} vs previous</strong>
                  {canWrite && (
                    <button className="small" disabled={restoring} onClick={() => restore(selectedDetail.id)}>
                      Restore this checkpoint
                    </button>
                  )}
                </div>
                <DiffBlock sections={entryDiff} />
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}