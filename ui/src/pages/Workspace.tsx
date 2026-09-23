import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import NodeEditor from '../components/NodeEditor';
import NodeTree from '../components/NodeTree';
import Panels from '../components/panels/Panels';
import ProductivityBar from '../components/ProductivityBar';
import CommandPalette, { type PaletteCommand } from '../components/CommandPalette';
import { api } from '../api/client';
import { useWorkspace } from '../hooks/useWorkspace';
import { useWritingStats } from '../hooks/useWritingStats';
import { useHotkeys } from '../hooks/useHotkeys';
import { ROOT_KINDS, childKinds, kindLabel } from '../lib/archetypes';
import { AI_STATE_EVENT, emitAiToggle, type AiStateDetail } from '../lib/aiBridge';
import { PANEL_TABS } from '../lib/panels';
import type { NodeKind, NodeSummary, Role, StoryType } from '../api/types';
import ReaderView from './ReaderView';

interface WorkspaceProps {
  storyId: number;
  myRole: Role | null;
  initialNodeId?: number | null;
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

function isMac(): boolean {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
}

const STORY_KIND_LABELS: Record<StoryType, string> = {
  NOVEL: 'Novel',
  RPG: 'RPG',
  SCRIPT: 'Script',
};

const STORY_TYPES: StoryType[] = ['NOVEL', 'RPG', 'SCRIPT'];

export default function Workspace({ storyId, myRole, initialNodeId }: WorkspaceProps) {
  const {
    story,
    stories,
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
  } = useWorkspace({ storyId, myRole, initialNodeId });

  const stats = useWritingStats();
  const [liveNodeCount, setLiveNodeCount] = useState<number | null>(null);
  const baselineRef = useRef<{ nodeId: number; count: number } | null>(null);

  const [zen, setZen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [aiOn, setAiOn] = useState(true);
  const [aiFindings, setAiFindings] = useState(0);

  useEffect(() => {
    const onAiState = (e: Event) => {
      const detail = (e as CustomEvent<AiStateDetail>).detail;
      if (!detail) return;
      setAiOn(detail.on);
      setAiFindings(detail.findings);
    };
    window.addEventListener(AI_STATE_EVENT, onAiState);
    return () => window.removeEventListener(AI_STATE_EVENT, onAiState);
  }, []);

  const toggleZen = useCallback(() => setZen((prev) => !prev), []);
  const togglePalette = useCallback(() => setPaletteOpen((prev) => !prev), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);

  useHotkeys({
    'mod+k': togglePalette,
    'mod+shift+f': toggleZen,
  });

  const flatNodes = useMemo(() => {
    const out: { id: number; title: string; kind: NodeKind; path: string }[] = [];
    const walk = (nodes: NodeSummary[], parents: string[]) => {
      for (const n of nodes) {
        const path = [...parents, n.title];
        out.push({ id: n.id, title: n.title, kind: n.kind, path: path.join(' / ') });
        walk(n.children, path);
      }
    };
    walk(tree, []);
    return out;
  }, [tree]);

  const selectedNode = useMemo(
    () => (selectedId === null ? null : findNode(tree, selectedId)),
    [tree, selectedId],
  );

  const createChild = useCallback(
    async (kind: NodeKind, parentId: number | null) => {
      try {
        const created = await api.createNode(
          storyId,
          parentId === null
            ? { nodeType: kind, title: `Untitled ${kindLabel(kind)}` }
            : { nodeType: kind, title: `Untitled ${kindLabel(kind)}`, parentId },
        );
        refresh();
        setSelectedId(created.id);
        closePalette();
      } catch (e) {
        setMessage((e as Error).message);
      }
    },
    [storyId, refresh, closePalette],
  );

  const goToStory = useCallback(
    (targetId: number) => {
      window.location.hash = `#/story/${targetId}`;
      closePalette();
    },
    [closePalette],
  );

  const createStory = useCallback(
    async (title: string, storyType: StoryType) => {
      try {
        const created = await api.createStory({ title, storyType, synopsis: '' });
        window.location.hash = `#/story/${created.id}`;
      } catch (e) {
        setMessage((e as Error).message);
      }
    },
    [setMessage],
  );

  const commands = useMemo<PaletteCommand[]>(() => {
    const list: PaletteCommand[] = [];

    for (const n of flatNodes) {
      list.push({
        id: `goto-${n.id}`,
        label: n.title,
        hint: `${n.path} · ${n.kind}`,
        group: 'Go to',
        keywords: ['go to', 'open', 'jump', n.kind.toLowerCase()],
        run: () => {
          setSelectedId(n.id);
          closePalette();
        },
      });
    }

    if (canWrite && story) {
      const kinds = selectedNode
        ? childKinds(story.storyType, selectedNode.kind)
        : ROOT_KINDS[story.storyType];
      for (const kind of kinds) {
        list.push({
          id: `new-${selectedNode?.id ?? 'root'}-${kind}`,
          label: `New ${kindLabel(kind)}`,
          hint: selectedNode ? `under "${selectedNode.title}"` : 'root node',
          group: 'Create',
          keywords: ['new', 'create', 'add', kind.toLowerCase()],
          run: () => void createChild(kind, selectedNode?.id ?? null),
        });
      }
    }

    for (const type of STORY_TYPES) {
      list.push({
        id: `new-story-${type}`,
        label: `New ${STORY_KIND_LABELS[type]} story`,
        hint: 'Create in this workspace',
        group: 'Create',
        keywords: ['new story', 'create story', 'add story', type.toLowerCase()],
        prompt: 'Story title',
        submit: (value) => void createStory(value, type),
        run: () => undefined,
      });
    }

    list.push(
      {
        id: 'toggle-ai',
        label: aiOn ? 'Turn AI analysis off' : 'Turn AI analysis on',
        hint: aiOn
          ? `${aiFindings} finding${aiFindings === 1 ? '' : 's'} · syntax/grammar highlights`
          : 'Syntax/grammar highlights are off',
        group: 'Actions',
        keywords: ['ai', 'analysis', 'syntax', 'grammar', 'toggle ai'],
        run: () => {
          emitAiToggle();
          closePalette();
        },
      },
      {
        id: 'toggle-tree',
        label: showTree ? 'Hide story tree' : 'Show story tree',
        hint: 'Left sidebar',
        group: 'Actions',
        keywords: ['tree', 'sidebar', 'nodes'],
        run: () => {
          setZen(false);
          toggleTree();
          closePalette();
        },
      },
      {
        id: 'toggle-panels',
        label: panelTab ? 'Hide side panels' : 'Show side panels',
        hint: 'Characters · Lore · Members · Releases',
        group: 'Actions',
        keywords: ['panels', 'characters', 'lore', 'members', 'releases', 'sidebar'],
        run: () => {
          setZen(false);
          if (panelTab) selectPanelTab(panelTab);
          else selectPanelTab('characters');
          closePalette();
        },
      },
      {
        id: 'toggle-zen',
        label: zen ? 'Exit focus mode' : 'Enter focus mode',
        hint: zen ? 'Restore tree and panels' : 'Hide everything but the editor',
        group: 'Actions',
        shortcut: isMac() ? '⌘⇧F' : 'Ctrl+Shift+F',
        keywords: ['focus', 'zen', 'distraction', 'clean'],
        run: () => {
          toggleZen();
          closePalette();
        },
      },
    );

    list.push({
      id: 'open-dashboard',
      label: 'Open story dashboard',
      hint: 'Overview · word counts · status · languages · recent edits',
      group: 'Navigate',
      keywords: ['dashboard', 'overview', 'project', 'home'],
      run: () => {
        window.location.hash = `#/story/${storyId}/dashboard`;
        closePalette();
      },
    });

    list.push({
      id: 'home',
      label: 'Back to stories',
      hint: 'Story list',
      group: 'Navigate',
      keywords: ['home', 'stories', 'list'],
      run: () => {
        window.location.hash = '';
        closePalette();
      },
    });

    for (const s of stories) {
      if (s.id === storyId) continue;
      list.push({
        id: `open-story-${s.id}`,
        label: s.title,
        hint: `${s.storyType} · ${s.myRole}`,
        group: 'Navigate',
        keywords: ['switch', 'open', 'story', s.storyType.toLowerCase()],
        run: () => goToStory(s.id),
      });
    }

    return list;
  }, [
    flatNodes,
    canWrite,
    story,
    stories,
    storyId,
    selectedNode,
    aiOn,
    aiFindings,
    showTree,
    panelTab,
    zen,
    createChild,
    createStory,
    goToStory,
    selectPanelTab,
    toggleTree,
    toggleZen,
    closePalette,
  ]);

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
    <div className={`workspace${zen ? ' zen' : ''}`}>
      {message && (
        <div className="banner error" onClick={() => setMessage(null)}>
          {message}
        </div>
      )}
      {!zen && (
        <ProductivityBar
          storyWords={storyWords}
          nodeWords={selectedId !== null ? liveNodeCount : null}
          sessionWords={stats.sessionWords}
          dailyWords={stats.dailyWords}
          goal={stats.goal}
          onGoalChange={stats.setGoal}
        />
      )}
      <div className="workspace-row">
        <aside className={`col tree-col${showTree && !zen ? '' : ' collapsed'}`}>
          <div className="col-head">
            <strong>{story.title}</strong>
            <span className="badge">{story.storyType}</span>
            <button
              className="small"
              title={`Overview of ${story.title}: word counts, status, languages, recent edits`}
              onClick={() => {
                window.location.hash = `#/story/${storyId}/dashboard`;
              }}
            >
              Dashboard
            </button>
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
            onError={(m) => setMessage(m)}
          />
        </aside>
        {!zen && (
          <button
            className={`rail rail-right${showTree ? '' : ' closed'}`}
            title={showTree ? 'Hide story tree' : 'Show story tree'}
            onClick={toggleTree}
          >
            {showTree ? '◀' : '▶'}
          </button>
        )}
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
        {!zen && (
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
        )}
        <aside className={`col panel-col${panelTab && !zen ? '' : ' collapsed'}`}>
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
      {zen && (
        <button
          className="float-zen"
          title={`Exit focus mode (${isMac() ? '⌘⇧F' : 'Ctrl+Shift+F'})`}
          onClick={toggleZen}
        >
          ✕ Focus off
        </button>
      )}
      {paletteOpen && <CommandPalette commands={commands} onClose={closePalette} />}
    </div>
  );
}