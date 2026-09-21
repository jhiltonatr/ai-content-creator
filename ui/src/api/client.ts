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
  createdAt: string
}

export interface StoryInput {
  title: string
  storyType: StoryType
  genre: string
  language: Language
  description?: string
  tags: string[]
}

export interface Chapter {
  id: number
  bookId: number
  title: string
  content: string
}

export interface ChapterInput {
  title: string
  content: string
}

export interface Book {
  id: number
  storyId: number
  title: string
  sortOrder: number
}

export interface BookDetails extends Book {
  chapters: Chapter[]
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

export async function fetchBooks(storyId: number): Promise<BookDetails[]> {
  return request<BookDetails[]>(`/stories/${storyId}/books`)
}

export async function fetchBook(storyId: number, bookId: number): Promise<BookDetails> {
  return request<BookDetails>(`/stories/${storyId}/books/${bookId}`)
}

export async function createBook(storyId: number, title: string): Promise<BookDetails> {
  return request<BookDetails>(`/stories/${storyId}/books`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
}

export async function updateBook(storyId: number, bookId: number, title: string): Promise<BookDetails> {
  return request<BookDetails>(`/stories/${storyId}/books/${bookId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
}

export async function reorderBooks(storyId: number, bookIds: number[]): Promise<BookDetails[]> {
  return request<BookDetails[]>(`/stories/${storyId}/books/order`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookIds }),
  })
}

export async function deleteBook(storyId: number, bookId: number): Promise<void> {
  await request<void>(`/stories/${storyId}/books/${bookId}`, { method: 'DELETE' })
}

export async function createChapter(
  storyId: number,
  bookId: number,
  input: ChapterInput,
): Promise<Chapter> {
  return request<Chapter>(`/stories/${storyId}/books/${bookId}/chapters`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export async function updateChapter(
  storyId: number,
  bookId: number,
  chapterId: number,
  input: ChapterInput,
): Promise<Chapter> {
  return request<Chapter>(`/stories/${storyId}/books/${bookId}/chapters/${chapterId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export async function deleteChapter(storyId: number, bookId: number, chapterId: number): Promise<void> {
  await request<void>(`/stories/${storyId}/books/${bookId}/chapters/${chapterId}`, { method: 'DELETE' })
}