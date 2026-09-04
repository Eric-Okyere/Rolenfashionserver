const Settings = require('../models/Settings');
const { fileUrl } = require('../middleware/upload');
const { normalizeMapEmbedUrl, isEmbeddableUrl, buildAddressEmbedUrl } = require('../utils/mapUrl');

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
    const original = updates.mapEmbedUrl;
    try {
      updates.mapEmbedUrl = await normalizeMapEmbedUrl(original);
    } catch (err) {
      console.error('normalizeMapEmbedUrl threw, will try the address fallback:', err.message);
      updates.mapEmbedUrl = original;
    }
    // Belt-and-suspenders: if normalization still didn't land on something
    // Google will actually render in an <iframe> (the short link's redirect
    // chain did something unexpected, a network hiccup, etc.), don't leave
    // a link stored that we already know won't embed. Fall back to building
    // the map from the campus address instead — less precise than the exact
    // pin an admin shared, but it guarantees the Contact page always shows
    // *some* working map rather than a blank box.
    if (!isEmbeddableUrl(updates.mapEmbedUrl)) {
      const address = updates.address ?? settings.address;
      const city = updates.city ?? settings.city;
      const country = updates.country ?? settings.country;
      const fallback = buildAddressEmbedUrl([address, city, country]);
      if (fallback) {
        console.error(
          `Could not turn "${original}" into an embeddable map URL — falling back to an address-based map instead.`
        );
        updates.mapEmbedUrl = fallback;
      }
      // If there's no address either, leave whatever normalizeMapEmbedUrl
      // produced (likely the original text) — still better than losing the
      // admin's input outright.
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
