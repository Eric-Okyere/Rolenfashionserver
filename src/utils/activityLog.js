const ActivityLog = require('../models/ActivityLog');

// Records one row in the site-wide activity feed (see models/ActivityLog).
// Deliberately never throws — a failure to log an activity should never
// break the real request that triggered it (application submitted, course
// saved, etc.), so any error here is swallowed and just logged to the console.
//
// `actor` is the acting User document (or undefined for a public/anonymous
// action like a student submitting an application).
async function logActivity({ type, summary, meta, actor }) {
  try {
    await ActivityLog.create({
      type,
      summary,
      meta,
      actor: actor?._id,
      actorName: actor?.name,
    });
  } catch (err) {
    console.error('Failed to record activity log:', err.message);
  }
}

module.exports = logActivity;
