const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema(
  {
    applicationNumber: { type: String, unique: true, required: true }, // e.g. ROLEN-2026-000123
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    dateOfBirth: { type: Date, required: true },
    // The public form now only offers Female/Male (Eric: "gender should be
    // only male and female"). 'Other' and 'Prefer not to say' are kept in the
    // enum — not removed — purely so any already-submitted application that
    // saved one of those values doesn't fail validation the next time an
    // admin edits/saves it; new submissions can only ever produce the first two.
    gender: { type: String, enum: ['Female', 'Male', 'Other', 'Prefer not to say'] },
    address: { type: String, required: true },
    nationality: { type: String, default: 'Ghanaian' },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    intakePeriod: { type: String },
    priorEducation: { type: String },
    guardianName: { type: String },
    guardianPhone: { type: String },
    statementOfPurpose: { type: String, maxlength: 2000 },
    // Passport-style photo — required on new applications (enforced in
    // application.routes.js's validation, not here: Mongoose's `required`
    // validates the whole document on every save, which would break admins
    // updating the status of any application submitted before this field
    // became mandatory and so has no photo).
    photoUrl: { type: String },
    status: {
      type: String,
      enum: ['pending', 'under_review', 'admitted', 'rejected', 'waitlisted'],
      default: 'pending',
    },
    reviewNotes: { type: String },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    admissionLetterPath: { type: String }, // generated PDF path once admitted
    admissionLetterGeneratedAt: { type: Date },
  },
  { timestamps: true }
);

applicationSchema.index({ email: 1, course: 1 });

module.exports = mongoose.model('Application', applicationSchema);
