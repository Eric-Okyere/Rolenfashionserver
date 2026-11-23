const BespokeRequest = require('../models/BespokeRequest');
const { MEASUREMENT_KEYS, STATUSES } = require('../models/BespokeRequest');
const { fileUrl, deleteUploadedFile } = require('../middleware/upload');
const logActivity = require('../utils/activityLog');
const { notifyBespokeRequest } = require('../utils/whatsapp');

// POST /api/bespoke (public) — multipart form: text fields + up to 4
// "photos". Measurements arrive as measurements[bust], measurements[waist]…
async function createRequest(req, res) {
  const b = req.body;
  const measurements = {};
  for (const k of MEASUREMENT_KEYS) {
    const v = b[`measurements[${k}]`] ?? b.measurements?.[k];
    if (v) measurements[k] = String(v);
  }
  const request = await BespokeRequest.create({
    outfitType: b.outfitType,
    occasion: b.occasion,
    eventDate: b.eventDate || undefined,
    budget: b.budget || '',
    fabric: b.fabric || '',
    description: b.description,
    photoUrls: (req.files || []).map((f) => fileUrl(f, 'bespoke')),
    measurements,
    wantsFitting: b.wantsFitting === 'true' || b.wantsFitting === true,
    name: b.name,
    phone: b.phone,
    email: b.email || undefined,
  });

  await logActivity({
    type: 'bespoke.requested',
    summary: `Bespoke request from ${request.name}: ${request.outfitType}`,
    meta: { bespokeRequestId: request._id },
  });
  // Fire-and-forget so WhatsApp never slows the customer's response.
  notifyBespokeRequest({ name: request.name, outfitType: request.outfitType, phone: request.phone });

  res.status(201).json({ message: 'Thank you! We have your request and will reply within 24 hours.', id: request._id });
}

// GET /api/bespoke (admin/staff)
async function listRequests(req, res) {
  const requests = await BespokeRequest.find().sort({ createdAt: -1 });
  res.json({ requests });
}

// PATCH /api/bespoke/:id/status (admin/staff)
async function updateStatus(req, res) {
  if (!STATUSES.includes(req.body.status)) return res.status(400).json({ message: 'Invalid status.' });
  const request = await BespokeRequest.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
  if (!request) return res.status(404).json({ message: 'Request not found.' });
  res.json({ request });
}

// DELETE /api/bespoke/:id (admin) — also removes its photos from storage.
async function deleteRequest(req, res) {
  const request = await BespokeRequest.findByIdAndDelete(req.params.id);
  if (request) for (const url of request.photoUrls || []) deleteUploadedFile(url);
  res.json({ message: 'Deleted.' });
}

module.exports = { createRequest, listRequests, updateStatus, deleteRequest };
