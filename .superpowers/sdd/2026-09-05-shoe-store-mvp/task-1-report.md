# Task 1 Report: Monorepo Scaffold and Local Scripts

## Status

Completed.

## Commit

- `8cd14d9 chore: scaffold shoe store app`

## Summary

Created the initial `shoe-store/` monorepo scaffold with npm workspaces for `server` and `client`.

Implemented:

- Root workspace files and scripts:
  - `npm run dev`
  - `npm run test`
  - `npm run build`
  - `npm run db:setup`
- Express base API:
  - `createApp(): Express.Application` exported from `server/src/app.js`
  - `GET /api/health` returning `{ ok: true, service: 'shoe-store-api' }`
  - `server/src/server.js` binding to `0.0.0.0:${env.PORT}`
  - JSON error handler shape `{ "message": "...", "details": ... }`
  - `asyncHandler` and `HttpError` utilities
  - `env` object from `server/src/config/env.js`
- React + Vite base client:
  - Vite dev server configured for `0.0.0.0:5173`
  - Base React shell with exact requested text
  - Minimal CSS
- Scaffold tests:
  - Server health endpoint test
  - Client shell render test

No feature APIs beyond `/api/health` were implemented.

## Verification

Ran from `shoe-store/` after commit:

```bash
npm run test
```

Result: passed.

```bash
npm run build
```

Result: passed.

```bash
npm audit --omit=dev
```

Result: `found 0 vulnerabilities`.

## Self-Review

Checked the staged and committed file set is scoped to `shoe-store/`.

Confirmed:

- Root `package.json` scripts match the task brief values.
- Backend binds `0.0.0.0:5000` by default through `env.PORT`.
- Frontend dev script binds `0.0.0.0:5173`.
- `/api/health` is the only API route added.
- Error responses use `{ message, details }`.
- Build artifacts and installed dependencies are ignored by `shoe-store/.gitignore`.

## Concerns

None for Task 1.

---

## Fix Round 1

Status: Completed.

Reviewer finding addressed:

- Added an `/api` catch-all before `errorHandler` so unknown API routes return status `404` with `{ message: 'Not found', details: null }`.
- Added a focused server test covering `GET /api/does-not-exist`.

TDD evidence:

```bash
npm run test --workspace server
```

Red result before implementation: failed because the unknown API route response content type was not JSON.

Green result after implementation: passed with `2` server tests, `0` failures.

Verification commands:

```bash
npm run test
```

Output summary: passed. Server: `2` tests passed, `0` failed. Client: `1` test passed, `0` failed.

```bash
npm run build
```

Output summary: passed. Vite built the client successfully.

Concerns: None.
