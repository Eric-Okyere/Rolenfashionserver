const ActivityLog = require('../models/ActivityLog');

// GET /api/activity (admin/staff) — most recent activity across the site,
// paginated with a "before" cursor (an ISO date string) so the admin
// console can page back through history without skipping/duplicating rows
// as new activity comes in.
async function listActivity(req, res) {
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const filter = {};
  if (req.query.before) {
    const before = new Date(req.query.before);
    if (!Number.isNaN(before.getTime())) filter.createdAt = { $lt: before };
  }
  const activity = await ActivityLog.find(filter).sort({ createdAt: -1 }).limit(limit);
  res.json({ activity, hasMore: activity.length === limit });
}

module.exports = { listActivity };
