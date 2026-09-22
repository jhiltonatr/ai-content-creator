import type { ApiErrorPayload, JsonValue, NodeFull } from './types';

export class ApiError extends Error {
  status: number;
  code: string;
  current?: NodeFull;

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.error?.message ?? `Request failed (${status})`);
    this.status = status;
    this.code = payload.error?.code ?? 'UNKNOWN';
    this.current = payload.current;
  }
}

const USER_KEY = 'storyforge.userId';

export function currentUserId(): number {
  const raw = localStorage.getItem(USER_KEY);
  const id = raw ? Number(raw) : 1;
  return Number.isFinite(id) ? id : 1;
}

export function setCurrentUserId(id: number): void {
  localStorage.setItem(USER_KEY, String(id));
}

async function request(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<any> {
  const headers: Record<string, string> = {
    'X-User-Id': String(currentUserId()),
  };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  const text = await res.text();
  let payload: any = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }
  if (!res.ok) {
    throw new ApiError(res.status, payload ?? { error: { code: 'UNKNOWN', message: res.statusText } });
  }
  return payload;
}

export const api = {
  me: () => request('GET', '/api/me'),
  stories: () => request('GET', '/api/stories'),
  getStory: (storyId: number) => request('GET', `/api/stories/${storyId}`),
  createStory: (body: { title: string; storyType: string } & Record<string, JsonValue>) =>
    request('POST', '/api/stories', body),

  nodes: (storyId: number) => request('GET', `/api/stories/${storyId}/nodes`),
  node: (storyId: number, nodeId: number) => request('GET', `/api/stories/${storyId}/nodes/${nodeId}`),
  createNode: (storyId: number, body: Record<string, unknown>) =>
    request('POST', `/api/stories/${storyId}/nodes`, body),
  updateNode: (storyId: number, nodeId: number, body: Record<string, unknown>) =>
    request('PUT', `/api/stories/${storyId}/nodes/${nodeId}`, body),
  moveNode: (storyId: number, nodeId: number, body: Record<string, unknown>) =>
    request('PUT', `/api/stories/${storyId}/nodes/${nodeId}/move`, body),
  updateBody: (storyId: number, nodeId: number, body: Record<string, unknown>) =>
    request('PUT', `/api/stories/${storyId}/nodes/${nodeId}/body`, body),
  updateScript: (storyId: number, nodeId: number, body: Record<string, unknown>) =>
    request('PUT', `/api/stories/${storyId}/nodes/${nodeId}/script`, body),
  deleteNode: (storyId: number, nodeId: number) => request('DELETE', `/api/stories/${storyId}/nodes/${nodeId}`),

  analyzeNode: (storyId: number, nodeId: number, doc: unknown, signal?: AbortSignal) =>
    request('POST', `/api/stories/${storyId}/nodes/${nodeId}/analyze`, { doc }, signal),

  characters: (storyId: number) => request('GET', `/api/stories/${storyId}/characters`),
  createCharacter: (storyId: number, body: Record<string, unknown>) =>
    request('POST', `/api/stories/${storyId}/characters`, body),
  updateCharacter: (storyId: number, characterId: number, body: Record<string, unknown>) =>
    request('PUT', `/api/stories/${storyId}/characters/${characterId}`, body),
  deleteCharacter: (storyId: number, characterId: number) =>
    request('DELETE', `/api/stories/${storyId}/characters/${characterId}`),

  lore: (storyId: number) => request('GET', `/api/stories/${storyId}/lore`),
  createLore: (storyId: number, body: Record<string, unknown>) =>
    request('POST', `/api/stories/${storyId}/lore`, body),
  updateLore: (storyId: number, entryId: number, body: Record<string, unknown>) =>
    request('PUT', `/api/stories/${storyId}/lore/${entryId}`, body),
  deleteLore: (storyId: number, entryId: number) =>
    request('DELETE', `/api/stories/${storyId}/lore/${entryId}`),

  members: (storyId: number) => request('GET', `/api/stories/${storyId}/members`),
  addMember: (storyId: number, body: { email: string; role: string }) =>
    request('POST', `/api/stories/${storyId}/members`, body),
  updateMemberRole: (storyId: number, userId: number, role: string) =>
    request('PUT', `/api/stories/${storyId}/members/${userId}`, { role }),
  removeMember: (storyId: number, userId: number) =>
    request('DELETE', `/api/stories/${storyId}/members/${userId}`),

  releases: (storyId: number) => request('GET', `/api/stories/${storyId}/releases`),
  createRelease: (storyId: number, body: { name?: string; notes?: string }) =>
    request('POST', `/api/stories/${storyId}/releases`, body),
};