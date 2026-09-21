import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import type { JsonValue, Release, Story } from '../api/types';

interface ReaderViewProps {
  story: Story;
  canWrite?: boolean;
}

function walkText(node: JsonValue | null | undefined, out: string[]): void {
  if (node === null || node === undefined) return;
  if (Array.isArray(node)) {
    for (const child of node) walkText(child, out);
    return;
  }
  if (typeof node !== 'object') {
    if (typeof node === 'string') out.push(node);
    return;
  }
  const obj = node as Record<string, unknown>;
  if (typeof obj.text === 'string') out.push(obj.text);
  if (obj.type === 'mention') {
    const attrs = obj.attrs as Record<string, unknown> | undefined;
    if (typeof attrs?.label === 'string') out.push(attrs.label);
  }
  if (Array.isArray(obj.content)) {
    for (const child of obj.content) walkText(child as JsonValue, out);
  }
}

function ActionLines({ lines }: { lines: string[] | null | undefined }) {
  if (!lines || lines.length === 0) return null;
  return (
    <div className="reader-action">
      {lines.map((l, i) => (
        <p key={i}>{l}</p>
      ))}
    </div>
  );
}

function ScriptBlockView({ script }: { script: unknown }) {
  if (!script || typeof script !== 'object') return null;
  const s = script as Record<string, unknown>;
  const heading = typeof s.sceneHeading === 'string' ? s.sceneHeading : null;
  const actionLines = Array.isArray(s.actionLines) ? (s.actionLines as string[]) : [];
  const dialogue = s.dialogue && typeof s.dialogue === 'object' ? (s.dialogue as Record<string, unknown>) : null;
  return (
    <div className="reader-script">
      {heading && <div className="reader-heading">{heading}</div>}
      <ActionLines lines={actionLines} />
      {dialogue && (
        <div className="reader-dialogue">
          <span className="reader-char">
            {String(dialogue.characterName ?? '')}
            {dialogue.parenthetical ? ` ${dialogue.parenthetical}` : ''}
          </span>
          <div>{String(dialogue.line ?? '')}</div>
        </div>
      )}
    </div>
  );
}

function BodyText({ body }: { body: JsonValue | null }) {
  const lines: string[] = [];
  walkText(body, lines);
  if (lines.length === 0) return <p className="muted">(no body)</p>;
  return (
    <div className="reader-body">
      {lines.map((l, i) => (
        <p key={i}>{l}</p>
      ))}
    </div>
  );
}

export default function ReaderView({ story, canWrite }: ReaderViewProps) {
  const [releases, setReleases] = useState<Release[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .releases(story.id)
      .then(setReleases)
      .catch((e) => setMessage(e.message));
  }, [story.id]);

  useEffect(() => {
    load();
  }, [load]);

  const latest = releases?.[0] ?? null;

  return (
    <div className="page reader">
      <div className="page-head">
        <div>
          <h1>{story.title}</h1>
          <span className="muted">Published view{canWrite ? ' (you can also edit in the Drafts view)' : ''}</span>
        </div>
        <span className="badge role">VIEWER · published only</span>
      </div>
      {message && (
        <div className="banner error" onClick={() => setMessage(null)}>
          {message}
        </div>
      )}
      {!latest ? (
        <div className="card">
          <p>
            <strong>Nothing has been published yet.</strong>
          </p>
          <p className="muted">The owner publishes a release when they are ready; you will see it here.</p>
        </div>
      ) : (
        <div className="card">
          <div className="release-head">
            <strong>
              Release v{latest.version}
              {latest.name ? ` · ${latest.name}` : ''}
            </strong>
            <span className="muted small">{new Date(latest.publishedAt).toLocaleString()}</span>
          </div>
          {latest.notes && <p className="muted">{latest.notes}</p>}
          <ul className="reader-nodes">
            {latest.nodes?.map((n) => (
              <li key={n.id} className="reader-node">
                <div className="reader-node-title">
                  <span className="badge">{n.kind}</span> {n.title}
                </div>
                {n.script ? <ScriptBlockView script={n.script} /> : <BodyText body={n.body} />}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}