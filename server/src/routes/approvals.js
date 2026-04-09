const { Router } = require('express');
const db = require('../db.js');
const { requireAuth, requireRole } = require('../auth.js');

const router = Router();
router.use(requireAuth);

function getRule(templateId) {
  const row = db.prepare('SELECT * FROM approval_rules WHERE template_id = ?').get(templateId);
  if (!row) return null;
  return {
    ...row,
    approver_user_ids: JSON.parse(row.approver_user_ids || '[]')
  };
}

router.get('/rules/:templateId', (req, res) => {
  const rule = getRule(Number(req.params.templateId));
  res.json({ rule });
});

router.put('/rules/:templateId', requireRole('admin'), (req, res) => {
  const templateId = Number(req.params.templateId);
  const { required_count, approver_user_ids } = req.body || {};
  if (!Number.isInteger(required_count) || required_count < 1) {
    return res.status(400).json({ error: 'required_count must be a positive integer' });
  }
  if (!Array.isArray(approver_user_ids) || approver_user_ids.length === 0) {
    return res.status(400).json({ error: 'approver_user_ids must be a non-empty array' });
  }
  if (required_count > approver_user_ids.length) {
    return res.status(400).json({ error: 'required_count cannot exceed number of approvers' });
  }
  const tpl = db.prepare('SELECT id FROM templates WHERE id = ?').get(templateId);
  if (!tpl) return res.status(404).json({ error: 'Template not found' });

  const existing = db.prepare('SELECT id FROM approval_rules WHERE template_id = ?').get(templateId);
  if (existing) {
    db.prepare(`UPDATE approval_rules SET required_count = ?, approver_user_ids = ? WHERE template_id = ?`)
      .run(required_count, JSON.stringify(approver_user_ids), templateId);
  } else {
    db.prepare(`INSERT INTO approval_rules (template_id, required_count, approver_user_ids) VALUES (?, ?, ?)`)
      .run(templateId, required_count, JSON.stringify(approver_user_ids));
  }
  res.json({ ok: true, rule: getRule(templateId) });
});

router.delete('/rules/:templateId', requireRole('admin'), (req, res) => {
  db.prepare('DELETE FROM approval_rules WHERE template_id = ?').run(Number(req.params.templateId));
  res.json({ ok: true });
});

router.get('/inbox', (req, res) => {
  const userId = req.user.sub;
  const rows = db.prepare(`
    SELECT i.id, i.template_id, i.status, i.created_at, i.submitted_at, i.created_by,
           t.name AS template_name,
           u.name AS created_by_name
    FROM instances i
    JOIN templates t ON t.id = i.template_id
    JOIN users u ON u.id = i.created_by
    WHERE i.status = 'pending'
    ORDER BY i.submitted_at ASC
  `).all();

  const inbox = [];
  for (const r of rows) {
    const rule = getRule(r.template_id);
    if (!rule) continue;
    if (!rule.approver_user_ids.includes(userId)) continue;
    const already = db.prepare(
      'SELECT id FROM approvals WHERE instance_id = ? AND approver_user_id = ?'
    ).get(r.id, userId);
    if (already) continue;
    const approvedCount = db.prepare(
      "SELECT COUNT(*) AS n FROM approvals WHERE instance_id = ? AND decision = 'approved'"
    ).get(r.id).n;
    inbox.push({
      ...r,
      required_count: rule.required_count,
      approved_count: approvedCount
    });
  }
  res.json({ inbox });
});

router.get('/instance/:id', (req, res) => {
  const id = Number(req.params.id);
  const approvals = db.prepare(`
    SELECT a.id, a.approver_user_id, a.decision, a.comment, a.decided_at,
           u.name AS approver_name, u.email AS approver_email
    FROM approvals a
    JOIN users u ON u.id = a.approver_user_id
    WHERE a.instance_id = ?
    ORDER BY a.decided_at ASC
  `).all(id);
  res.json({ approvals });
});

router.post('/instance/:id/approve', (req, res) => {
  const id = Number(req.params.id);
  const userId = req.user.sub;
  const { comment } = req.body || {};

  const inst = db.prepare('SELECT * FROM instances WHERE id = ?').get(id);
  if (!inst) return res.status(404).json({ error: 'Instance not found' });
  if (inst.status !== 'pending') return res.status(400).json({ error: 'Instance not pending' });

  const rule = getRule(inst.template_id);
  if (!rule) return res.status(400).json({ error: 'No approval rule defined for this template' });
  if (!rule.approver_user_ids.includes(userId)) {
    return res.status(403).json({ error: 'You are not an approver for this template' });
  }
  const already = db.prepare(
    'SELECT id FROM approvals WHERE instance_id = ? AND approver_user_id = ?'
  ).get(id, userId);
  if (already) return res.status(400).json({ error: 'You have already decided on this instance' });

  db.prepare(`
    INSERT INTO approvals (instance_id, approver_user_id, decision, comment, decided_at)
    VALUES (?, ?, 'approved', ?, ?)
  `).run(id, userId, comment || '', Date.now());

  const approvedCount = db.prepare(
    "SELECT COUNT(*) AS n FROM approvals WHERE instance_id = ? AND decision = 'approved'"
  ).get(id).n;

  if (approvedCount >= rule.required_count) {
    db.prepare("UPDATE instances SET status = 'approved', completed_at = ? WHERE id = ?")
      .run(Date.now(), id);
  }
  res.json({ ok: true, approved_count: approvedCount, required_count: rule.required_count });
});

router.post('/instance/:id/reject', (req, res) => {
  const id = Number(req.params.id);
  const userId = req.user.sub;
  const { comment } = req.body || {};

  const inst = db.prepare('SELECT * FROM instances WHERE id = ?').get(id);
  if (!inst) return res.status(404).json({ error: 'Instance not found' });
  if (inst.status !== 'pending') return res.status(400).json({ error: 'Instance not pending' });

  const rule = getRule(inst.template_id);
  if (!rule) return res.status(400).json({ error: 'No approval rule defined' });
  if (!rule.approver_user_ids.includes(userId)) {
    return res.status(403).json({ error: 'You are not an approver for this template' });
  }
  const already = db.prepare(
    'SELECT id FROM approvals WHERE instance_id = ? AND approver_user_id = ?'
  ).get(id, userId);
  if (already) return res.status(400).json({ error: 'Already decided' });

  db.prepare(`
    INSERT INTO approvals (instance_id, approver_user_id, decision, comment, decided_at)
    VALUES (?, ?, 'rejected', ?, ?)
  `).run(id, userId, comment || '', Date.now());

  db.prepare("UPDATE instances SET status = 'rejected', completed_at = ? WHERE id = ?")
    .run(Date.now(), id);

  res.json({ ok: true });
});

module.exports = router;
