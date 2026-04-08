import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import templatesRoutes from './routes/templates.js';
import instancesRoutes from './routes/instances.js';
import approvalsRoutes from './routes/approvals.js';
import schedulesRoutes from './routes/schedules.js';
import dashboardRoutes from './routes/dashboard.js';
import './db.js'; // ensure DB initialized

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isPkg = !!process.pkg;

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, app: 'DatACT - Reporter' }));
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/instances', instancesRoutes);
app.use('/api/approvals', approvalsRoutes);
app.use('/api/schedules', schedulesRoutes);
app.use('/api/dashboard', dashboardRoutes);

// --- Serve built frontend (production / packaged) ---
const publicDir = path.join(__dirname, '..', 'public');
const indexHtmlPath = path.join(publicDir, 'index.html');
const hasFrontend = fs.existsSync(indexHtmlPath);

if (hasFrontend) {
  // Serve static files
  app.use(express.static(publicDir));
  // SPA fallback — for any non-/api route, serve index.html
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(indexHtmlPath);
  });
  console.log(`Serving frontend from ${publicDir}`);
} else {
  console.log('No bundled frontend found (dev mode — use Vite client on :5173)');
}

// Generic error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`DatACT Reporter listening on http://0.0.0.0:${PORT}`);
  if (isPkg) {
    console.log(`Open http://localhost:${PORT} in your browser`);
  }
});
