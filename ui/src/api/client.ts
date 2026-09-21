const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'

export type StoryType = 'NOVEL'
export type Language = 'ENGLISH' | 'JAPANESE'

export interface Story {
  id: number
  title: string
  storyType: StoryType
  genre: string
  language: Language
  description?: string
  tags: string[]
  content: string
  createdAt: string
}

export interface StoryInput {
  title: string
  storyType: StoryType
  genre: string
  language: Language
  description?: string
  tags: string[]
  content: string
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, init)
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }
  if (response.status === 204) {
    return undefined as T
  }
  return response.json() as Promise<T>
}

export async function fetchStories(): Promise<Story[]> {
  return request<Story[]>('/stories')
}

export async function fetchStory(id: number): Promise<Story> {
  return request<Story>(`/stories/${id}`)
}

export async function createStory(input: StoryInput): Promise<Story> {
  return request<Story>('/stories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export async function updateStory(id: number, input: StoryInput): Promise<Story> {
  return request<Story>(`/stories/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export async function deleteStory(id: number): Promise<void> {
  await request<void>(`/stories/${id}`, { method: 'DELETE' })
}