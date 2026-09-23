export type StoryType = 'NOVEL' | 'RPG' | 'SCRIPT';
export type Role = 'OWNER' | 'COLLABORATOR' | 'EDITOR' | 'VIEWER';
export type SystemRole = 'USER' | 'ADMIN';
export type Theme = 'LIGHT' | 'DARK';

export interface UserSettings {
  language: string | null;
  theme: Theme;
}

export type NodeKind = 'BOOK' | 'CHAPTER' | 'SCENE' | 'EPISODE' | 'ACT' | 'QUEST' | 'SUBQUEST' | 'STEP' | 'BEAT';
export type NodeStatus = 'DRAFT' | 'DONE';

export interface UserInfo {
  id: number;
  email: string;
  displayName: string;
  systemRole: SystemRole;
}

export interface LoginResponse {
  token: string;
  user: UserInfo;
}

export interface AdminUser {
  id: number;
  email: string;
  displayName: string;
  systemRole: SystemRole;
  enabled: boolean;
  createdAt: string;
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
  wordCount: number;
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
  wordCount: number;
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
  parentId?: number | null;
  kind: NodeKind;
  title: string;
  status: NodeStatus;
  version: number;
  checkpointId: number | null;
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

export interface CheckpointSummary {
  id: number;
  nodeVersion: number;
  note: string | null;
  createdBy: number;
  authorName: string;
  createdAt: string;
  wordCount: number;
}

export interface NodeNotes {
  note: string | null;
}

export interface DashboardNode {
  id: number;
  parentId: number | null;
  kind: NodeKind;
  title: string;
  status: NodeStatus;
  language: string;
  wordCount: number;
  updatedAt: string;
  updatedBy: number;
  updatedByName: string;
}

export interface DashboardLanguage {
  code: string;
  count: number;
}

export interface DashboardBook {
  node: DashboardNode;
  wordCount: number;
  nodeCount: number;
  draftCount: number;
  doneCount: number;
  nodes: DashboardNode[];
}

export interface StoryDashboard {
  storyId: number;
  title: string;
  storyType: StoryType;
  defaultLanguage: string;
  synopsis: string | null;
  updatedAt: string;
  totalWords: number;
  nodeCount: number;
  draftCount: number;
  doneCount: number;
  languages: DashboardLanguage[];
  books: DashboardBook[];
  recentEdits: DashboardNode[];
}

export interface Checkpoint {
  id: number;
  nodeId: number;
  nodeVersion: number;
  title: string;
  body: JsonValue | null;
  script: ScriptBlock | null;
  meta: JsonValue | null;
  note: string | null;
  createdBy: number;
  authorName: string;
  createdAt: string;
  wordCount: number;
}

export interface ApiErrorBody {
  code: string;
  message: string;
}

export interface ApiErrorPayload {
  error: ApiErrorBody;
  current?: NodeFull;
}

export interface CharacterSuggestion {
  name: string;
  bio: string;
}

export interface LoreSuggestion {
  title: string;
  category: string;
  body: string;
}

export interface ExtractionResponse {
  nodeId: number;
  storyId: number;
  model: string;
  enabled: boolean;
  extractedAt: string;
  characters: CharacterSuggestion[];
  lore: LoreSuggestion[];
}