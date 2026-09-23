import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import type { DashboardBook, DashboardNode, Role, StoryDashboard } from '../api/types';
import { kindLabel } from '../lib/archetypes';

interface StoryDashboardProps {
  storyId: number;
  myRole: Role | null;
}

const STORY_TYPE_LABELS: Record<string, string> = {
  NOVEL: 'Novel',
  RPG: 'RPG',
  SCRIPT: 'Script',
};

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function indentFor(book: DashboardBook): Map<number, number> {
  const depth = new Map<number, number>([[book.node.id, 0]]);
  for (const n of book.nodes) {
    depth.set(n.id, (n.parentId !== null && depth.has(n.parentId) ? depth.get(n.parentId)! : 0) + 1);
  }
  return depth;
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className={`prod-progress${done === total && total > 0 ? ' done' : ''}`}>
      <div className="prod-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="card dash-stat" title={hint}>
      <div className="dash-stat-value">{value}</div>
      <div className="dash-stat-label">{label}</div>
    </div>
  );
}

function SubtreeRow({ node, depth, onOpen }: {
  node: DashboardNode;
  depth: number;
  onOpen: (nodeId: number) => void;
}) {
  return (
    <button
      className="dash-row"
      style={{ paddingLeft: 12 + depth * 18 }}
      title={`Open "${node.title}"`}
      onClick={() => onOpen(node.id)}
    >
      <span className="dash-row-title">
        <span className="kind-tag">{node.kind}</span>
        {node.title}
        {node.language && <span className="badge lang">{node.language}</span>}
      </span>
      <span className="dash-row-words">{node.wordCount}</span>
      <span className="dash-row-meta muted small">
        {node.status === 'DONE' ? 'done' : 'draft'} · {formatWhen(node.updatedAt)}
      </span>
    </button>
  );
}

export default function StoryDashboard({ storyId }: StoryDashboardProps) {
  const [dashboard, setDashboard] = useState<StoryDashboard | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    setMessage(null);
    api
      .dashboard(storyId)
      .then(setDashboard)
      .catch((e) => setMessage((e as Error).message));
  }, [storyId]);

  useEffect(load, [load]);

  const openNode = useCallback((nodeId: number) => {
    window.location.hash = `#/story/${storyId}/node/${nodeId}`;
  }, [storyId]);

  const languageSummary = useMemo(
    () => dashboard?.languages.map((l) => l.code).join(' · ') ?? '—',
    [dashboard],
  );

  if (message) {
    return (
      <div className="page">
        <div className="page-head">
          <h1>Story dashboard</h1>
          <div className="actions">
            <button onClick={() => (window.location.hash = `#/story/${storyId}`)}>Open story</button>
            <button className="primary" onClick={load}>
              Retry
            </button>
          </div>
        </div>
        <div className="banner error">{message}</div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="page">
        <p className="muted">Loading story overview…</p>
      </div>
    );
  }

  return (
    <div className="page dash-page">
      <div className="page-head">
        <h1>
          {dashboard.title}{' '}
          <span className="badge">{STORY_TYPE_LABELS[dashboard.storyType] ?? dashboard.storyType}</span>
        </h1>
        <div className="actions">
          <span className="muted small">Updated {formatWhen(dashboard.updatedAt)}</span>
          <button className="primary" onClick={() => (window.location.hash = `#/story/${storyId}`)}>
            Open story
          </button>
        </div>
      </div>

      {dashboard.synopsis && (
        <div className="card dash-synopsis">
          <div className="dash-section-title">Synopsis</div>
          <p className="muted">{dashboard.synopsis}</p>
        </div>
      )}

      <div className="dash-stats">
        <StatCard label="Total words" value={dashboard.totalWords.toLocaleString()} />
        <StatCard
          label="Draft nodes"
          value={dashboard.draftCount}
          hint="Nodes still in the working set, not yet published-ready"
        />
        <StatCard label="Done nodes" value={dashboard.doneCount} />
        <StatCard label="Nodes" value={dashboard.nodeCount} />
        <StatCard
          label="Languages"
          value={dashboard.languages.length}
          hint={`In use across the story: ${languageSummary || 'none yet'}`}
        />
      </div>

      {dashboard.languages.length > 0 && (
        <div className="dash-langs">
          {dashboard.languages.map((l) => (
            <span key={l.code} className="badge lang">
              {l.code} · {l.count}
            </span>
          ))}
          <span className="muted small">
            per node · default “{dashboard.defaultLanguage}” shown where no override
          </span>
        </div>
      )}

      <div className="card dash-panel">
        <div className="dash-section-title">Recent edits</div>
        {dashboard.recentEdits.length === 0 ? (
          <p className="muted">Nothing written yet.</p>
        ) : (
          <ul className="dash-recent">
            {dashboard.recentEdits.map((n) => (
              <li key={n.id}>
                <button className="dash-recent-item" onClick={() => openNode(n.id)}>
                  <span className="dash-recent-title">
                    {n.title}
                    <span className="kind-tag">{n.kind}</span>
                  </span>
                  <span className={`status-dot${n.status === 'DONE' ? ' done' : ''}`} title={n.status} />
                  <span className="muted small">{n.wordCount} words</span>
                  <span className="muted small">
                    {n.updatedByName} · {formatWhen(n.updatedAt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="dash-books">
        {dashboard.books.length === 0 && (
          <div className="card">
            <p className="muted">No parts yet — create a {kindLabel('BOOK')} to start writing.</p>
          </div>
        )}
        {dashboard.books.map((book) => (
          <div key={book.node.id} className="card dash-book">
            <button className="dash-book-head" onClick={() => openNode(book.node.id)}>
              <span className={`kind-tag`}>{book.node.kind}</span>
              <strong className="dash-book-title">{book.node.title}</strong>
              {book.node.language && <span className="badge lang">{book.node.language}</span>}
              <span className={`status-dot${book.node.status === 'DONE' ? ' done' : ''}`} title={book.node.status} />
              <span className="dash-book-progress">
                <ProgressBar done={book.doneCount} total={book.nodeCount} />
                <span className="muted small">
                  {book.doneCount} / {book.nodeCount} done
                </span>
              </span>
              <span className="dash-book-words" title="Words in this part (whole subtree)">
                {book.wordCount.toLocaleString()} words
              </span>
            </button>
            {book.nodes.length > 0 && (
              <div className="dash-subtree">
                {book.nodes.map((n) => (
                  <SubtreeRow
                    key={n.id}
                    node={n}
                    depth={indentFor(book).get(n.id) ?? 1}
                    onOpen={openNode}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}