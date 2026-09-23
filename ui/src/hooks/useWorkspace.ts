import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import type { NodeKind, NodeSummary, Role, Story } from '../api/types';
import { ROOT_KINDS } from '../lib/archetypes';
import { PANEL_TABS, type PanelTab } from '../lib/panels';
import { useBooleanPref, useStringPref } from './useLocalStoragePref';

export function useWorkspace({ storyId, myRole }: { storyId: number; myRole: Role | null }) {
  const canWrite = myRole === 'OWNER' || myRole === 'COLLABORATOR';
  const canPublish = myRole === 'OWNER';

  const [showTree, setShowTree] = useBooleanPref('storyforge:show-tree', true);
  const [showPanels] = useBooleanPref('storyforge:show-panels', true);
  const [panelTab, setPanelTab] = useStringPref<PanelTab | null>(
    'storyforge:panel-tab',
    showPanels ? 'characters' : null,
    (raw) =>
      PANEL_TABS.some((t) => t.id === raw) ? (raw as PanelTab) : showPanels ? 'characters' : null,
  );

  const [story, setStory] = useState<Story | null>(null);
  const [tree, setTree] = useState<NodeSummary[]>([]);
  const rootKinds = ROOT_KINDS[story?.storyType ?? 'NOVEL'];
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showAddRoot, setShowAddRoot] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newKind, setNewKind] = useState<NodeKind>(ROOT_KINDS.NOVEL[0]);

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

  const openAddRoot = () => {
    setNewKind(rootKinds[0]);
    setShowAddRoot((v) => !v);
  };

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

  const toggleTree = useCallback(() => {
    setShowTree((prev) => !prev);
  }, [setShowTree]);

  const selectPanelTab = useCallback(
    (tab: PanelTab) => {
      setPanelTab((prev) => (prev === tab ? null : tab));
    },
    [setPanelTab],
  );

  return {
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
  };
}