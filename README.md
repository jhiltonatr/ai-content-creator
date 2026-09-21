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

Covers the node graph + optimistic concurrency (`NodeConcurrencyTest`) and the
permission matrix / release gating (`TenancyTest`) against an in-memory H2.

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

## Auth (MVP)

Authentication is stubbed: the current user is taken from the `X-User-Id` HTTP header
(lookups fall back to demo user 1). The UI ships a user switcher (Alice / Bob / Carol)
so you can exercise the role matrix (owner, collaborator, editor, viewer).

## API surface (main endpoints)

| Endpoint | Description |
| --- | --- |
| `GET /api/me` | Current user + story memberships |
| `GET/POST /api/stories` | List / create stories |
| `GET /api/stories/{id}/nodes` | Node tree (root summaries) |
| `GET/POST /api/stories/{id}/nodes[/{nodeId}]` | Node detail / create |
| `PUT /api/stories/{id}/nodes/{nodeId}` | Metadata (title, status DRAFT/DONE, language) |
| `PUT /api/stories/{id}/nodes/{nodeId}/move` | Reparent / reorder |
| `PUT /api/stories/{id}/nodes/{nodeId}/body` | Rich text body (TipTap doc JSON) |
| `PUT /api/stories/{id}/nodes/{nodeId}/script` | Script block (SCENE in SCRIPT stories) |
| `PUT /api/stories/{id}/nodes/{nodeId}/meta` | Free-form meta JSON |
| `DELETE /api/stories/{id}/nodes/{nodeId}` | Delete subtree |
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