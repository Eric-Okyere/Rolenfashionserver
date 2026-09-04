// One-time migration for a database that was already seeded with placeholder
// or earlier-guess course/contact data. Safe to run more than once — it only
// ever touches the known placeholder titles (including an earlier single
// "Fashion and Design" course guess this migration itself used to create),
// the five old standalone-subject courses (unpublished, never deleted —
// see OLD_SUBJECT_TITLES below), the two real class-track courses, and a
// specific set of Settings fields (address/email/phone/ceoName/signature and
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
const { normalizeMapEmbedUrl } = require('../utils/mapUrl');

// The share link Eric sent for the campus location — copied straight from
// the Google Maps app's Share button. Resolved/converted into a working
// `output=embed` URL below via normalizeMapEmbedUrl() (same conversion that
// now happens automatically for anything pasted into Admin → Settings'
// "Campus Map" field going forward — see mapUrl.js for why the raw link
// can't be used directly in an <iframe>).
const CAMPUS_MAP_LINK = 'https://maps.app.goo.gl/21JXhDNBNHakXVuK9?g_st=aw';

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

// Eric later clarified the program structure further: students don't pick
// one of these five subjects — everyone takes all five together, and the
// actual choice is which class *track* (Beginner/Advanced) they enroll in.
// These five are retired in favor of the two realCourses tracks below, but
// — unlike PLACEHOLDER_TITLES above — deliberately NOT deleted: real
// applications may already reference these by ObjectId (Application.course
// is a ref), and deleting the Course docs would leave those applications
// pointing at nothing (breaking the admin "Program" display and any future
// letter regeneration for them). Unpublished instead, further down.
const OLD_SUBJECT_TITLES = [
  'Fashion Theory',
  'Textile Appreciation',
  'Pattern Drafting',
  'Garment Construction',
  'Modern Sewing Technologies',
];

// Rolen's real program structure, as given directly by the school's
// co-owner — two class tracks (not five standalone subjects; see
// OLD_SUBJECT_TITLES above for why that's changing and how it's handled
// safely). Beginner: 6 months, Mon–Wed, GHS 7,000. Advanced: 3 months,
// Thu–Fri, GHS 10,000. Both meet 9am–2pm and cover all five subject areas
// (fashion theory, textiles, pattern drafting, garment construction, modern
// sewing) as their curriculum. The admission letter's own tuition line
// still reads Settings.tuitionText first (a general two-track statement,
// admin-editable) — but now that each application's course carries the
// correct track-specific fee/duration, clearing tuitionText in Admin →
// Settings would make each letter auto-print just that applicant's own
// tuition instead, which is now accurate per-track.
const realCourses = [
  {
    title: 'Beginner Class',
    category: 'Fashion Design',
    summary: 'Our foundational 6-month program covering fashion theory, textiles, pattern drafting, garment construction and modern sewing.',
    description:
      'A 6-month, studio-based foundation covering all five core areas of fashion and tailoring: fashion theory, textile appreciation, pattern drafting, garment construction, and modern sewing technologies. Meets Monday to Wednesday, 9:00am – 2:00pm, at our McCarthy Hill, West Accra campus.',
    duration: '6 Months (Mon – Wed, 9am – 2pm)',
    level: 'Beginner',
    curriculum: ['Fashion Theory', 'Textile Appreciation', 'Pattern Drafting', 'Garment Construction', 'Modern Sewing Technologies'],
    intakePeriods: ['March – September', 'September – March'],
    order: 1,
    fee: 7000,
    feeCurrency: 'GHS',
    isPublished: true,
  },
  {
    title: 'Advanced Class',
    category: 'Fashion Design',
    summary: 'A faster-paced 3-month program building on the fundamentals across all five subject areas.',
    description:
      'A 3-month, studio-based advanced program covering all five core areas of fashion and tailoring — fashion theory, textile appreciation, pattern drafting, garment construction, and modern sewing technologies — at a faster pace and greater depth than the Beginner Class. Meets Thursday and Friday, 9:00am – 2:00pm, at our McCarthy Hill, West Accra campus.',
    duration: '3 Months (Thu – Fri, 9am – 2pm)',
    level: 'Advanced',
    curriculum: ['Fashion Theory', 'Textile Appreciation', 'Pattern Drafting', 'Garment Construction', 'Modern Sewing Technologies'],
    intakePeriods: ['March – September', 'September – March'],
    order: 2,
    fee: 10000,
    feeCurrency: 'GHS',
    isPublished: true,
  },
];

async function run() {
  await connectDB();

  // Remove placeholder / earlier-guess courses (by exact title match only).
  const { deletedCount } = await Course.deleteMany({ title: { $in: PLACEHOLDER_TITLES } });
  console.log(`Removed ${deletedCount} placeholder/outdated course(s).`);

  // Unpublish (never delete — see the comment on OLD_SUBJECT_TITLES above)
  // the five old standalone-subject courses now that the real structure is
  // two class tracks. Unpublishing removes them from the public Courses
  // pages and the admission form's course dropdown while keeping the
  // documents (and their ObjectIds) intact for any existing application
  // that already references one.
  const { modifiedCount: unpublishedCount } = await Course.updateMany(
    { title: { $in: OLD_SUBJECT_TITLES }, isPublished: true },
    { $set: { isPublished: false } }
  );
  console.log(`Unpublished ${unpublishedCount} old standalone-subject course(s) (kept for existing applications' history).`);

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
    // Campus map link, given directly by Eric — only filled in if still
    // empty, so a re-run never clobbers a different map link/address he's
    // since set in Admin → Settings. Converted to a working embeddable URL
    // here (rather than storing the raw share link) since this script talks
    // to the real internet (unlike the sandbox this was built in), so it can
    // actually resolve it — if that resolution fails for any reason (the
    // link changed, a network hiccup), it falls back to storing the raw
    // link rather than losing it, same as the live Admin → Settings save
    // path does.
    if (!settings.mapEmbedUrl) {
      settings.mapEmbedUrl = await normalizeMapEmbedUrl(CAMPUS_MAP_LINK);
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
