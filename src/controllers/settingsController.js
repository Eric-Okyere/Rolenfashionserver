const Settings = require('../models/Settings');
const { fileUrl } = require('../middleware/upload');
const { normalizeMapEmbedUrl } = require('../utils/mapUrl');

async function getOrCreateSettings() {
  let settings = await Settings.findOne();
  if (!settings) settings = await Settings.create({});
  return settings;
}

// GET /api/settings (public)
async function getSettings(req, res) {
  const settings = await getOrCreateSettings();
  res.json({ settings });
}

// PUT /api/settings (admin)
async function updateSettings(req, res) {
  const settings = await getOrCreateSettings();
  const updates = { ...req.body };
  // Admins paste all kinds of things into "Google Maps Embed URL" — a share
  // link copied from the Google Maps app (maps.app.goo.gl/...), a normal
  // (non-embed) maps.google.com link, or just a typed address — none of
  // which Google will actually render inside an <iframe> as-is. Normalize
  // whatever was pasted into a working embeddable URL here, once, at save
  // time (see mapUrl.js for why). Best-effort: never let a map-link hiccup
  // block the rest of the settings from saving.
  if (typeof updates.mapEmbedUrl === 'string' && updates.mapEmbedUrl.trim()) {
    try {
      updates.mapEmbedUrl = await normalizeMapEmbedUrl(updates.mapEmbedUrl);
    } catch (err) {
      console.error('normalizeMapEmbedUrl failed, saving the original value unchanged:', err.message);
    }
  }
  Object.assign(settings, updates);
  await settings.save();
  res.json({ settings });
}

// POST /api/settings/signature (admin) — upload CEO signature image
async function uploadSignature(req, res) {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });
  const settings = await getOrCreateSettings();
  settings.ceoSignatureUrl = fileUrl(req.file, 'signatures');
  await settings.save();
  res.json({ settings });
}

// POST /api/settings/logo (admin)
async function uploadLogo(req, res) {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });
  const settings = await getOrCreateSettings();
  settings.logoUrl = fileUrl(req.file, 'signatures');
  await settings.save();
  res.json({ settings });
}

module.exports = { getSettings, updateSettings, uploadSignature, uploadLogo };
