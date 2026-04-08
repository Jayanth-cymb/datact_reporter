import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

// LIST instances. Filters: status, template_id, mine=1
router.get('/', (req, res) => {
  const { status, template_id, mine } = req.query;
  const where = [];
  const params = [];
  if (status) { where.push('i.status = ?'); params.push(status); }
  if (template_id) { where.push('i.template_id = ?'); params.push(Number(template_id)); }
  if (mine === '1') { where.push('i.created_by = ?'); params.push(req.user.sub); }
  const whereSQL = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const rows = db.prepare(`
    SELECT i.id, i.template_id, i.status, i.created_by, i.created_at,
           i.submitted_at, i.completed_at, i.due_at,
           t.name AS template_name,
           u.name AS created_by_name
    FROM instances i
    JOIN templates t ON t.id = i.template_id
    JOIN users u ON u.id = i.created_by
    ${whereSQL}
    ORDER BY i.created_at DESC
  `).all(...params);
  res.json({ instances: rows });
});

// GET ONE — full data including template sheet_json + input_cells + filled_data
router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  const inst = db.prepare('SELECT * FROM instances WHERE id = ?').get(id);
  if (!inst) return res.status(404).json({ error: 'Instance not found' });
  const tpl = db.prepare('SELECT * FROM templates WHERE id = ?').get(inst.template_id);
  if (!tpl) return res.status(404).json({ error: 'Template missing' });
  res.json({
    instance: {
      ...inst,
      filled_data: JSON.parse(inst.filled_data || '{}')
    },
    template: {
      id: tpl.id,
      name: tpl.name,
      sheet_json: JSON.parse(tpl.sheet_json),
      input_cells: JSON.parse(tpl.input_cells || '[]')
    }
  });
});

// CREATE — start a new instance from a template
router.post('/', (req, res) => {
  const { template_id } = req.body || {};
  if (!template_id) return res.status(400).json({ error: 'template_id required' });
  const tpl = db.prepare('SELECT id FROM templates WHERE id = ?').get(Number(template_id));
  if (!tpl) return res.status(404).json({ error: 'Template not found' });
  const result = db.prepare(`
    INSERT INTO instances (template_id, filled_data, status, created_by, created_at)
    VALUES (?, '{}', 'draft', ?, ?)
  `).run(tpl.id, req.user.sub, Date.now());
  res.status(201).json({ id: result.lastInsertRowid });
});

// UPDATE filled_data (draft only, creator only)
router.patch('/:id', (req, res) => {
  const id = Number(req.params.id);
  const inst = db.prepare('SELECT * FROM instances WHERE id = ?').get(id);
  if (!inst) return res.status(404).json({ error: 'Instance not found' });
  if (inst.created_by !== req.user.sub && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Not your instance' });
  }
  if (inst.status !== 'draft' && inst.status !== 'rejected') {
    return res.status(400).json({ error: 'Cannot edit a submitted instance' });
  }
  const { filled_data } = req.body || {};
  if (filled_data === undefined) return res.status(400).json({ error: 'filled_data required' });
  db.prepare('UPDATE instances SET filled_data = ? WHERE id = ?')
    .run(JSON.stringify(filled_data), id);
  res.json({ ok: true });
});

// SUBMIT — change status to pending
router.post('/:id/submit', (req, res) => {
  const id = Number(req.params.id);
  const inst = db.prepare('SELECT * FROM instances WHERE id = ?').get(id);
  if (!inst) return res.status(404).json({ error: 'Instance not found' });
  if (inst.created_by !== req.user.sub) {
    return res.status(403).json({ error: 'Not your instance' });
  }
  if (inst.status !== 'draft' && inst.status !== 'rejected') {
    return res.status(400).json({ error: 'Already submitted' });
  }
  const { filled_data } = req.body || {};
  if (filled_data !== undefined) {
    db.prepare('UPDATE instances SET filled_data = ? WHERE id = ?')
      .run(JSON.stringify(filled_data), id);
  }
  db.prepare('UPDATE instances SET status = ?, submitted_at = ? WHERE id = ?')
    .run('pending', Date.now(), id);
  res.json({ ok: true });
});

// DELETE (creator only, draft only)
router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const inst = db.prepare('SELECT * FROM instances WHERE id = ?').get(id);
  if (!inst) return res.status(404).json({ error: 'Instance not found' });
  if (inst.created_by !== req.user.sub && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (inst.status !== 'draft' && req.user.role !== 'admin') {
    return res.status(400).json({ error: 'Cannot delete a submitted instance' });
  }
  db.prepare('DELETE FROM instances WHERE id = ?').run(id);
  res.json({ ok: true });
});

export default router;
