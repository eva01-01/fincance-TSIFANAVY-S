// LOGICIEL TSIFANAVY'S FAMILY — serveur familial
// API de synchronisation + interface web statique + persistance SQLite.
const express = require('express');
const cors = require('cors');
const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');

const PORT = Number(process.env.PORT) || 3210;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'tsifanavy.db');
const WEB_DIST = path.join(__dirname, '..', '..', 'web', 'dist');

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS app_data (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/api/data', (req, res) => {
  const row = db.prepare('SELECT value, updated_at FROM app_data WHERE key = ?').get('family-budget');
  if (!row) return res.json({ data: null, updatedAt: null });
  res.json({ data: JSON.parse(row.value), updatedAt: row.updated_at });
});
app.put('/api/data', (req, res) => {
  const body = JSON.stringify(req.body ?? null);
  db.prepare(`
    INSERT INTO app_data (key, value, updated_at) VALUES ('family-budget', ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(body);
  res.json({ ok: true });
});

if (fs.existsSync(WEB_DIST)) {
  app.use(express.static(WEB_DIST));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(WEB_DIST, 'index.html')));
} else {
  app.get('/', (_req, res) => res.status(503).send('Interface non construite — lancez « npm run build » à la racine.'));
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`LOGICIEL TSIFANAVY'S FAMILY - serveur démarré sur http://localhost:${PORT}`);
});
