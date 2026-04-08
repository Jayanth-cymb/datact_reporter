# Building the single-file `.exe`

The final `.exe` packages the Node backend, the built React frontend, the SQLite engine,
and all assets into one Windows executable. The backend serves the frontend on the same port.

## Why you must build on Windows

`better-sqlite3` is a native module. Its Windows `.node` binary is only downloaded when
`npm install` runs on Windows. Cross-compiling from macOS won't include the right binary.

**Build on a Windows machine.** Once built, the `.exe` is fully self-contained.

## Prerequisites (Windows)

- Node.js 20+ ([nodejs.org](https://nodejs.org))
- Git (to clone/copy the repo)

## Build steps

```cmd
:: 1. From the repo root
cd datact-reporter\server

:: 2. Install backend deps (this pulls the Windows sqlite binary)
npm install

:: 3. Build the frontend, copy it into server\public, package as .exe
npm run package
```

The output will be at:

```
datact-reporter\release\datact-reporter.exe
```

## Running the .exe

Just double-click it (or run from a terminal). It will:

1. Start the server on **port 4000** (configurable with `PORT` env var)
2. Serve the frontend at the same port
3. Create `data.sqlite` next to the `.exe` on first run
4. Seed the default admin user: `admin@datact.com` / `admin@1234`

Then open in any browser:

```
http://localhost:4000
```

Or from another device on the same LAN:

```
http://<windows-machine-ip>:4000
```

## Important notes

- **Data file:** `data.sqlite` is created next to the `.exe`. Don't delete it — it holds all
  templates, instances, users, and approvals.
- **Backups:** Just copy `data.sqlite`.
- **Firewall:** First run will trigger a Windows firewall prompt — allow it for the LAN to work.
- **Port in use:** Set `PORT` env var: `set PORT=8080 && datact-reporter.exe`
- **Reset:** Delete `data.sqlite` and restart — a fresh DB with seeded admin will be created.

## Dev mode (optional, for changes)

```cmd
:: Terminal 1
cd server
npm run dev

:: Terminal 2
cd client
npm install
npm run dev
```

Open http://localhost:5173 — Vite proxies API calls to the backend on :4000.
