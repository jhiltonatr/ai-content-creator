import type { NodeKind, StoryType } from '../api/types';

export const ROOT_KINDS: Record<StoryType, NodeKind[]> = {
  NOVEL: ['BOOK'],
  RPG: ['ACT'],
  SCRIPT: ['EPISODE'],
};

export const CHILD_KINDS: Record<StoryType, Partial<Record<NodeKind, NodeKind[]>>> = {
  NOVEL: { BOOK: ['CHAPTER'], CHAPTER: ['SCENE'] },
  RPG: { ACT: ['QUEST'], QUEST: ['SUBQUEST'], SUBQUEST: ['STEP'] },
  SCRIPT: { EPISODE: ['SCENE'], ACT: ['SCENE'] },
};

export const ITEM_KINDS: Record<StoryType, NodeKind[]> = {
  NOVEL: ['BOOK', 'CHAPTER', 'SCENE'],
  RPG: ['ACT', 'QUEST', 'SUBQUEST', 'STEP'],
  SCRIPT: ['EPISODE', 'ACT', 'SCENE'],
};

export function childKinds(storyType: StoryType, kind: NodeKind): NodeKind[] {
  return CHILD_KINDS[storyType][kind] ?? ITEM_KINDS[storyType];
}

export function kindLabel(kind: NodeKind): string {
  return kind.charAt(0) + kind.slice(1).toLowerCase();
}