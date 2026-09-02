// One-time migration for a database that was already seeded with placeholder
// or earlier-guess course/contact data. Safe to run more than once — it only
// ever touches the known placeholder titles (including an earlier single
// "Fashion and Design" course guess this migration itself used to create)
// and the Settings singleton's address/phone fields, so anything Eric has
// already customized elsewhere in Admin → Settings is left untouched.
//
// Usage: npm run migrate:real-content   (from /server, with .env configured)
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Course = require('../models/Course');
const Settings = require('../models/Settings');

const PLACEHOLDER_TITLES = [
  'Diploma in Fashion Design',
  'Certificate in Tailoring & Pattern Making',
  'Diploma in Textiles & Surface Design',
  'Certificate in Fashion Entrepreneurship',
  'Short Course: Introduction to Fashion Illustration',
  // An earlier round of this migration guessed the flyer described one
  // combined program — Eric corrected that to five standalone courses, so
  // clean up that earlier guess too.
  'Fashion and Design',
];

// Rolen's real courses, as given directly by the school's co-owner — five
// standalone 6-month programs, no published fee.
const realCourses = [
  {
    title: 'Fashion Theory',
    category: 'Fashion Design',
    summary: 'Foundational theory behind fashion design — principles, history, and design thinking.',
    description:
      'A 6-month foundation in fashion design theory: design principles, fashion history, and how designers think through a garment from concept to collection. Runs at our Weija, Accra campus.',
    duration: '6 Months (Mon – Fri)',
    level: 'All Levels',
    intakePeriods: ['Rolling admissions'],
    order: 1,
    isPublished: true,
  },
  {
    title: 'Textile Appreciation',
    category: 'Textiles',
    summary: 'Understanding fabrics — fiber types, weaves, and how to choose the right textile for a design.',
    description:
      'A 6-month course in textiles: fiber and fabric types, weaves and finishes, and how to select and work with the right material for a garment. Runs at our Weija, Accra campus.',
    duration: '6 Months (Mon – Fri)',
    level: 'All Levels',
    intakePeriods: ['Rolling admissions'],
    order: 2,
    isPublished: true,
  },
  {
    title: 'Pattern Drafting',
    category: 'Tailoring',
    summary: 'Drafting garment patterns from measurements — the technical foundation of tailoring.',
    description:
      'A 6-month, hands-on course in pattern drafting: taking body measurements and drafting accurate garment patterns by hand — the technical foundation every tailor and designer builds on. Runs at our Weija, Accra campus.',
    duration: '6 Months (Mon – Fri)',
    level: 'All Levels',
    intakePeriods: ['Rolling admissions'],
    order: 3,
    isPublished: true,
  },
  {
    title: 'Garment Construction',
    category: 'Tailoring',
    summary: 'Turning patterns into finished garments — cutting, sewing, and finishing techniques.',
    description:
      'A 6-month, studio-based course in garment construction: cutting fabric, machine and hand-sewing techniques, and finishing a garment to a professional standard. Runs at our Weija, Accra campus.',
    duration: '6 Months (Mon – Fri)',
    level: 'All Levels',
    intakePeriods: ['Rolling admissions'],
    order: 4,
    isPublished: true,
  },
  {
    title: 'Modern Sewing Technologies',
    category: 'Tailoring',
    summary: 'Working with modern sewing machines and techniques used in today\'s garment industry.',
    description:
      'A 6-month course covering the sewing machines and techniques used in modern garment production — building speed, precision, and industry-ready sewing skills. Runs at our Weija, Accra campus.',
    duration: '6 Months (Mon – Fri)',
    level: 'All Levels',
    intakePeriods: ['Rolling admissions'],
    order: 5,
    isPublished: true,
  },
];

async function run() {
  await connectDB();

  // Remove placeholder / earlier-guess courses (by exact title match only).
  const { deletedCount } = await Course.deleteMany({ title: { $in: PLACEHOLDER_TITLES } });
  console.log(`Removed ${deletedCount} placeholder/outdated course(s).`);

  // Create (or update, if it already exists) each real course.
  for (const c of realCourses) {
    const existing = await Course.findOne({ title: c.title });
    if (existing) {
      Object.assign(existing, c);
      await existing.save();
      console.log(`Updated existing "${c.title}" course.`);
    } else {
      await Course.create(c);
      console.log(`Created "${c.title}" course.`);
    }
  }

  // Update only address/phone on the Settings singleton — everything else
  // Eric has already set (school name, tagline, logo, socials, whatsapp,
  // etc.) stays untouched. WhatsApp is a separate number from `phone` and
  // hasn't been given yet, so this migration deliberately does not touch
  // `whatsapp` — set it directly in Admin → Settings once known.
  const settings = await Settings.findOne();
  if (settings) {
    settings.address = 'Weija-Accra';
    settings.city = settings.city || 'Accra';
    settings.country = settings.country || 'Ghana';
    settings.phone = '055 339 3254 / 024 344 2262';
    await settings.save();
    console.log('Updated Settings address/phone with real contact info.');
  } else {
    console.log('No Settings document found — run `npm run seed` first.');
  }

  console.log('Migration complete. Instagram handle was not fully legible in the flyer — add it yourself in Admin → Settings.');
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
