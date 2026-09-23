# AGENTS.md — Creative Writing Support App

Project conventions and domain context to keep sessions focused. This is a greenfield project; repo currently has no commits.

## Vision

An application that supports writers across different story forms and languages. The **Story** is the main concept; within a story, smaller units (books, chapters, quests, scenes) may each use their own language, and translations are a future concern.

Supported story types:
- **Novel** — single series of Books/Chapters with a straight storyline.
- **RPG-like game** — Lore as overall context + a Main Story + multiple storylines/subquests (branching).
- **TV/Movie Script** — conversation-based; multiple characters talk.
- Others may be added later (interactive fiction, podcast script, ...). Design must stay extensible.

## Terminology (use consistently)

- **Story** — the top-level container for a creative work (the "main concept").
- **Node** — the universal narrative unit (book, chapter, episode, act, scene, quest, beat, step). Every node is the same generic entity; its `nodeType` labels what it is.
- **Archetype** — config that defines how a given story type uses nodes: allowed node types, nesting rules, required sections, rendering profile. *There is one archetype per story type; adding a story type = adding a config, not new database code.*
- **Script block** — the structured content of a script node: scene heading, action lines, dialogue beats (character + parenthetical + line).
- **Lore** — knowledge/encyclopedia content forming overall context (esp. for RPG).
- **Link** — a typed relation between any two entities (node↔node, node↔character, etc.).
- **User** — an account that can hold memberships in stories.
- **Member** — a User attached to a Story with a role → permissions.
- **Owner/Creator** — manages the story (settings, members, publishing, delete).
- **Collaborator** — writes/edits content within the story (team of creators on one story).
- **Editor** — draft read + feedback access (proofreading); cannot edit content.
- **Viewer/Follower** — read-only access to published content; never drafts.
- **Release** — a versioned publish snapshot listing which nodes are public.
- **System role** — site-wide role on a User: `USER` | `ADMIN`. Distinct from the
  story-level membership `role` (OWNER/COLLABORATOR/EDITOR/VIEWER). Admins manage users;
  there is no self-registration (accounts are admin-created).

## Architecture

```
Web UI --> Gateway/BFF
             |--> Story Core Service (Java/Spring Boot)  --> PostgreSQL (JSONB)
             |--> AI & Enrichment Service (Python/FastAPI) --> LLM providers
                      \_ reads Core via API; event bus so Core can publish
                         content-changed events that AI reacts to
```

- **Story Core Service** (Java) owns ALL persistence and graph queries. REST/gRPC.
- **AI & Enrichment Service** (Python) handles LLM integrations (suggestions, continuity checks, summaries, later translation). It is **read + suggest only** — it never directly mutates author content; suggestions are persisted as separate records by Core.
- Search (e.g. Elasticsearch) is a later/optional concern.
- Storage: PostgreSQL; rich text and structured blocks as JSONB.

## Core data model (v0 proposal)

```
Story
  id, title, storyType (novel | rpg | script — extensible), defaultLanguage,
  synopsis, settings (json)

Node
  id, storyId, parentId (tree nesting), nodeType, title, sortOrder,
  language?   // overrides Story.defaultLanguage for that unit
  status      // draft | done
  body (jsonb)      // free-form rich text / prose
  script (jsonb)?   // scene heading, action lines, dialogue beats
  meta (jsonb)?     // quest objectives, conditions, custom fields

Character
  id, storyId, name, attributes (json), bio, notes

Location
  id, storyId, name, description

LoreEntry
  id, storyId, title, body, category

Link   // typed, polymorphic relation
  id, storyId, fromType, fromId, toType, toId,
  kind  // mentions | located_in | prerequisite | unlocks | resolves | references

Tag            // cross-cutting labels (many-to-many to any entity)

User           // account managed by admins; identity via bearer-token login
  id, email, displayName, enabled, systemRole (USER|ADMIN),
  passwordHash (bcrypt), createdAt, settings (jsonb)  // personal prefs: default language, theme

AuthToken      // opaque bearer login sessions (login/logout)
  id, userId, tokenHash (sha-256 of token), expiresAt

Membership     // user ↔ story tenancy gate
  id, storyId, userId, role    // owner | collaborator | editor | viewer

Release        // publish snapshot — the public face of a story
  id, storyId, version, name?, createdById, publishedAt,
  nodeIds (jsonb)              // nodes included in this release
  notes?

Comment (v1)   // proofreader/editor feedback on a node
  id, nodeId, authorId, body, createdAt, resolvedAt?
```

All entities carry `createdBy` / `updatedBy` for audit. Tenancy: every query is scoped by `storyId`; Core is the authorization enforcement point (never trust the client).

