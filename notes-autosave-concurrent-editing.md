# Exploration notes — Autosave & concurrent collaborator edits over a Node

Scope: greenfield creative-writing app. UI = React (assumed). Backend = Story Core (Java/Spring,
owns ALL persistence, PostgreSQL/JSONB) + Gateway/BFF + AI service (read-only). These notes explore
the open question "Node revisioning/versioning & autosave strategy" with a concurrency lens.
Companion to AGENTS.md; does not modify it.

## Problem decomposition

"Autosave" and "concurrent editing" are two orthogonal concerns that get conflated:

1. **Autosave policy** — *when* the client persists local changes (debounce, flush, offline).
2. **Concurrency strategy** — *how* simultaneous edits to one Node are merged / conflicts handled.

A Node has three independently-authored payloads: `body` (prose, jsonb), `script` (structured
scene heading/action/dialogue beats, jsonb), `meta` (quest objectives etc., jsonb). They can be
versioned/synced independently to shrink the conflict surface.

## Option A — CRDT via Yjs (realtime collaborative editing)

The de-facto standard for collaborative rich text (powers TipTap/ProseMirror/Slate, all first-class
in React).

- `body` prose → `Y.Text`; `script` beats → `Y.Array<Y.Map>` / `Y.XmlElement`; `meta` → `Y.Map`.
  All inside one `Y.Doc` per Node.
- Merges are deterministic — no "last writer wins" clobbering, no conflict UI ever.
- Built-in distributed history; offline edits merge on reconnect for free.
- Persistence fits the existing model: Core is still the source of truth. The sync layer hands Core
  the update stream; Core persists the CRDT update log (JSONB) + a regenerated snapshot.
- Draft gating maps cleanly: the sync room is per-node and only members with draft access join;
  viewers never connect to draft rooms.

Costs / risks:
- Need a websocket sync transport. Yjs server tooling is Node-first (`y-websocket`); a Java/Spring
  Yjs host is thin on ecosystem support. Realistic shapes:
  - (a) small Node **sidecar** that hosts rooms and flushes updates to Core via gRPC/REST (Core
    stays the only Postgres writer), or
  - (b) host sync in the Gateway/BFF *if* it is Node/TS — but that couples connection state to an
    explicitly stateless layer; sidecar or Mongo-style update relay to Core is cleaner.
- Overkill for v0 if same-node simultaneous editing is rare (writer teams often work on *different*
  nodes; a whole *book* rarely sees two live cursors).

## Option B — LWW + debounced autosave + optimistic concurrency (recommended for v0)

Simplest credible v0; matches the REST contract and keeps all authorization trivially in Core.

- Client locally reflects each keystroke immediately (optimistic UI), keeps a dirty flag.
- Autosave policy:
  - Debounce: flush ~1–2 s after the last change (also on a low-frequency interval watchdog).
  - Coalesce: always send the *current* full state of the edited payload, never a keystroke queue.
  - Hard flush on `visibilitychange`/`beforeunload` (`navigator.sendBeacon`), component unmount.
  - Offline: queue in IndexedDB, replay on reconnect.
- Concurrency: every payload carries a server monotonic `version`.
  - PATCH `{ payload, expectedVersion }` → accepted and bumped, or **409 + latest snapshot**.
  - Client keeps the local "edit session" buffer; on 409 it offers *review / merge / discard*
    against the server snapshot — nothing is lost silently.
- Idempotency: client-sent `changeId` so retries never double-apply.
- Per-payload versions (`body`/`script`/`meta`) mean a script edit never invalidates a prose
  autosave.

Weaknesses: true simultaneously-typed words still resolve to last-writer-wins; the 409 path is the
safety net. Acceptable while "concurrent editing" means "we take turns-ish".

## Option C — Operational Transform (ShareDB / ot.js)

Classic Google-Docs-style; correct OT for free-form text but hand-writing OT for *structured* JSON
(`script`/`meta`) is painful. Not recommended today — CRDTs are strictly better maintained options.

## Recommended roadmap

**v0 — Option B, hardened.**
- Debounced/coalesced flush + `sendBeacon` + IndexedDB offline queue + `changeId` idempotency.
- Optimistic concurrency per payload (`version` + 409/review flow); per-payload versions to decouple
  body vs script vs meta.
- Lightweight presence (BFF WebSocket or polling): "N editing this node" — social awareness +
  cheap edit-lock hint (soft lock: warn, don't hard-block).
- Explicit "Save / checkpoint" keeps the revision seam: flush points (or cadence-triggered) create a
  revision id; future `Release.nodeIds` can point at a revision instead of the live node.

**v1 — Option A (Yjs) when realtime co-writing becomes a requirement.**
- Introduce a small Node sync sidecar hosting per-node `Y.Doc` rooms (Yjs update stream);
  sidecar → Core for snapshot + update-log persistence; Core remains the only writer to Postgres.
- Auth/tenancy enforced at connection time (token → storyId → role); draft rooms never expose to
  viewers; AI service still reads only published/authorized snapshots.
- `body`/`script`/`meta` each a named type in the `Y.Doc`; server snapshot regenerated for
  queries/releases.

## Invariants that must hold in either option

1. Core stays the single mutation point for Postgres; any sync transport only *relays* updates.
2. Draft content never leaves channels scoped to draft-access members (rooms, presence, history).
3. Releases are snapshots; revisioning is the seam for them — never point a release at a live node.
4. Optimistic UI must mismatch-host with the server snapshot on any error/409 (no silent clobber).
5. Sparkline: store `updatedAt`/`updatedBy` on Node (parent rev) so activity/audit survives.

## Open questions to resolve before building

- Is Node/TS acceptable for a BFF/sidecar, or must the sync host be Java? (Drives Option A shape.)
- Which rich-text editor for React (TipTap/ProseMirror vs Slate vs lexical) — affects CRDT adapter
  choice in v1.
- Do we need true realtime at all in v1, or is "presence + LWW" enough? (Scope of v0 already.)
- Versioning granularity: rev per save-checkpoint vs per payload vs per release only.