const { Router } = require('express');
const cronParser = require('cron-parser');
const db = require('../db.js');
const { requireAuth } = require('../auth.js');

const router = Router();
router.use(requireAuth);

/**
 * Dashboard overview.
 * For each active schedule: compute the current period's start (cron.prev())
 * and next period's start (cron.next()). Check instances created in the current
 * period for that template. Determine status:
 *  - 'approved'  → someone filled & it was approved in this period
 *  - 'pending'   → filled and submitted, awaiting approval
 *  - 'draft'     → started but not submitted
 *  - 'overdue'   → nothing exists in this period yet
 */
router.get('/overview', (req, res) => {
  const schedules = db.prepare(`
    SELECT s.*, t.name AS template_name
    FROM schedules s
    JOIN templates t ON t.id = s.template_id
    WHERE s.active = 1
  `).all();

  const now = new Date();
  const items = [];

  for (const s of schedules) {
    let periodStart, nextDue;
    try {
      const interval = cronParser.parseExpression(s.cron_expression, {
        tz: s.timezone || 'Asia/Kolkata',
        currentDate: now
      });
      periodStart = interval.prev().toDate();
      const interval2 = cronParser.parseExpression(s.cron_expression, {
        tz: s.timezone || 'Asia/Kolkata',
        currentDate: now
      });
      nextDue = interval2.next().toDate();
    } catch {
      continue;
    }

    // Any instance for this template created at or after periodStart
    const inst = db.prepare(`
      SELECT id, status, created_by, created_at, submitted_at
      FROM instances
      WHERE template_id = ? AND created_at >= ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(s.template_id, periodStart.getTime());

    let periodStatus = 'overdue';
    if (inst) periodStatus = inst.status; // draft | pending | approved | rejected

    items.push({
      template_id: s.template_id,
      template_name: s.template_name,
      cron_expression: s.cron_expression,
      timezone: s.timezone,
      period_start: periodStart.getTime(),
      next_due: nextDue.getTime(),
      period_status: periodStatus,
      instance_id: inst?.id || null
    });
  }

  // Counts
  const myDrafts = db.prepare(
    "SELECT COUNT(*) AS n FROM instances WHERE created_by = ? AND status = 'draft'"
  ).get(req.user.sub).n;
  const mySubmitted = db.prepare(
    "SELECT COUNT(*) AS n FROM instances WHERE created_by = ? AND status = 'pending'"
  ).get(req.user.sub).n;

  // Count inbox: pending instances where user is an approver and hasn't decided
  let inboxCount = 0;
  const pendingInstances = db.prepare(
    "SELECT i.id, i.template_id FROM instances i WHERE i.status = 'pending'"
  ).all();
  for (const pi of pendingInstances) {
    const rule = db.prepare('SELECT approver_user_ids FROM approval_rules WHERE template_id = ?').get(pi.template_id);
    if (!rule) continue;
    const approvers = JSON.parse(rule.approver_user_ids || '[]');
    if (!approvers.includes(req.user.sub)) continue;
    const already = db.prepare(
      'SELECT id FROM approvals WHERE instance_id = ? AND approver_user_id = ?'
    ).get(pi.id, req.user.sub);
    if (!already) inboxCount++;
  }

  res.json({
    schedules: items,
    counts: {
      my_drafts: myDrafts,
      my_submitted: mySubmitted,
      inbox: inboxCount,
      overdue: items.filter(i => i.period_status === 'overdue').length
    }
  });
});

module.exports = router;
