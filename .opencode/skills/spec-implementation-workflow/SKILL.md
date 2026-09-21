---
name: spec-implementation-workflow
description: Use when a feature spec file must be turned into an implementation plan and executed. Front-load triggers: "spec", "implementation plan", "spec file", "implement the spec". Applies to tasks touching both the api/ backend and the ui/ frontend.
---

# Spec Implementation Workflow

Follow this exact pipeline whenever a spec needs to be implemented. Do not skip the planning step and do not proceed past the plan stage without user review.

## 1. Read the spec

Read the spec file (e.g. `specs/<feature>.md`). Identify the requirements, acceptance criteria, and which components (api, ui, or both) are affected.

## 2. Write the implementation plan

Create a plan file alongside the spec, e.g. `plans/<feature>.md`.

The plan lists actionable tasks for BOTH api and ui, in order. Each task is a checklist item with a status, referencing concrete files and steps:

```markdown
- [ ] api: add `Story` fields for ... in `api/src/main/java/.../domain/Story.java`
- [ ] api: expose `GET /api/...` in `StoryController`
- [ ] ui: extend `Story` type in `src/api/client.ts`
- [ ] ui: render ... in `src/App.tsx`
- [ ] verify: run `mvn -f api/pom.xml verify` and `npm run build`
```

Keep tasks small, actionable, and ordered so earlier tasks unblock later ones.

## 3. User review

Stop after writing the plan. Present it and ask the user to review/approve or request changes. Incorporate feedback into the plan file if needed. Do NOT start executing until the user approves.

## 4. Execute and mark as performed

Execute the tasks in order. After each task is completed and verified, mark it done in the plan file:

- [x] api: ...

A task is only "performed" once its work is actually done and verified per the repo conventions (backend builds/tests pass, frontend lints/builds). At the end, report the completed plan to the user.

## 5. Track implemented specs

When a spec is fully implemented and verified, append it to a separate `specs-implemented.md` file listing the implemented features (one bullet per spec).

If a previously implemented feature requires reimplementation or an update, remove it from `specs-implemented.md` and treat it as a new spec: retake it through the full workflow above (plan, user review, execute), then add it back to the list when done.