# Instructor Schedule

A small mobile-first PWA for a single driving instructor: keep a list of students and schedule lessons by date and minute. Built as a personal, non-commercial project.

## Features
- Password login for one user, no registration
- Students (first name or nickname plus a short note) with search
- Lessons with minute-precision start and duration in minutes; overlaps are rejected by a Postgres exclusion constraint
- Day view in the device time zone, JSON export for backups
- Installable PWA

## Stack
React 19, Vite, TypeScript, Vercel Functions, Neon Postgres.

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

## Notes
Lesson times are stored in UTC. Keep student names and notes free of surnames, phone numbers and addresses.
