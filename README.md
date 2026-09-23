# Storyforge — Creative Writing Support App (MVP)

Monorepo with two parts:

- `backend/` — Story Core Service (Java 25, Spring Boot 4, PostgreSQL/H2). Owns all
  persistence, authorisation, and the node graph. REST API under `/api`.
- `ui/` — React + Vite + TipTap editor. Talks to the backend through a Vite `/api` proxy.

See `AGENTS.md` for the product vision, domain vocabulary (Story / Node / Archetype /
Script block / Lore / Link / Release), and the architecture decisions. This MVP
implements: stories by type (NOVEL, RPG, SCRIPT), a unified node tree validated against
per-type archetypes, characters, lore, memberships with a role permission matrix,
versioned release snapshots, and optimistic concurrency with conflict steering.
Dashboards give a project-level overview per story (synopsis, word counts, draft/done
roll-up, per-node language, recent edits) before opening a chapter.

## Requirements

- JDK 25 (e.g. `C:\Users\jhilt\.jdks\ms-25.0.4.1`). The system `java` may be an older JDK —
  set `JAVA_HOME` explicitly when running Maven.
- Maven 3.9+
- Node 20+ / npm

## Run the backend

Dev mode with the bundled H2 file database (no Postgres required):

```powershell
$env:JAVA_HOME='C:\Users\jhilt\.jdks\ms-25.0.4.1'
mvn -f backend/pom.xml spring-boot:run
```

It listens on `http://localhost:8080` (default `application.yml`). Demo data is seeded
on first start (users alice/bob/carol and one story of each type). DB file lives under
`backend/data/`.

Postgres mode (optional): start a Postgres, set the DATABASE_URL env vars below, and
activate the `postgres` profile:

```powershell
$env:DATABASE_URL='jdbc:postgresql://localhost:5432/storyforge'
$env:DATABASE_USERNAME='storyforge'
$env:DATABASE_PASSWORD='storyforge'
mvn -f backend/pom.xml spring-boot:run -Dspring-boot.run.profiles=postgres
```

## Run the tests

```powershell
$env:JAVA_HOME='C:\Users\jhilt\.jdks\ms-25.0.4.1'
mvn -f backend/pom.xml test
```

Covers the node graph + optimistic concurrency (`NodeConcurrencyTest`), the
permission matrix / release gating (`TenancyTest`), the AI analysis endpoint —
owner access, viewer denial, and backend-unavailable 503 (`AnalysisTest`,
`AnalysisUnavailableTest`) — plus auth (`AuthTest`, `AdminUserTest`) and the
untrusted-header security posture (`AuthSecurityTest`), against an in-memory H2.

## Run the UI

```powershell
cd ui
npm install
npm run dev
```

Open `http://localhost:5173`. The dev server proxies `/api` to `http://localhost:8080`.

Production build + preview:

```powershell
npm run build       # tsc + vite build → ui/dist
npm run preview
```

## AI syntax analysis (optional)

The editor can highlight style/grammar findings live. `RichEditor` posts the **visible**
portion of the current doc (`{"doc": <TipTap JSON with only on-screen blocks>}`) to
`/api/stories/{id}/nodes/{nodeId}/analyze`, keeping payloads, LLM load, and tokens down; it
re-runs on edit and on scroll to follow the view. Core enforces draft access, then calls a
local LLM over the OpenAI-compatible chat endpoint. The call runs off the request thread
(`DeferredResult` + a virtual-thread executor); when the browser aborts the request (new
edit, editor unmount) Core cancels the in-flight LLM call instead of letting it run to the
full timeout. If the LLM backend is unreachable the UI falls back to built-in heuristic
highlighting, so the editor still works offline.

Run llama on port **8081** (8080 is the backend). With Ollama:

```powershell
$env:OLLAMA_HOST='127.0.0.1:8081'
ollama pull mo-shakib/clearwriter
ollama serve
```

Or with llama.cpp: `llama-server -p 8081`. The endpoint/credentials are configurable:

```yaml
storyforge:
  analysis:
    base-url: http://localhost:8081   # OpenAI-compatible /v1/chat/completions
    model: mo-shakib/clearwriter
    timeout-ms: 180000                # allows cold llama model load; retried once on failure
    max-paragraphs: 30                # per request
    max-paragraph-chars: 2000         # per paragraph
```

