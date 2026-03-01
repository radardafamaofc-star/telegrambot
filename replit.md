# Telegram Group Transfer Tool

A web app for transferring members between Telegram groups using the Telegram MTProto API (via the `telegram` gramjs library).

## Architecture

- **Frontend**: React + TypeScript + Vite, served from `client/src/`
- **Backend**: Express.js server in `server/`, runs on port 5000
- **Database**: Replit PostgreSQL (via Drizzle ORM + `pg`)
- **Shared**: Types and API route definitions in `shared/`

## Key Files

- `server/index.ts` — Express app entry point
- `server/routes.ts` — All API route handlers (Telegram auth, dialogs, transfer jobs)
- `server/storage.ts` — In-memory storage for transfer jobs (can be swapped for DB-backed storage)
- `server/db.ts` — Drizzle + pg database connection
- `shared/schema.ts` — Drizzle schema (sessions, transfer_jobs tables)
- `shared/routes.ts` — Typed API route definitions shared between client and server

## Environment Variables / Secrets

- `DATABASE_URL` — PostgreSQL connection string (auto-set by Replit)
- `TELEGRAM_API_ID` — Telegram API ID (from https://my.telegram.org/apps)
- `TELEGRAM_API_HASH` — Telegram API Hash (from https://my.telegram.org/apps)

## Running

- Development: `npm run dev` (uses `tsx` to run `server/index.ts`)
- Build: `npm run build`
- Production: `npm start`
- DB schema sync: `npm run db:push`

## Security Notes

- Telegram API credentials are stored as Replit Secrets, not hardcoded
- Session strings are passed client→server per-request (not persisted by default)
- All Telegram API calls happen server-side only
