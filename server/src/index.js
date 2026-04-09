require('dotenv/config');
const express = require('express');
const cors = require('cors');
const path = require('node:path');
const fs = require('node:fs');
const authRoutes = require('./routes/auth.js');
const usersRoutes = require('./routes/users.js');
const templatesRoutes = require('./routes/templates.js');
const instancesRoutes = require('./routes/instances.js');
const approvalsRoutes = require('./routes/approvals.js');
const schedulesRoutes = require('./routes/schedules.js');
const dashboardRoutes = require('./routes/dashboard.js');
const ocrRoutes = require('./routes/ocr.js');
require('./db.js'); // ensure DB initialized

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
app.use('/api/ocr', ocrRoutes);

// --- Serve built frontend (production / packaged) ---
const publicDir = path.join(__dirname, '..', 'public');
const indexHtmlPath = path.join(publicDir, 'index.html');
const hasFrontend = fs.existsSync(indexHtmlPath);

if (hasFrontend) {
  app.use(express.static(publicDir));
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(indexHtmlPath);
  });
  console.log(`Serving frontend from ${publicDir}`);
} else {
  console.log('No bundled frontend found (dev mode — use Vite client on :5173)');
}

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
