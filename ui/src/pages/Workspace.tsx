import { useCallback, useEffect, useRef, useState } from 'react';
import NodeEditor from '../components/NodeEditor';
import NodeTree from '../components/NodeTree';
import Panels from '../components/panels/Panels';
import ProductivityBar from '../components/ProductivityBar';
import { useWorkspace } from '../hooks/useWorkspace';
import { useWritingStats } from '../hooks/useWritingStats';
import { PANEL_TABS } from '../lib/panels';
import type { NodeKind, NodeSummary, Role } from '../api/types';
import ReaderView from './ReaderView';

interface WorkspaceProps {
  storyId: number;
  myRole: Role | null;
}

function sumTree(nodes: NodeSummary[]): number {
  let total = 0;
  for (const n of nodes) {
    total += n.wordCount ?? 0;
    total += sumTree(n.children);
  }
  return total;
}

function findNode(nodes: NodeSummary[], id: number): NodeSummary | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const found = findNode(n.children, id);
    if (found) return found;
  }
  return null;
}

export default function Workspace({ storyId, myRole }: WorkspaceProps) {
  const {
    story,
    tree,
    rootKinds,
    selectedId,
    setSelectedId,
    message,
    setMessage,
    canWrite,
    canPublish,
    showTree,
    toggleTree,
    panelTab,
    selectPanelTab,
    showAddRoot,
    openAddRoot,
    newTitle,
    setNewTitle,
    newKind,
    setNewKind,
    addRoot,
    refresh,
  } = useWorkspace({ storyId, myRole });

  const stats = useWritingStats();
  const [liveNodeCount, setLiveNodeCount] = useState<number | null>(null);
  const baselineRef = useRef<{ nodeId: number; count: number } | null>(null);

  const onNodeWordCount = useCallback(
    (nodeId: number, count: number) => {
      setLiveNodeCount(count);
      const base = baselineRef.current;
      if (base && base.nodeId === nodeId && count > base.count) {
        stats.add(count - base.count);
      }
      baselineRef.current = { nodeId, count };
    },
    [stats.add],
  );

  useEffect(() => {
    setLiveNodeCount(null);
  }, [selectedId]);

  const storyTreeWords = sumTree(tree);
  const currentSaved =
    selectedId === null ? 0 : findNode(tree, selectedId)?.wordCount ?? 0;
  const storyWords =
    selectedId !== null && liveNodeCount !== null
      ? storyTreeWords - currentSaved + liveNodeCount
      : storyTreeWords;

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
      <ProductivityBar
        storyWords={storyWords}
        nodeWords={selectedId !== null ? liveNodeCount : null}
        sessionWords={stats.sessionWords}
        dailyWords={stats.dailyWords}
        goal={stats.goal}
        onGoalChange={stats.setGoal}
      />
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
                {rootKinds.map((k) => (
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
              onWordCount={onNodeWordCount}
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