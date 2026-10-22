# Instructor Schedule

A small mobile-first PWA for a single driving instructor: keep a list of students and schedule lessons by date and minute. Built as a personal, non-commercial project.

## Features
- Password login for one user, no registration
- Students (first name or nickname plus a short note) with search
- Lessons with minute-precision start and duration in minutes; overlaps are rejected by a Postgres exclusion constraint
- Day view in the device time zone
- Light and dark themes: the first launch follows the system setting, a header button switches it and the choice is remembered
- Quick entry tab: type or dictate a day's lessons line by line (`10 Ivan`, `11:30 Olga 90`), with a live preview and automatic creation of new students
- Installable PWA
- Android and iOS app via a Capacitor shell around the same web app

## Stack
React 19, Vite, TypeScript, TanStack Query, Vercel Functions, Neon Postgres, Capacitor.

## Architecture
The frontend follows [Feature-Sliced Design](https://feature-sliced.design/). `@/` is an alias for `src/`, layers import only from the layers below them, and every slice exposes its public API through an `index.ts`.

    src/
      app/        entry point, auth gate, app shell, global styles
      pages/      schedule, students, history, login
      features/   auth, lesson-editor, student-editor, theme-toggle
      entities/   lesson, student (types, API client, query keys, data hooks, list items)
      shared/     fetch client, date helpers, UI kit (modal, date and time pickers)

Server state is handled by TanStack Query. Each entity owns its query key factory and read hooks, and the editor features own the mutations. Deleting a lesson is optimistic and rolls back on failure, while creating or editing a lesson waits for the server, because overlapping lessons are rejected with a `409`. Queries are not retried on 4xx responses.

The backend is a single Vercel Function entry (`api/[...slug].ts`) that delegates to `server/`: a router, session auth, input validation and one handler module per resource. Local imports in `server/` use explicit `.js` extensions because the project is an ES module.

## Theming
Colors are CSS custom properties defined in `src/app/styles/index.css`. The dark palette overrides them under `:root[data-theme='dark']` and sets `color-scheme`, so native controls follow the theme too. A small inline script in `index.html` applies the saved theme, or the system one when nothing is saved, before the first paint, which avoids a flash of the wrong theme. The `theme-toggle` feature flips the `data-theme` attribute and stores the choice in `localStorage`.

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

## Offline reading
Lessons and students are cached in IndexedDB, so the last loaded data stays readable without a connection, including after a restart. Only successful lesson and student queries are stored, for at most three days, and the cache is versioned with a buster string (`CACHE_MAX_AGE_MS` and `CACHE_BUSTER` in `src/app/providers/persistence.ts`). It is wiped when the app lands on the login screen, because it contains student names.

The app is read-only while offline. There is no write queue: adding, editing and deleting are disabled and the UI says "Нет связи" until the connection returns. When data is shown from the cache because a refresh failed, a short banner warns that it may be outdated. The service worker only caches the app shell and never API responses.

## Mobile app
The phone app is a Capacitor shell that bundles the built web app and talks to the deployed API through `VITE_API_URL`. Sessions use the same cookie as in the browser, handled by the native HTTP layer.

    export APP_URL=https://your-project.vercel.app
    npm install
    npm run build
    npx cap add android
    npx cap open android

Build the APK from Android Studio, or without any local tooling: set the `APP_URL` repository variable, push a `v*` tag and the `Android APK` workflow attaches a debug APK and the web bundle to the GitHub Release (a manual run only uploads the APK as a run artifact). After changing `capacitor.config.ts` or plugins, run `npm run cap:sync`. iOS works the same way with `npx cap add ios` on macOS.

## Over-the-air updates
The installed app updates its web bundle without reinstalling the APK. Every tagged release publishes `dist.zip` next to the APK. On launch and whenever the app returns to the foreground (at most once per 30 minutes) it asks the GitHub Releases API for the latest tag. If the tag differs from the version baked into the running bundle, the app downloads `dist.zip` with [@capgo/capacitor-updater](https://github.com/Cap-go/capacitor-updater) in manual mode and applies it the next time it is resumed, after the offline cache has been flushed to disk. A bundle that does not confirm a successful start in time is rolled back by the plugin. No third-party update service is involved.

Changes to native code, plugins or `capacitor.config.ts` are not delivered this way and need a fresh APK. The service worker is registered only in the browser: inside the native shell it is removed, so it can never serve a stale app shell after an update.

## Releases
    npm run release -- "fix: handle empty note"
    npm run release -- "feat: add lesson search" --minor
    npm run release -- "feat!: change export format" --major

The script commits all pending changes with the given Conventional Commits message, picks the next `vX.Y.Z` tag from the latest one (patch by default, `--minor` or `--major` for bigger releases), pushes the commit and the tag, and the `Android APK` workflow publishes a GitHub Release with the APK and the web bundle for over-the-air updates. Add `--dry-run` to print the plan without changing anything.

## Notes
Lesson times are stored in UTC. Keep student names and notes free of surnames, phone numbers and addresses. Voice input uses the platform's speech recognition (the browser service on the web, the Android recognizer in the app), so the audio may leave the device; use typed entry if that matters.
