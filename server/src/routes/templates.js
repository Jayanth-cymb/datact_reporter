const { Router } = require('express');
const db = require('../db.js');
const { requireAuth, requireRole } = require('../auth.js');

const router = Router();

router.use(requireAuth);

router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT id, name, description, created_by, created_at
    FROM templates
    ORDER BY created_at DESC
  `).all();
  res.json({ templates: rows });
});

router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT * FROM templates WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'Template not found' });
  res.json({
    template: {
      ...row,
      sheet_json: JSON.parse(row.sheet_json),
      input_cells: JSON.parse(row.input_cells || '[]')
    }
  });
});

router.post('/', requireRole('admin'), (req, res) => {
  const { name, description, sheet_json, input_cells } = req.body || {};
  if (!name || !sheet_json) {
    return res.status(400).json({ error: 'name and sheet_json required' });
  }
  const result = db.prepare(`
    INSERT INTO templates (name, description, sheet_json, input_cells, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    name,
    description || '',
    JSON.stringify(sheet_json),
    JSON.stringify(input_cells || []),
    req.user.sub,
    Date.now()
  );
  res.status(201).json({ id: result.lastInsertRowid });
});

router.patch('/:id', requireRole('admin'), (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT id FROM templates WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Template not found' });

  const { name, description, sheet_json, input_cells } = req.body || {};
  const updates = [];
  const values = [];
  if (name !== undefined) { updates.push('name = ?'); values.push(name); }
  if (description !== undefined) { updates.push('description = ?'); values.push(description); }
  if (sheet_json !== undefined) { updates.push('sheet_json = ?'); values.push(JSON.stringify(sheet_json)); }
  if (input_cells !== undefined) { updates.push('input_cells = ?'); values.push(JSON.stringify(input_cells)); }
  if (updates.length === 0) return res.json({ ok: true });

  values.push(id);
  db.prepare(`UPDATE templates SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  res.json({ ok: true });
});

router.delete('/:id', requireRole('admin'), (req, res) => {
  const id = Number(req.params.id);
  const result = db.prepare('DELETE FROM templates WHERE id = ?').run(id);
  if (result.changes === 0) return res.status(404).json({ error: 'Template not found' });
  res.json({ ok: true });
});

module.exports = router;
