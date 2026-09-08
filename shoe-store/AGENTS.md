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

- Read the relevant code before changing behavior.
- Keep changes scoped to the user's request.
- Follow existing project structure, naming and UI conventions.
- Do not merge to `main` unless the user explicitly asks.
- Do not revert unrelated user changes or unrelated dirty worktree files.
- Use non-destructive git commands unless the user explicitly approves otherwise.

## File Modification Rules

- Only modify files that are necessary to fulfill the user's request.
- Do not modify unrelated files.
- Do not delete existing files unless explicitly requested.
- Do not rename or move files unless explicitly requested or strictly required.
- Do not modify database schema or migrations unless the task requires it.
- Do not modify authentication, authorization, or security logic unless the task requires it.
- Do not modify API contracts unless explicitly requested.
- Do not modify dependencies or package versions unless necessary and explicitly explained.
- Do not modify environment files or secrets.
- Do not modify tests to make them pass unless the test itself is incorrect and the change is explicitly justified.
- Do not rewrite or refactor unrelated code.
- Do not change existing UI/UX outside the requested feature.

## Changelog Rule

- Every meaningful code, UI, database, configuration or documentation change must update `CHANGELOG.md`.
- Keep the file name in English: `CHANGELOG.md`.
- Write changelog entries in Vietnamese.
- Keep `CHANGELOG.md` at the project root, not under `docs/superpowers`.
- Add current work under `## Chưa phát hành`.
- Move unreleased entries into a dated section only when the user asks to release or finalize that batch.

## Documentation Rule

- Every new system or feature must update `README.md` with its setup, usage, current status and known limitations.
- Every new system or feature must also update the project Wiki from the README content.
- The local Wiki source is maintained under `docs/wiki/` until it can be synchronized to the repository Wiki.
- Documentation must record what is complete, what is currently in progress and what is planned next.

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
