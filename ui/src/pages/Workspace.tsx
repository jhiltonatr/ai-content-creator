import NodeEditor from '../components/NodeEditor';
import NodeTree from '../components/NodeTree';
import Panels from '../components/panels/Panels';
import { useWorkspace } from '../hooks/useWorkspace';
import { PANEL_TABS } from '../lib/panels';
import type { NodeKind, Role } from '../api/types';
import ReaderView from './ReaderView';

interface WorkspaceProps {
  storyId: number;
  myRole: Role | null;
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