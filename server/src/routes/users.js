import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { requireAuth, requireRole } from '../auth.js';

const router = Router();

// All routes admin-only
router.use(requireAuth, requireRole('admin'));

router.get('/', (req, res) => {
  const users = db.prepare(
    'SELECT id, email, name, role, active, created_at FROM users ORDER BY created_at DESC'
  ).all();
  res.json({ users });
});

router.post('/', (req, res) => {
  const { email, name, password, role } = req.body || {};
  if (!email || !name || !password || !role) {
    return res.status(400).json({ error: 'email, name, password, role required' });
  }
  if (!['admin', 'operator', 'approver'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) return res.status(409).json({ error: 'Email already exists' });

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    `INSERT INTO users (email, password_hash, name, role, active, created_at)
     VALUES (?, ?, ?, ?, 1, ?)`
  ).run(email, hash, name, role, Date.now());
  const user = db.prepare(
    'SELECT id, email, name, role, active, created_at FROM users WHERE id = ?'
  ).get(result.lastInsertRowid);
  res.status(201).json({ user });
});

router.patch('/:id', (req, res) => {
  const id = Number(req.params.id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { name, role, active, password } = req.body || {};
  const updates = [];
  const values = [];

  if (name !== undefined) { updates.push('name = ?'); values.push(name); }
  if (role !== undefined) {
    if (!['admin', 'operator', 'approver'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    updates.push('role = ?'); values.push(role);
  }
  if (active !== undefined) { updates.push('active = ?'); values.push(active ? 1 : 0); }
  if (password) {
    if (password.length < 8) return res.status(400).json({ error: 'Password too short' });
    updates.push('password_hash = ?'); values.push(bcrypt.hashSync(password, 10));
  }
  if (updates.length === 0) return res.json({ user });

  values.push(id);
  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  const updated = db.prepare(
    'SELECT id, email, name, role, active, created_at FROM users WHERE id = ?'
  ).get(id);
  res.json({ user: updated });
});

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.sub) {
    return res.status(400).json({ error: 'Cannot delete yourself' });
  }
  const result = db.prepare('DELETE FROM users WHERE id = ?').run(id);
  if (result.changes === 0) return res.status(404).json({ error: 'User not found' });
  res.json({ ok: true });
});

export default router;