Shape mapping:
- Linear (novels): `parentId` + `sortOrder` tree.
- Branching (RPG quests): `Link` kind `prerequisite` / `unlocks` between quest nodes.
- Scripts: `Node.script` jsonb + dialogue beats referencing characters.

## Access control & publishing

Visibility has two orthogonal axes:

- **Authoring state** — `Node.status` = `draft | done`. Draught/working content is the "working set".
- **Release** — a published snapshot (`Release.nodeIds`). Viewers see exactly the latest release, never the working set. This pairing is also the future seam for versioning/revisions.

Permission matrix (story-level membership role):

| Capability | Owner | Collaborator | Editor | Viewer |
|---|:-:|:-:|:-:|:-:|
| Manage settings, members, delete story | ✔ |  |  |  |
| Create/edit/delete content | ✔ | ✔ |  |  |
| Read drafts | ✔ | ✔ | ✔ |  |
| Feedback/annotate drafts | ✔ | ✔ | ✔ |  |
| Publish / release | ✔ |  |  |  |
| Read published content | ✔ | ✔ | ✔ | ✔ |

Rules:
- Draft nodes are **never** exposed to viewers — not via search, links, or AI endpoints.
- AI service must be scoped like the requestor; it may consume drafts only for members with draft access.
- Core enforces authorization on every query; never trust the client.
- v0 uses story-level roles; per-node ACL overrides may come later.

## Decisions (log)

1. **Hybrid content model** — structured units (`Node`) with free-form rich text inside (`body`), optionally plus structured `script`/`meta`. (Agreed.)
2. **UI + microservices** — UI + API microservices; Java for persistence, Python for LLM integrations.
3. **Per-section language override** — Story sets the default language; any book/chapter/scene may override it individually. Translations explored later (the `language` field on Node is the future seam).
4. **Generic node graph + archetype config** — story types are config, not schema.
5. **Role-based multi-tenancy** — story-level memberships with roles (owner | collaborator | editor | viewer); Core is the enforcement point on every query; drafts never leak to viewers.
6. **Publishing = Release snapshot** — `Node.status` (draft|done) tracks authoring state; public visibility is a versioned `Release.nodeIds` snapshot (the seam for future revisions). A release publishes every node marked `done` plus its ancestors as a connected work. Marking an ancestor node `done` cascades to all its descendants (version bump + same `changeId`), so publishing a branch publishes the whole subtree; reverting an ancestor to `draft` does NOT un-draft descendants.
7. **Admin-created accounts + bearer-token login** — no self-registration; admins manage users. Sessions are opaque bearer tokens (SHA-256-hashed in `auth_tokens`, 7-day TTL). `X-User-Id` header trust is dev/test-only (`app.trust-x-user-id=true`). Disabling a user or resetting their password revokes all their tokens; the last enabled admin and self-demotion/disable/delete are protected.
8. **System role vs membership role** — `systemRole` (`USER`|`ADMIN`) is site-wide on User; story-level `Role` (`OWNER/COLLABORATOR/EDITOR/VIEWER`) remains the tenancy gate. Memberships no longer auto-create users.
9. **Personal settings as JSONB** — per-user preferences (default language, theme LIGHT/DARK) live in `users.settings` (JSONB), exposed via `GET/PUT /api/me/settings`; the UI applies the theme via `data-theme` CSS-variable overrides so future themes are config, not schema. Profile self-service (`PUT /api/me`, `POST /api/me/password`) verifies the current password and revokes all that user's sessions.
10. **Explicit checkpoints as the revision seam + version-pinned releases** — `node_checkpoints` snapshots a node's `title`/`body`/`script`/`meta` at the `node.version` it captured, giving writers an explicit checkpoint timeline that is an inspectable/undoable safety net over the raw 409 conflict flow (restore first snapshots the current working set as a "Pre-revert copy" auto-checkpoint, then replays payloads via the same `expectedVersion`/`changeId` protocol — idempotent replay, 409 on stale). `ReleaseNode` now pins the node `version` (and `checkpointId` when exactly one matches) so a release is an unambiguous point-in-time snapshot. Viewers are restricted to a single `GET /releases/latest`; the release list and arbitrary `GET /releases/{version}` require `READ_DRAFTS`, so viewers can never read draft-time history or select an older published snapshot.

## Open questions / next steps

- Framework for UI and gateway (React/Next.js vs other, JS vs TS).
- Java service framework specifics (Spring Boot), API style (REST vs gRPC).
- Event bus choice (Kafka/RabbitMQ) vs simpler webhooks.
- Multi-user live collaboration (joint editing), per-node ACL overrides.

## Working notes

- Repo already has commits; do not commit unless asked.
- No tests/lint commands exist yet — verify with the user before assuming a test framework.
- Keep the domain vocabulary above consistent in code naming and docs.