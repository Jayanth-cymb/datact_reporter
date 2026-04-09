const { Router } = require('express');
const cronParser = require('cron-parser');
const db = require('../db.js');
const { requireAuth, requireRole } = require('../auth.js');

const router = Router();
router.use(requireAuth);

function validateCron(expr, tz) {
  try {
    cronParser.parseExpression(expr, { tz: tz || 'Asia/Kolkata' });
    return true;
  } catch {
    return false;
  }
}

// GET schedule for a template
router.get('/template/:templateId', (req, res) => {
  const row = db.prepare('SELECT * FROM schedules WHERE template_id = ?').get(Number(req.params.templateId));
  res.json({ schedule: row || null });
});

// SET/UPDATE schedule (admin only)
router.put('/template/:templateId', requireRole('admin'), (req, res) => {
  const templateId = Number(req.params.templateId);
  const { cron_expression, timezone, active } = req.body || {};
  if (!cron_expression) return res.status(400).json({ error: 'cron_expression required' });
  const tz = timezone || 'Asia/Kolkata';
  if (!validateCron(cron_expression, tz)) {
    return res.status(400).json({ error: 'Invalid cron expression' });
  }
  const tpl = db.prepare('SELECT id FROM templates WHERE id = ?').get(templateId);
  if (!tpl) return res.status(404).json({ error: 'Template not found' });

  const existing = db.prepare('SELECT id FROM schedules WHERE template_id = ?').get(templateId);
  if (existing) {
    db.prepare(`UPDATE schedules SET cron_expression = ?, timezone = ?, active = ? WHERE template_id = ?`)
      .run(cron_expression, tz, active === false ? 0 : 1, templateId);
  } else {
    db.prepare(`INSERT INTO schedules (template_id, cron_expression, timezone, active) VALUES (?, ?, ?, ?)`)
      .run(templateId, cron_expression, tz, active === false ? 0 : 1);
  }
  const row = db.prepare('SELECT * FROM schedules WHERE template_id = ?').get(templateId);
  res.json({ schedule: row });
});

// DELETE schedule
router.delete('/template/:templateId', requireRole('admin'), (req, res) => {
  db.prepare('DELETE FROM schedules WHERE template_id = ?').run(Number(req.params.templateId));
  res.json({ ok: true });
});

// LIST all schedules
router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT s.*, t.name AS template_name
    FROM schedules s
    JOIN templates t ON t.id = s.template_id
    ORDER BY t.name
  `).all();
  res.json({ schedules: rows });
});

module.exports = router;
