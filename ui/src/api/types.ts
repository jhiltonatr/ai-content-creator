export type StoryType = 'NOVEL' | 'RPG' | 'SCRIPT';
export type Role = 'OWNER' | 'COLLABORATOR' | 'EDITOR' | 'VIEWER';
export type NodeKind = 'BOOK' | 'CHAPTER' | 'SCENE' | 'EPISODE' | 'ACT' | 'QUEST' | 'SUBQUEST' | 'STEP' | 'BEAT';
export type NodeStatus = 'DRAFT' | 'DONE';

export interface UserInfo {
  id: number;
  email: string;
  displayName: string;
}

export interface StoryRole {
  storyId: number;
  title: string;
  storyType: StoryType;
  role: Role;
  memberCount: number;
}

export interface Me {
  user: UserInfo;
  stories: StoryRole[];
}

export interface Story {
  id: number;
  title: string;
  storyType: StoryType;
  defaultLanguage: string;
  synopsis: string | null;
  settings: JsonValue | null;
  createdAt: string;
  updatedAt: string;
  myRole: Role;
}

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export interface NodeSummary {
  id: number;
  kind: NodeKind;
  title: string;
  status: NodeStatus;
  sortOrder: number;
  children: NodeSummary[];
}

export interface DialogueBeat {
  characterId?: number | null;
  characterName?: string | null;
  parenthetical?: string | null;
  line?: string | null;
}

export interface ScriptBlock {
  sceneHeading?: string | null;
  actionLines?: string[] | null;
  dialogue?: DialogueBeat | DialogueBeat[] | null;
}

export interface NodeFull {
  id: number;
  storyId: number;
  parentId: number | null;
  kind: NodeKind;
  title: string;
  sortOrder: number;
  language: string | null;
  status: NodeStatus;
  body: JsonValue | null;
  script: ScriptBlock | null;
  meta: JsonValue | null;
  version: number;
  lastChangeId: string | null;
  createdAt: string;
  updatedAt: string;
  updatedBy: number;
}

export interface Character {
  id: number;
  storyId: number;
  name: string;
  attributes: JsonValue | null;
  bio: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Lore {
  id: number;
  storyId: number;
  title: string;
  category: string | null;
  body: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Membership {
  id: number;
  storyId: number;
  userId: number;
  role: Role;
  createdAt: string;
  email: string;
  displayName: string;
}

export interface ReleaseNode {
  id: number;
  kind: NodeKind;
  title: string;
  status: NodeStatus;
  body: JsonValue | null;
  script: ScriptBlock | null;
  meta: JsonValue | null;
}

export interface Release {
  id: number;
  storyId: number;
  version: number;
  name: string | null;
  notes: string | null;
  createdBy: number;
  publishedAt: string;
  nodes: ReleaseNode[];
}

export interface ApiErrorBody {
  code: string;
  message: string;
}

export interface ApiErrorPayload {
  error: ApiErrorBody;
  current?: NodeFull;
}