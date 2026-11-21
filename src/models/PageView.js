const mongoose = require('mongoose');

// Eric: "I want to know the number of people who visit the page." One
// document per public page view. `visitorId` is a random ID the visitor's
// browser makes up and keeps (localStorage) — no name, IP, email or other
// personal detail is stored — so "visitors" means distinct browsers, the
// same way most analytics tools count them. `day` is the calendar date the
// view happened on (Ghana is on UTC all year, so UTC dates match local
// dates). Views older than ~13 months are removed automatically (TTL index)
// so the collection never grows without limit.
const pageViewSchema = new mongoose.Schema(
  {
    visitorId: { type: String, required: true, index: true },
    path: { type: String, required: true },
    day: { type: String, required: true, index: true }, // YYYY-MM-DD
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

pageViewSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 400 });
pageViewSchema.index({ visitorId: 1, path: 1, createdAt: -1 });

module.exports = mongoose.model('PageView', pageViewSchema);
