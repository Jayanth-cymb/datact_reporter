# DatACT - Reporter

Paperless shop-floor check sheet system.

## Stack
- **Server:** Node + Express + SQLite (dev) / Postgres (prod) + JWT auth
- **Client:** React + Vite + Univer (spreadsheet)
- **Single-machine deployment** for now

## Phases
- [x] **Phase 1** — Auth, users CRUD (admin)
- [ ] Phase 2 — Templates: upload Excel, mark input cells
- [ ] Phase 3 — Instances: fill, draft, submit
- [ ] Phase 4 — Approval rules + n-of-m approval inbox
- [ ] Phase 5 — Schedules + overdue dashboard
- [ ] Phase 6 — REST API + API keys

## Run (dev)

```bash
# Terminal 1 — backend
cd server
npm install
npm run seed   # creates SQLite DB and seeds admin user
npm run dev    # starts on http://localhost:4000

# Terminal 2 — frontend
cd client
npm install
npm run dev    # opens http://localhost:5173
```

## Default admin
- **Email:** admin@datact.com
- **Password:** admin@1234

Change this immediately after first login (Phase 1 has user CRUD).
