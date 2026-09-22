import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import type { NodeKind, NodeSummary, Role, Story, StoryType } from '../api/types';
import NodeEditor from './NodeEditor';
import NodeTree from './NodeTree';
import Panels, { TABS as PANEL_TABS, Tab as PanelTab } from './Panels';
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

function readPref(key: string, dflt: boolean): boolean {
  try {
    const v = window.localStorage.getItem(key);
    return v === null ? dflt : v === '1';
  } catch {
    return dflt;
  }
}

function writePref(key: string, value: boolean): void {
  try {
    window.localStorage.setItem(key, value ? '1' : '0');
  } catch {
    /* ignore */
  }
}

function readStringPref(key: string, dflt: string | null): string | null {
  try {
    const v = window.localStorage.getItem(key);
    return v === null ? dflt : v;
  } catch {
    return dflt;
  }
}

function writeStringPref(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export default function Workspace({ storyId, myRole }: WorkspaceProps) {
  const [story, setStory] = useState<Story | null>(null);
  const [tree, setTree] = useState<NodeSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showAddRoot, setShowAddRoot] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newKind, setNewKind] = useState<NodeKind>(ROOT_KINDS.NOVEL[0]);
  const [showTree, setShowTree] = useState(() => readPref('storyforge:show-tree', true));
  const [panelTab, setPanelTab] = useState<PanelTab | null>(() => {
    const saved = readStringPref('storyforge:panel-tab', null);
    if (saved && PANEL_TABS.some((t) => t.id === saved)) return saved as PanelTab;
    if (!readPref('storyforge:show-panels', true)) return null;
    return 'characters';
  });

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

  const toggleTree = () => {
    setShowTree((prev) => {
      writePref('storyforge:show-tree', !prev);
      return !prev;
    });
  };

  const selectPanelTab = (tab: PanelTab) => {
    setPanelTab((prev) => {
      const next = prev === tab ? null : tab;
      writeStringPref('storyforge:panel-tab', next);
      return next;
    });
  };

  return (
    <div className="workspace">
      {message && (
        <div className="banner error" onClick={() => setMessage(null)}>
          {message}
        </div>
      )}
      <div className="workspace-row">
        <aside className={`col tree-col${showTree ? '' : ' collapsed'}`}>
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
        <button
          className={`rail rail-right${showTree ? '' : ' closed'}`}
          title={showTree ? 'Hide story tree' : 'Show story tree'}
          onClick={toggleTree}
        >
          {showTree ? '◀' : '▶'}
        </button>
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
            <p className="muted">Select a node — or create one — to start writing.</p>
          )}
        </section>
        <div className="rail-tabs" role="tablist" aria-label="Sidebar sections">
          {PANEL_TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={panelTab === t.id}
              className={`rail-tab${panelTab === t.id ? ' active' : ''}`}
              title={panelTab === t.id ? `Close ${t.label}` : `Show ${t.label}`}
              onClick={() => selectPanelTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <aside className={`col panel-col${panelTab ? '' : ' collapsed'}`}>
          {panelTab && (
            <Panels
              storyId={storyId}
              nodeId={selectedId}
              myRole={myRole}
              canWrite={canWrite}
              canPublish={canPublish}
              tab={panelTab}
              onTabChange={selectPanelTab}
            />
          )}
        </aside>
      </div>
    </div>
  );
}