Returns `{nodeId, storyId, model, analyzedAt, paragraphs[], findings[]}`; findings carry a
zero-based paragraph index, char offsets, severity (`info|warn|danger`), category, and a
message. See `notes-ai-syntax-highlighting.md` for the offsets/decoration contract.

## Auth (MVP)

Login uses opaque bearer tokens: `POST /api/auth/login` with email + password returns a
token (7-day TTL) that is sent on subsequent calls as `Authorization: Bearer <token>`.
The token is hashed (SHA-256) in `auth_tokens`; logout revokes it. Passwords are bcrypt
hashes; the user record has a `system_role` (`USER` | `ADMIN`) distinct from the
story-level membership `role`.

Demo login: `alice@example.com` / `storyforge` (Alice is seeded as an **admin**; bob and
carol share the same demo password). There is no self-registration — accounts are created
by an administrator, and disabling an account or resetting its password revokes that user's
tokens.

Administrators manage users under `/api/admin/users` and in the UI via the **Admin** link
(create/edit/disable/reset password/delete). An admin cannot demote/disable/delete
themselves, the last enabled admin is protected, and a user who owns stories can only be
disabled — deleting them returns `409`.

Users manage themselves under **Profile** (email, display name, change password — verifying
the current password and revoking all sessions) and **Settings** (default language for new
stories, and the look & feel — Light/Dark, applied live and persisted per user in
`users.settings` as JSONB).

Dev/test only: when `app.trust-x-user-id=true`, requests with an `X-User-Id` header are
honoured without a token (this is what the backend test suite uses). It is **off** in the
default `application.yml`.

## API surface (main endpoints)

| Endpoint | Description |
| --- | --- |
| `POST /api/auth/login` · `POST /api/auth/logout` | Bearer-token login / revoke |
| `GET /api/me` | Current user + story memberships |
| `PUT /api/me` | Update own profile (email, display name) |
| `POST /api/me/password` | Change own password (verifies current, revokes all tokens) |
| `GET/PUT /api/me/settings` | Personal settings (default language, theme) |
| `GET/POST /api/admin/users` | Admin: list / create users |
| `PUT /api/admin/users/{id}` | Admin: update identity, role, enabled |
| `POST /api/admin/users/{id}/password` | Admin: reset password (revokes tokens) |
| `DELETE /api/admin/users/{id}` | Admin: delete user |
| `GET/POST /api/stories` | List / create stories |
| `GET /api/stories/{id}/dashboard` | Story overview: synopsis, total words, draft/done roll-up, per-book word counts & status, per-node language, recent edits (draft-access) |
| `GET /api/stories/{id}/nodes` | Node tree (root summaries) |
| `GET/POST /api/stories/{id}/nodes[/{nodeId}]` | Node detail / create |
| `PUT /api/stories/{id}/nodes/{nodeId}` | Metadata (title, status DRAFT/DONE, language) |
| `PUT /api/stories/{id}/nodes/{nodeId}/move` | Reparent / reorder |
| `PUT /api/stories/{id}/nodes/{nodeId}/body` | Rich text body (TipTap doc JSON) |
| `PUT /api/stories/{id}/nodes/{nodeId}/script` | Script block (SCENE in SCRIPT stories) |
| `PUT /api/stories/{id}/nodes/{nodeId}/meta` | Free-form meta JSON |
| `DELETE /api/stories/{id}/nodes/{nodeId}` | Delete subtree |
| `POST /api/stories/{id}/nodes/{nodeId}/analyze` | AI prose analysis (draft-access) |
| `GET/POST /api/stories/{id}/characters` · `/lore` · `/members` · `/releases` | Supporting panels |

All state mutations on a node carry `expectedVersion` (optimistic locking) and optional
`changeId` (idempotency). On a version mismatch you get `409` with the `current` node in
the body — the UI surfaces a "Load theirs / Keep mine" choice. Releases snapshot the
`DONE` nodes plus their ancestors; viewers can read releases but never drafts.

## Notes

- Backend is the authorisation enforcement point; every query is scoped by `storyId`.
- One portable `db/schema.sql` drives both H2 (a `JSONB` domain over `JSON`) and Postgres
  (native `JSONB`). H2 round-trips JSONB as a quoted JSON string, which `JsonSupport`
  unwraps so the API shape is identical on both databases.