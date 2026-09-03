const Settings = require('../models/Settings');
const { fileUrl } = require('../middleware/upload');

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
  Object.assign(settings, req.body);
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
