# Instructor Schedule

A small mobile-first PWA for a single driving instructor: keep a list of students and schedule lessons by date and minute. Built as a personal, non-commercial project.

## Features
- Password login for one user, no registration
- Students (first name or nickname plus a short note) with search
- Lessons with minute-precision start and duration in minutes; overlaps are rejected by a Postgres exclusion constraint
- Day view in the device time zone, JSON export for backups
- Installable PWA
- Android and iOS app via a Capacitor shell around the same web app

## Stack
React 19, Vite, TypeScript, Vercel Functions, Neon Postgres, Capacitor.

## Setup
1. Create a Neon Postgres database (via the Vercel Marketplace or neon.com) and run `db/schema.sql` in its SQL editor.
2. Generate the password hash: `npm run hash -- "a long password"`.
3. Set `DATABASE_URL`, `SESSION_SECRET` (random 32+ bytes) and `PASSWORD_HASH` in the Vercel project settings, see `.env.example`.
4. Deploy the repository to Vercel.

## Local development
    npm install
    cp .env.example .env
    npm run dev

`npm run dev` starts `vercel dev`, which serves the web app and the API together and needs the Vercel CLI linked to a project.

## Mobile app
The phone app is a Capacitor shell that loads the deployed web app, so there is a single codebase and web changes reach the app on the next Vercel deploy without rebuilding it. Sessions use the same cookie as in the browser.

    export APP_URL=https://your-project.vercel.app
    npm install
    npm run build
    npx cap add android
    npx cap open android

Build the APK from Android Studio, or without any local tooling: set the `APP_URL` repository variable, push a `v*` tag and the `Android APK` workflow attaches a debug APK to the GitHub Release (a manual run only uploads it as a run artifact). After changing `capacitor.config.ts` or plugins, run `npm run cap:sync`. iOS works the same way with `npx cap add ios` on macOS.

## Releases
    npm run release -- "fix: handle empty note"
    npm run release -- "feat: add lesson search" --minor
    npm run release -- "feat!: change export format" --major

The script commits all pending changes with the given Conventional Commits message, picks the next `vX.Y.Z` tag from the latest one (patch by default, `--minor` or `--major` for bigger releases), pushes the commit and the tag, and the `Android APK` workflow publishes a GitHub Release with the APK. Add `--dry-run` to print the plan without changing anything.

## Notes
Lesson times are stored in UTC. Keep student names and notes free of surnames, phone numbers and addresses.
