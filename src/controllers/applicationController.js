const Application = require('../models/Application');
const Course = require('../models/Course');
const Settings = require('../models/Settings');
const nextApplicationNumber = require('../utils/applicationNumber');
const generateAdmissionLetter = require('../utils/generateAdmissionLetter');
const logActivity = require('../utils/activityLog');
const { notifyNewApplication } = require('../utils/whatsapp');
const fs = require('fs');
const path = require('path');

// POST /api/applications (public) — a student applies
async function submitApplication(req, res) {
  const course = await Course.findById(req.body.course);
  if (!course) return res.status(400).json({ message: 'Selected course was not found.' });

  const applicationNumber = await nextApplicationNumber();

  const application = await Application.create({
    ...req.body,
    applicationNumber,
    status: 'pending',
    photoUrl: req.file ? `/uploads/applications/${req.file.filename}` : undefined,
  });

  await logActivity({
    type: 'application.created',
    summary: `New application from ${application.firstName} ${application.lastName} for ${course.title}`,
    meta: { applicationId: application._id, applicationNumber: application.applicationNumber },
  });

  // Fire-and-forget (not awaited) so a slow or unconfigured WhatsApp API
  // never delays the student's response — errors are caught internally and
  // this is a silent no-op until WHATSAPP_* env vars are set (see README).
  notifyNewApplication({
    applicantName: `${application.firstName} ${application.lastName}`,
    courseTitle: course.title,
    applicationNumber: application.applicationNumber,
  });

  res.status(201).json({
    message: 'Application submitted successfully. Save your application number to track your status.',
    applicationNumber: application.applicationNumber,
  });
}

// GET /api/applications/track/:applicationNumber?email= (public status check)
async function trackApplication(req, res) {
  const { applicationNumber } = req.params;
  const { email } = req.query;
  const application = await Application.findOne({ applicationNumber }).populate('course', 'title duration fee feeCurrency');

  if (!application || (email && application.email.toLowerCase() !== String(email).toLowerCase())) {
    return res.status(404).json({ message: 'No application found with that number and email.' });
  }

  res.json({
    application: {
      applicationNumber: application.applicationNumber,
      firstName: application.firstName,
      lastName: application.lastName,
      course: application.course,
      status: application.status,
      submittedAt: application.createdAt,
      reviewedAt: application.reviewedAt,
      canDownloadLetter: application.status === 'admitted' && !!application.admissionLetterPath,
    },
  });
}

// GET /api/applications/track/:applicationNumber/letter (public — only if admitted)
async function downloadLetter(req, res) {
  const { applicationNumber } = req.params;
  const { email } = req.query;
  const application = await Application.findOne({ applicationNumber });

  if (!application || (email && application.email.toLowerCase() !== String(email).toLowerCase())) {
    return res.status(404).json({ message: 'Application not found.' });
  }
  if (application.status !== 'admitted' || !application.admissionLetterPath) {
    return res.status(400).json({ message: 'Admission letter is not available for this application.' });
  }

  const filePath = path.join(__dirname, '..', '..', application.admissionLetterPath.replace(/^\/uploads/, 'uploads'));
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: 'Letter file missing on server.' });
  }
  res.download(filePath, `${application.applicationNumber}-admission-letter.pdf`);
}

// ---- Admin-only below ----

// GET /api/applications (admin)
async function listApplications(req, res) {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.course) filter.course = req.query.course;
  const applications = await Application.find(filter)
    .populate('course', 'title')
    .sort({ createdAt: -1 });
  res.json({ applications });
}

// GET /api/applications/:id (admin)
async function getApplication(req, res) {
  const application = await Application.findById(req.params.id).populate('course');
  if (!application) return res.status(404).json({ message: 'Application not found.' });
  res.json({ application });
}

// PATCH /api/applications/:id/status (admin) — approve/reject/waitlist etc.
// When status is set to 'admitted', a signed PDF admission letter is generated automatically.
async function updateStatus(req, res) {
  const { status, reviewNotes } = req.body;
  const application = await Application.findById(req.params.id).populate('course');
  if (!application) return res.status(404).json({ message: 'Application not found.' });

  application.status = status;
  application.reviewNotes = reviewNotes || application.reviewNotes;
  application.reviewedBy = req.user._id;
  application.reviewedAt = new Date();

  if (status === 'admitted') {
    const settings = (await Settings.findOne()) || (await Settings.create({}));
    const letterPath = await generateAdmissionLetter({
      application,
      course: application.course,
      settings,
    });
    application.admissionLetterPath = letterPath;
    application.admissionLetterGeneratedAt = new Date();
  }

  await application.save();

  await logActivity({
    type: 'application.status_changed',
    summary: `${req.user.name} marked ${application.firstName} ${application.lastName}'s application as ${status}`,
    meta: { applicationId: application._id, status },
    actor: req.user,
  });

  res.json({ application, message: `Application marked as ${status}.` });
}

// GET /api/applications/stats (admin) — quick dashboard counts
async function stats(req, res) {
  const counts = await Application.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
  const total = await Application.countDocuments();
  const byStatus = counts.reduce((acc, c) => ({ ...acc, [c._id]: c.count }), {});
  res.json({ total, byStatus });
}

module.exports = {
  submitApplication,
  trackApplication,
  downloadLetter,
  listApplications,
  getApplication,
  updateStatus,
  stats,
};
