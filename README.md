# Instructor Schedule

A small mobile-first PWA for a single driving instructor: keep a list of students and schedule lessons by date and minute. Built as a personal, non-commercial project.

## Features
- Password login for one user, no registration
- Students (first name or nickname plus a short note) with search
- Lessons with minute-precision start and duration in minutes; overlaps are rejected by a Postgres exclusion constraint
- Day view in the device time zone
- Works fully offline: reads and writes are stored locally and synced when the connection returns
- Installable PWA with a precached app shell
- Android and iOS app that bundles the web build inside the binary (Capacitor)

## Stack
React 19, Vite, TypeScript, TanStack Query, IndexedDB (idb-keyval), Vercel Functions, Neon Postgres, Capacitor, Workbox (vite-plugin-pwa).

## Architecture
The frontend follows [Feature-Sliced Design](https://feature-sliced.design/). `@/` is an alias for `src/`, layers import only from the layers below them, and every slice exposes its public API through an `index.ts`.

    src/
      app/        entry point, auth gate, app shell, global styles
      pages/      schedule, students, history, login
      features/   auth, lesson-editor, student-editor
      entities/   lesson, student (types, API client, query keys, data hooks, list items)
      shared/     fetch client, date helpers, UI kit (modal, date and time pickers)

Server state is handled by TanStack Query. Each entity owns its query key factory and read hooks, and the editor features own the mutations. Every write is optimistic and goes through a persisted mutation queue, see [Offline-first sync](#offline-first-sync). Queries are not retried on 4xx responses.

The backend is a single Vercel Function entry (`api/[...slug].ts`) that delegates to `server/`: a router, session auth, input validation and one handler module per resource. Local imports in `server/` use explicit `.js` extensions because the project is an ES module.

## Setup
1. Create a Neon Postgres database (via the Vercel Marketplace or neon.com). The schema is applied by the migration runner, see [Database migrations](#database-migrations).
2. Generate the password hash: `npm run hash -- "a long password"`.
3. Set `DATABASE_URL`, `SESSION_SECRET` (random 32+ bytes) and `PASSWORD_HASH` in the Vercel project settings, see `.env.example`.
4. Deploy the repository to Vercel. The build applies pending migrations before building the app.

## Local development
    npm install
    cp .env.example .env
    npm run dev

`npm run dev` starts `vercel dev`, which serves the web app and the API together and needs the Vercel CLI linked to a project.

## Database migrations
The schema lives in plain SQL files in `db/migrations/`, named `0001_init.sql`, `0002_*.sql` and so on. `scripts/migrate.mjs` is a small runner built on `@neondatabase/serverless`:

- it creates a `schema_migrations` table and records the name of every applied file
- pending files are applied in filename order, and each file runs in one transaction together with its `schema_migrations` row, so a failed migration leaves nothing half applied
- running it again does nothing when the database is up to date

Apply migrations manually against any database:

    DATABASE_URL="postgres://..." npm run db:migrate

Add a schema change as a new numbered file, never by editing a file that has already been applied. The initial migration uses `if not exists`, so it is safe to run against a database that was created from the earlier single `schema.sql`.

On Vercel the `vercel-build` script runs `npm run db:migrate` and then `npm run build`. The plain `build` script does not touch the database, so it can run where `DATABASE_URL` is not available, for example in the Android APK workflow.

## Preview deployments
With the Vercel and Neon integration enabled, every preview deployment gets its own copy-on-write Neon branch. Neon creates the branch, Vercel injects its connection string as `DATABASE_URL` for that deployment, and `vercel-build` applies the migrations to it. A pull request that adds a migration is therefore tested against an isolated database and never touches production data. The `SESSION_SECRET` and `PASSWORD_HASH` variables are not provided by the integration and must be set for the Preview environment in the Vercel project settings.

A preview branch starts as a copy of its parent branch, so it contains the parent's data. Point the integration at a parent branch that holds only test data if the production database contains real student names.

## Offline-first sync
The app is usable for weeks without a connection. The device is the source of truth while offline and the server catches up later.

- **Local data.** Lessons and students are persisted to IndexedDB for up to 30 days (`CACHE_MAX_AGE_MS` and `CACHE_BUSTER` in `src/app/providers/persistence.ts`). On startup the app asks the browser for persistent storage so the data is not evicted under storage pressure.
- **Mutation queue.** Creating, editing and deleting lessons and students are TanStack Query mutations that share one scope, so they run strictly one after another in the order they were made. While offline they stay paused, and the queue itself is stored in IndexedDB, so it survives restarts. Each mutation updates the cache optimistically, so the UI reacts instantly. Cached queries are not refetched while the queue is not empty, so optimistic data is never overwritten by stale server data. Once the last queued write settles, the cache is refreshed from the server.
- **Client generated ids.** New students and lessons get a UUID on the device (`crypto.randomUUID` with a `getRandomValues` fallback for insecure contexts), so a lesson can reference a student that has not been synced yet. The API accepts the id on `POST` and is idempotent (`on conflict (id) do nothing`), which makes retries after a lost response safe. Deleting an already deleted row counts as success.
- **Conflicts.** Overlapping lessons are rejected on the device before they enter the queue, using every lesson known locally. If the server still answers `409` (for example after an edit from another device), the change is dropped, a banner explains why and the cache is refreshed. Client errors (4xx) are never retried, so one rejected change cannot block the queue.
- **Connectivity.** `navigator.onLine` is not trusted. The online state comes from the Capacitor Network plugin plus a heartbeat request to `/api/ping`, which also runs every 15 seconds while the app considers itself offline and whenever the app returns to the foreground. A failed request marks the app offline immediately.
- **Retries.** Failed writes are retried with exponential backoff and random jitter, capped at 60 seconds, so many devices that reconnect at the same time do not hammer the free tier of Vercel or Neon. Network errors are retried indefinitely, server errors (5xx) up to 5 times.
- **Sessions.** The session cookie lasts 30 days. When the API answers `401`, the app shows a login prompt over the current screen and keeps the pending requests waiting. Nothing is wiped, and the queue resumes right after signing in again.
- **Background safety.** The cache is flushed to IndexedDB whenever the page is hidden. On native builds the flush runs inside a background task (`@capawesome/capacitor-background-task`), so the OS does not cut it short when the app is minimized.
- **App shell.** `vite-plugin-pwa` generates a Workbox service worker that precaches every build asset, so the web version also starts without a connection. API responses are never cached by the service worker.

## Mobile app
The phone app is a Capacitor shell that bundles the production web build (`webDir: dist`), so the UI starts instantly and without a network. Only API calls go to the deployed backend, using `VITE_API_URL` as the origin. Capacitor's native HTTP and cookie plugins are enabled, so requests bypass CORS and the HttpOnly session cookie works from the `https://localhost` WebView origin.

    export VITE_API_URL=https://your-project.vercel.app
    npm install
    npm run build
    npx cap add android
    npx cap open android

Build the APK from Android Studio, or without any local tooling: set the `APP_URL` repository variable to the deployed URL, push a `v*` tag and the `Android APK` workflow attaches a debug APK to the GitHub Release (a manual run only uploads it as a run artifact). After changing `capacitor.config.ts`, plugins or web code, run `npm run cap:sync` with `VITE_API_URL` set. iOS works the same way with `npx cap add ios` on macOS. The launcher icon lives in `resources/` (the editable source is `resources/icon-foreground.svg`). The workflow copies `resources/android/res` over the generated Android project right after `cap add android`; do the same by hand when building locally. APKs are signed with the fixed debug keystore in `resources/android/debug.keystore` (the standard `android` passwords) and get `versionCode` from the workflow run number, so every build installs as an update over the previous one. It is a sideloading key, not a Play Store release key. Unlike a remote-URL shell, a new web version reaches the phone only with a new app build.

## Releases
    npm run release -- "fix: handle empty note"
    npm run release -- "feat: add lesson search" --minor
    npm run release -- "feat!: change export format" --major

The script commits all pending changes with the given Conventional Commits message, picks the next `vX.Y.Z` tag from the latest one (patch by default, `--minor` or `--major` for bigger releases), pushes the commit and the tag, and the `Android APK` workflow publishes a GitHub Release with the APK. Add `--dry-run` to print the plan without changing anything.

## Notes
Lesson times are stored in UTC. Keep student names and notes free of surnames, phone numbers and addresses.
