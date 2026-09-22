import { useState } from 'react';
import { api } from '../../api/client';
import type { Release } from '../../api/types';
import { useList } from '../../hooks/useList';
import { useMessage } from '../../hooks/useMessage';
import MessageBanner from '../MessageBanner';

interface ReleasesPanelProps {
  storyId: number;
  canPublish: boolean;
}

export function ReleasesPanel({ storyId, canPublish }: ReleasesPanelProps) {
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [selected, setSelected] = useState<Release | null>(null);
  const { msg, setMsg } = useMessage();

  const { items, reload } = useList<Release>(() =>
    api.releases(storyId).catch((e) => {
      setMsg(e.message);
      return [];
    }),
  );

  const publish = async () => {
    try {
      await api.createRelease(storyId, { name, notes });
      setName('');
      setNotes('');
      reload();
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  const nodeCount = (r: Release) => r.nodes?.length ?? 0;

  return (
    <div className="panel">
      <MessageBanner msg={msg} onClose={() => setMsg(null)} />
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