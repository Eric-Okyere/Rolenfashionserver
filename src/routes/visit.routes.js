const express = require('express');
const PageView = require('../models/PageView');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

const VISITOR_ID = /^[A-Za-z0-9-]{8,64}$/;
// Search engines, link-preview fetchers (WhatsApp, Facebook, …) and uptime
// pingers load pages too; they aren't people, so they're not counted.
const BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|headless|lighthouse|monitor|curl|wget|python|axios|node-fetch/i;
// A refresh of the same page within this window counts once, not twice.
const REPEAT_WINDOW_MS = 30 * 1000;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

// Public: the site calls this once per page a visitor opens. Always answers
// 204 (even when a view is skipped) so it never shows an error on the site.
router.post('/', async (req, res) => {
  try {
    const { visitorId, path } = req.body || {};
    const ua = req.get('user-agent') || '';
    if (
      typeof visitorId === 'string' &&
      VISITOR_ID.test(visitorId) &&
      typeof path === 'string' &&
      path.startsWith('/') &&
      path.length <= 200 &&
      !path.startsWith('/admin') &&
      !BOT_UA.test(ua)
    ) {
      const recent = await PageView.exists({
        visitorId,
        path,
        createdAt: { $gte: new Date(Date.now() - REPEAT_WINDOW_MS) },
      });
      if (!recent) await PageView.create({ visitorId, path, day: today() });
    }
  } catch (err) {
    // Counting a visit must never break the site — log and move on.
    console.error('Visit tracking failed:', err.message);
  }
  res.status(204).end();
});

async function totals(filter) {
  const [views, visitors] = await Promise.all([
    PageView.countDocuments(filter),
    PageView.distinct('visitorId', filter).then((ids) => ids.length),
  ]);
  return { views, visitors };
}

// Admin/staff: the numbers behind Admin → Visitors and the Dashboard tile.
router.get('/stats', protect, authorize('admin', 'staff'), async (req, res) => {
  const since30 = daysAgo(29);
  const [today_, last7, last30, allTime, daily, topPages] = await Promise.all([
    totals({ day: today() }),
    totals({ day: { $gte: daysAgo(6) } }),
    totals({ day: { $gte: since30 } }),
    totals({}),
    PageView.aggregate([
      { $match: { day: { $gte: since30 } } },
      { $group: { _id: '$day', views: { $sum: 1 }, ids: { $addToSet: '$visitorId' } } },
      { $project: { _id: 0, day: '$_id', views: 1, visitors: { $size: '$ids' } } },
      { $sort: { day: 1 } },
    ]),
    PageView.aggregate([
      { $match: { day: { $gte: since30 } } },
      { $group: { _id: '$path', views: { $sum: 1 }, ids: { $addToSet: '$visitorId' } } },
      { $project: { _id: 0, path: '$_id', views: 1, visitors: { $size: '$ids' } } },
      { $sort: { views: -1 } },
      { $limit: 10 },
    ]),
  ]);

  // Fill in days with no visits so the chart has all 30 days.
  const byDay = new Map(daily.map((d) => [d.day, d]));
  const days = Array.from({ length: 30 }, (_, i) => {
    const day = daysAgo(29 - i);
    return byDay.get(day) || { day, views: 0, visitors: 0 };
  });

  res.json({ today: today_, last7, last30, allTime, days, topPages });
});

module.exports = router;
