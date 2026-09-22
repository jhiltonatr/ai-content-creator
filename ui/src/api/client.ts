import type { AdminUser, ApiErrorPayload, JsonValue, LoginResponse, Me, NodeFull, UserInfo, UserSettings } from './types';

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

const TOKEN_KEY = 'storyforge.token';

export function authToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

async function request(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<any> {
  const headers: Record<string, string> = {};
  const token = authToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
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
    if (res.status === 401 && path !== '/api/auth/login') {
      setAuthToken(null);
      if (!window.location.hash.startsWith('#/login')) {
        window.location.hash = '#/login';
      }
    }
    throw new ApiError(res.status, payload ?? { error: { code: 'UNKNOWN', message: res.statusText } });
  }
  return payload;
}

export const api = {
  login: (email: string, password: string): Promise<LoginResponse> =>
    request('POST', '/api/auth/login', { email, password }),
  logout: (): Promise<void> => request('POST', '/api/auth/logout'),
  me: (): Promise<Me> => request('GET', '/api/me'),

  updateProfile: (body: { email?: string; displayName?: string }): Promise<UserInfo> =>
    request('PUT', '/api/me', body),
  changePassword: (body: { currentPassword: string; newPassword: string }): Promise<void> =>
    request('POST', '/api/me/password', body),
  getSettings: (): Promise<UserSettings> => request('GET', '/api/me/settings'),
  saveSettings: (body: Partial<UserSettings>): Promise<UserSettings> =>
    request('PUT', '/api/me/settings', body),

  adminUsers: (): Promise<AdminUser[]> => request('GET', '/api/admin/users'),
  adminCreateUser: (body: { email: string; displayName: string; password: string; systemRole?: string }) =>
    request('POST', '/api/admin/users', body),
  adminUpdateUser: (userId: number, body: Partial<Pick<AdminUser, 'email' | 'displayName' | 'systemRole' | 'enabled'>>) =>
    request('PUT', `/api/admin/users/${userId}`, body),
  adminResetPassword: (userId: number, password: string) =>
    request('POST', `/api/admin/users/${userId}/password`, { password }),
  adminDeleteUser: (userId: number): Promise<void> => request('DELETE', `/api/admin/users/${userId}`),

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

  extractEntities: (storyId: number, nodeId: number, doc: unknown, types: string[], signal?: AbortSignal) =>
    request('POST', `/api/stories/${storyId}/nodes/${nodeId}/extract`, { doc, types }, signal),

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