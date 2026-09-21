# Plan: Story Content Edit (per-story-type editors)

Specs: `specs/story-content-edit.md` and `specs/story-content-edit/novels.md`

Enable per-story-type content editing. Only the NOVEL type is implemented, with the structure Story -> Books -> Chapters, managed via nested REST CRUD resources (user decision).

## Design decisions

- Content no longer lives on `Story`. The `content: String` placeholder field is **removed** from `Story`; metadata CRUD (`PUT /api/stories/{id}`) only touches title/storyType/genre/language/description/tags.
- New domain entities, stored behind their own repository interfaces (DB-swappable later):
  - `Book(Long id, Long storyId, String title, int sortOrder)` — server-assigned numeric id
  - `Chapter(Long id, Long bookId, String title, String content)` — server-assigned numeric id
- New repository interfaces + in-memory implementations: `BookRepository`, `ChapterRepository`. Book lists ordered by `sortOrder` (then id = creation order for equal orders); chapters ordered by id.
- Book re-sorting (spec: prequels written after a book already exists): a `sortOrder` field updated through a dedicated reorder endpoint `PUT /api/stories/{storyId}/books/order` that takes the full ordered id list; the payload must be an exact permutation of the story's books (else 400).
- Cascade: deleting a story deletes its books and their chapters; deleting a book deletes its chapters.
- Web layer adds a `BookResponse` record embedding the book's chapters (hydrated from `ChapterRepository`) so the UI can render a whole novel from one fetch.
- Error handling generalized into a `ResourceNotFoundException` (web) + `@RestControllerAdvice` (404 / 400 for validation).
- The content editor in the UI is dispatched per story type (badge shown). NOVEL editors:
  - **Content page** (`/stories/{storyId}/content`): the story's books in an accordion (collapsed by default), a search box that filters books by title, an "add book" form, per-book move-up/move-down re-sorting, open/delete actions, and — when a book is expanded — links to its chapters that navigate to the book page.
  - **Book page** (`/stories/{storyId}/books/{bookId}`): rename/delete the book, add chapters, and read/edit each chapter inside a chapter accordion. Chapter navigation from the content page can auto-expand a chapter via `?chapter=<id>`.
  - Unwired types keep the placeholder.
- The story-type-change "content will be lost" confirm already exists and is preserved.

## REST API

```
GET    /api/stories/{storyId}/books                     -> [BookResponse]
POST   /api/stories/{storyId}/books  {title}            -> BookResponse (201)
GET    /api/stories/{storyId}/books/{bookId}            -> BookResponse
PUT    /api/stories/{storyId}/books/{bookId} {title}    -> BookResponse
PUT    /api/stories/{storyId}/books/order {bookIds}     -> [BookResponse]
DELETE /api/stories/{storyId}/books/{bookId}            -> 204
GET    /api/stories/{storyId}/books/{bookId}/chapters   -> [Chapter]
POST   /api/stories/{storyId}/books/{bookId}/chapters {title, content} -> Chapter (201)
GET    /api/stories/{storyId}/books/{bookId}/chapters/{chapterId}      -> Chapter
PUT    /api/stories/{storyId}/books/{bookId}/chapters/{chapterId} {title, content} -> Chapter
DELETE /api/stories/{storyId}/books/{bookId}/chapters/{chapterId}      -> 204
```

`Story` JSON loses `content`. `BookResponse` = `{ id, storyId, title, sortOrder, chapters: [...] }`. `Chapter` = `{ id, bookId, title, content }`. Invalid story/book/chapter -> 404; missing required title or a non-permutation book order -> 400.

## Tasks

### api

- [x] api: add `Book` and `Chapter` records to `api/src/main/java/com/example/company/aicontentcreator/domain/`
- [x] api: remove `content` field from `Story` (`domain/Story.java`), update `InMemoryStoryRepository`
- [x] api: add `BookRepository` + `InMemoryBookRepository` and `ChapterRepository` + `InMemoryChapterRepository` in `api/src/main/java/com/example/company/aicontentcreator/storage/`
- [x] api: add `ResourceNotFoundException` and a `@RestControllerAdvice` handler; refactor `StoryController` off its private handler; cascade story deletion to books/chapters
- [x] api: add `BookController` (list/get/create/update/delete) and `ChapterController` (list/get/create/update/delete) under `/api/stories/{storyId}`, with a `BookResponse` DTO
- [x] api: update `StoryControllerTests` (drop `content`) and add `BookChapterControllerTests` covering the full nested CRUD + 404s + cascade
- [x] api: add `sortOrder` to `Book`/`BookResponse`, order lists by it, and a `PUT /api/stories/{storyId}/books/order` reorder endpoint; add reorder + blank-title tests
- [x] verify: run `mvn -f api/pom.xml verify`

### ui

- [x] ui: remove `content` from `Story`/`StoryInput`; add `Chapter`, `Book`, `BookResponse` types and book/chapter API functions incl. `reorderBooks` in `ui/src/api/client.ts`
- [x] ui: update `StoryForm` (no content handling) and `StoryList` (add "Content" action)
- [x] ui: build per-story-type dispatcher + `NovelContentEditor` (accordion of books, book-title search, add/delete book, move up/down re-sort, chapter navigation) in `ui/src/components/StoryContentEditor.tsx` and `ui/src/components/NovelContentEditor.tsx`
- [x] ui: add `NovelBookEditor` (rename/delete book, chapter accordion with read/edit/delete, add chapter) and `StoryBookPage` wired at `/stories/:storyId/books/:bookId` in `ui/src/components/NovelBookEditor.tsx` and `ui/src/pages/StoryBookPage.tsx`; extend `App.tsx`
- [x] ui: keep the story-type-change confirmation wired in `ui/src/components/StoryForm.tsx`
- [x] ui: add editor styles (accordion, search, book page) in `ui/src/index.css`
- [x] verify: run `npm run lint` and `npm run build`

### tracking

- [x] update `specs-implemented.md` with the story-content-edit entry and check off this task