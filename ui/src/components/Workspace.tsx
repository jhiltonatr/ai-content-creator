import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import type { NodeKind, NodeSummary, Role, Story, StoryType } from '../api/types';
import NodeEditor from './NodeEditor';
import NodeTree from './NodeTree';
import Panels from './Panels';
import ReaderView from './ReaderView';

interface WorkspaceProps {
  storyId: number;
  myRole: Role | null;
}

const ROOT_KINDS: Record<StoryType, NodeKind[]> = {
  NOVEL: ['BOOK'],
  RPG: ['ACT'],
  SCRIPT: ['EPISODE'],
};

export default function Workspace({ storyId, myRole }: WorkspaceProps) {
  const [story, setStory] = useState<Story | null>(null);
  const [tree, setTree] = useState<NodeSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showAddRoot, setShowAddRoot] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newKind, setNewKind] = useState<NodeKind>(ROOT_KINDS.NOVEL[0]);

  const openAddRoot = () => {
    setNewKind(ROOT_KINDS[story?.storyType ?? 'NOVEL'][0]);
    setShowAddRoot((v) => !v);
  };

  const canWrite = myRole === 'OWNER' || myRole === 'COLLABORATOR';
  const canPublish = myRole === 'OWNER';

  const load = useCallback(() => {
    api
      .stories()
      .then(async (all: Story[]) => {
        const s = all.find((x) => x.id === storyId) ?? (await api.getStory(storyId));
        setStory(s);
      })
      .catch((e) => setMessage(e.message));
    api
      .nodes(storyId)
      .then(setTree)
      .catch((e) => setMessage(e.message));
  }, [storyId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (selectedId === null && tree.length > 0) setSelectedId(tree[0].id);
  }, [tree, selectedId]);

  const refresh = useCallback(() => {
    api
      .nodes(storyId)
      .then(setTree)
      .catch((e) => setMessage(e.message));
  }, [storyId]);

  const addRoot = async () => {
    try {
      await api.createNode(storyId, { nodeType: newKind, title: newTitle });
      setNewTitle('');
      setShowAddRoot(false);
      refresh();
    } catch (e) {
      setMessage((e as Error).message);
    }
  };

  if (!story) {
    return (
      <div className="page">
        {message && <div className="banner error">{message}</div>}
        <p className="muted">Loading story…</p>
      </div>
    );
  }

  if (myRole === 'VIEWER') {
    return <ReaderView story={story} />;
  }

  return (
    <div className="workspace">
      {message && (
        <div className="banner error" onClick={() => setMessage(null)}>
          {message}
        </div>
      )}
      <aside className="col tree-col">
        <div className="col-head">
          <strong>{story.title}</strong>
          <span className="badge">{story.storyType}</span>
          {canWrite && (
            <button className="small" onClick={openAddRoot}>
              + Root
            </button>
          )}
        </div>
        {showAddRoot && (
          <div className="card add-form">
            <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Title" />
            <select value={newKind} onChange={(e) => setNewKind(e.target.value as NodeKind)}>
              {ROOT_KINDS[story.storyType].map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <button className="primary small" disabled={!newTitle.trim()} onClick={addRoot}>
              Add
            </button>
          </div>
        )}
        <NodeTree
          nodes={tree}
          selectedId={selectedId}
          onSelect={setSelectedId}
          storyType={story.storyType}
          storyId={storyId}
          canWrite={canWrite}
          onChanged={refresh}
        />
      </aside>
      <section className="col editor-col">
        {selectedId ? (
          <NodeEditor
            storyId={storyId}
            nodeId={selectedId}
            storyType={story.storyType}
            canWrite={canWrite}
            onChanged={refresh}
            onDelete={() => {
              setSelectedId(null);
              refresh();
            }}
          />
        ) : (
          <p className="muted">
            Select a node — or create one — to start writing.
          </p>
        )}
      </section>
      <aside className="col panel-col">
        <Panels storyId={storyId} myRole={myRole} canWrite={canWrite} canPublish={canPublish} />
      </aside>
    </div>
  );
}