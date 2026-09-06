# AGENTS.md

Repository instructions for coding agents working on Solely.

## Scope

These instructions apply to the whole `shoe-store` project.

## Project Context

- This is a Vietnamese shoe store MVP named Solely.
- The stack is React, Vite, Node.js, Express and PostgreSQL.
- Auth is owned by the Express backend with JWT sessions.
- Customer flows include browsing products, cart, COD checkout and order tracking.
- Admin flows include product, variant, stock and order status management.

## Required Workflow

- Read `DEVELOPMENT_PROMPT.md` before planning or implementing a user-requested feature when the file contains a current prompt.
- Read the relevant code before changing behavior.
- Keep changes scoped to the user's request.
- Follow existing project structure, naming and UI conventions.
- Do not merge to `main` unless the user explicitly asks.
- Do not revert unrelated user changes or unrelated dirty worktree files.
- Use non-destructive git commands unless the user explicitly approves otherwise.

## Changelog Rule

- Every meaningful code, UI, database, configuration or documentation change must update `CHANGELOG.md`.
- Keep the file name in English: `CHANGELOG.md`.
- Write changelog entries in Vietnamese.
- Keep `CHANGELOG.md` at the project root, not under `docs/superpowers`.
- Add current work under `## Chưa phát hành`.
- Move unreleased entries into a dated section only when the user asks to release or finalize that batch.

## Documentation Layout

- Use `DEVELOPMENT_PROMPT.md` as the project-level place for the user to paste development prompts and constraints.
- Use `docs/superpowers/specs/` for product specs and design decisions.
- Use `docs/superpowers/plans/` for implementation plans.
- Do not use `docs/superpowers` as the main project changelog.

## Verification

- Run focused tests for the touched area when practical.
- Run broader tests/build when the change affects shared behavior, routing, auth, database contracts or visible user flows.
- Run `git diff --check` before reporting completion for code changes.
- If a verification step cannot run, report the reason clearly.

## Communication

- Report changed files, verification results and any remaining risk.
- Mention dirty worktree files that were intentionally left untouched.
- Prefer concise Vietnamese status updates for this user.
