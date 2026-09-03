const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema(
  {
    applicationNumber: { type: String, unique: true, required: true }, // e.g. ROLEN-2026-000123
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    dateOfBirth: { type: Date, required: true },
    gender: { type: String, enum: ['Female', 'Male', 'Other', 'Prefer not to say'] },
    address: { type: String, required: true },
    nationality: { type: String, default: 'Ghanaian' },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    intakePeriod: { type: String },
    priorEducation: { type: String },
    guardianName: { type: String },
    guardianPhone: { type: String },
    statementOfPurpose: { type: String, maxlength: 2000 },
    photoUrl: { type: String }, // optional passport-style photo uploaded with the application
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
