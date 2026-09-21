import type { Language, StoryType } from './api/client'

export const STORY_TYPES: StoryType[] = ['NOVEL']

export const LANGUAGES: Language[] = ['ENGLISH', 'JAPANESE']

export const LANGUAGE_FLAGS: Record<Language, string> = {
  ENGLISH: '🇬🇧',
  JAPANESE: '🇯🇵',
}