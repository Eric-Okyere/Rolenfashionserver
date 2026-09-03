// One-time migration for a database that was already seeded with placeholder
// or earlier-guess course/contact data. Safe to run more than once — it only
// ever touches the known placeholder titles (including an earlier single
// "Fashion and Design" course guess this migration itself used to create)
// and a specific set of Settings fields (address/email/phone/signature and
// the materials/fabrics/tuition/payment-schedule/class-schedule text — see
// the comments below for which are forced vs. fill-if-empty), so anything
// else Eric has already customized in Admin → Settings is left untouched.
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
// standalone 6-month (Beginner-track) programs. Fee (GHS 7,000, "For
// Beginners") is from the Fees & Payment Schedule flyer, given directly by
// Eric as applying across all five — this is what's shown on the public
// Courses pages. The admission letter's own tuition line no longer reads
// this field directly: it prints Settings.tuitionText instead (which now
// states both the Beginner and Advanced tuition), falling back to this
// per-course fee only if tuitionText is ever cleared.
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
    fee: 7000,
    feeCurrency: 'GHS',
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
    fee: 7000,
    feeCurrency: 'GHS',
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
    fee: 7000,
    feeCurrency: 'GHS',
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
    fee: 7000,
    feeCurrency: 'GHS',
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
    fee: 7000,
    feeCurrency: 'GHS',
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
    // "McCarthy Hill, West Accra" — Eric's best-guess spelling in chat was
    // "machatty west Accra"; McCarthy Hill is the well-known West Accra
    // neighborhood near the Weija/Mallam area this most likely refers to.
    // Worth Eric double-checking the spelling in Admin → Settings.
    settings.address = 'McCarthy Hill, West Accra';
    settings.city = settings.city || 'Accra';
    settings.country = settings.country || 'Ghana';
    settings.phone = '055 339 3254 / 024 344 2262';
    // Official school email, given directly by Eric.
    settings.email = 'ababryan3@gmail.com';
    // CEO name, given directly by Eric — replaces the "[CEO full name]"
    // placeholder printed above the signature on every admission letter.
    settings.ceoName = 'Rose Bryan-Okyere';
    // CEO signature Eric shared directly — only filled in if still empty, so
    // a re-run never clobbers a different signature he's since uploaded via
    // Admin → Settings. Bundled into the repo (like the logo) so it ships
    // with every deploy rather than depending on Render's ephemeral disk.
    if (!settings.ceoSignatureUrl) {
      settings.ceoSignatureUrl = '/uploads/signatures/rolen-ceo-signature-default.png';
    }

    // Real "List of Materials" / "Fabrics Needed" flyer content, given
    // directly by Eric — only filled in if still empty, so a re-run never
    // clobbers anything he's since edited in Admin → Settings.
    if (!settings.materialsList || settings.materialsList.length === 0) {
      settings.materialsList = [
        'A set of curves',
        'Gray baft',
        'Sketch pads',
        'Tape measure',
        'Brown paper',
        'A pair of scissors',
        'Seam ripper',
        'Sewing needles. Hand needles',
        'A pack of pins',
        'Threads',
        'Meter rule',
        'Specimen book',
        'Masking tape',
        'Tracing paper',
        'Tailor chalk',
        'Notebook',
      ];
    }
    if (!settings.fabricsList || settings.fabricsList.length === 0) {
      settings.fabricsList = ['Cotton', 'Rayon', 'Chiffon', 'Plaid', 'Lace/ satin'];
    }
    // Forced (not fill-if-empty) this round: the old note's "Classes are
    // from Mondays to Wednesdays only every week" line is now superseded by
    // the more accurate per-track scheduleText below (Beginner Mon–Wed,
    // Advanced Thu–Fri) — leaving both would contradict each other on the
    // same printed page, the same class of bug fixed earlier for tuition.
    settings.materialsNote = 'NB: Fabrics should be brought as and when they will be needed.';
    // Two-tier tuition, given directly by Eric — only filled in if still
    // empty. Replaces the old single "Tuition for this program is GHS
    // 7,000" auto line (see generateAdmissionLetter.js) since it now covers
    // both tracks.
    if (!settings.tuitionText) {
      settings.tuitionText =
        'Tuition for the Beginner class (6 months) is GHS 7,000. Tuition for the Advanced class (3 months) is GHS 10,000.';
    }
    // Real "Fees and Payment Schedule" flyer content, given directly by Eric.
    if (!settings.paymentScheduleText) {
      settings.paymentScheduleText =
        'For Beginners, the duration is Six (6) months. The cost is Seven Thousand Ghana Cedis (GHS 7,000.00).\n\nPayment Schedule: GHS 5,000.00 payable before commencement of class and the balance paid within a scheduled 3-month installments.';
    }
    // Class days/times per track and the academic terms, given directly by
    // Eric — only filled in if still empty.
    if (!settings.scheduleText) {
      settings.scheduleText =
        'Beginner class: Monday – Wednesday, 9:00am – 2:00pm.\nAdvanced class: Thursday – Friday, 9:00am – 2:00pm.\n\nAcademic terms: March – September and September – March.';
    }

    await settings.save();
    console.log('Updated Settings address/email/phone/ceo-name/signature/materials-fabrics/tuition/payment-schedule/class-schedule with real content.');
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
