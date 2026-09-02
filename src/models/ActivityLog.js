const mongoose = require('mongoose');

// A running feed of notable events across the site — new applications,
// status changes, messages, newsletter signups, course/gallery/testimonial
// edits, staff logins and account creation — so the admin dashboard can
// show "what's happening" rather than just point-in-time counts.
const activityLogSchema = new mongoose.Schema(
  {
    type: { type: String, required: true }, // dot-namespaced, e.g. 'application.created'
    summary: { type: String, required: true }, // human-readable one-line description
    meta: { type: mongoose.Schema.Types.Mixed }, // extra structured data (ids, statuses, etc.)
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // staff/admin who did it, if any
    actorName: { type: String }, // snapshot of the actor's name — survives the account later being deleted
  },
  { timestamps: true }
);

// Almost every query on this collection is "most recent first" — index it.
activityLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
