const mongoose = require('mongoose');
const slugify = require('slugify');

const courseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, unique: true },
    category: {
      type: String,
      enum: ['Fashion Design', 'Tailoring', 'Textiles', 'Business', 'Short Course', 'Other'],
      default: 'Fashion Design',
    },
    summary: { type: String, required: true, maxlength: 300 },
    description: { type: String, required: true },
    duration: { type: String, required: true }, // e.g. "6 months", "2 years"
    level: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced', 'All Levels'], default: 'All Levels' },
    fee: { type: Number }, // in GHS — optional; some programs don't publish a fee
    feeCurrency: { type: String, default: 'GHS' },
    intakePeriods: [{ type: String }], // e.g. ["January", "May", "September"]
    image: { type: String }, // path/URL to a cover image
    curriculum: [{ type: String }], // list of modules/topics
    isPublished: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

courseSchema.pre('validate', function generateSlug(next) {
  if (this.title) {
    this.slug = slugify(this.title, { lower: true, strict: true });
  }
  next();
});

module.exports = mongoose.model('Course', courseSchema);
