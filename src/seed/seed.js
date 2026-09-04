// Seeds a starter admin account, school settings, sample courses, gallery captions
// and testimonials so the site isn't empty on first run.
// Usage: npm run seed   (from /server, with .env configured)
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Course = require('../models/Course');
const Settings = require('../models/Settings');
const Testimonial = require('../models/Testimonial');
const { normalizeMapEmbedUrl, isEmbeddableUrl, buildAddressEmbedUrl } = require('../utils/mapUrl');

// Share link Eric sent for the campus location, copied from the Google Maps
// app's Share button — converted into a working `output=embed` URL below
// (see mapUrl.js for why the raw share link can't be used directly).
const CAMPUS_MAP_LINK = 'https://maps.app.goo.gl/21JXhDNBNHakXVuK9?g_st=aw';

// Rolen's real program structure, as given directly by the school's
// co-owner: students don't pick one subject out of several — every student
// takes all five subject areas together, and the actual choice is which
// class *track* they enroll in. So the catalog is two tracks, not five
// standalone subjects (see apply-real-content.js for how an already-seeded
// database migrates off the old five-subject-course structure safely).
const sampleCourses = [
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
  },
];

const sampleTestimonials = [
  {
    name: 'Ama Serwaa',
    role: 'Alumna, Diploma in Fashion Design',
    quote:
      'Rolen gave me the technical skills and confidence to launch my own label. The instructors push you to find your own voice as a designer.',
    rating: 5,
  },
  {
    name: 'Kwabena Owusu',
    role: 'Alumnus, Tailoring & Pattern Making',
    quote: 'The hands-on studio time made all the difference — I was making client-ready garments before I graduated.',
    rating: 5,
  },
];

async function run() {
  await connectDB();

  // Admin user
  const adminEmail = (process.env.SEED_ADMIN_EMAIL || 'admin@rolenfashion.example').toLowerCase();
  const existingAdmin = await User.findOne({ email: adminEmail });
  if (!existingAdmin) {
    await User.create({
      name: process.env.SEED_ADMIN_NAME || 'Rolen Admin',
      email: adminEmail,
      password: process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!',
      role: 'admin',
      isCEO: true,
    });
    console.log(`Created admin account: ${adminEmail} (change the password after first login!)`);
  } else {
    console.log(`Admin account already exists: ${adminEmail}`);
  }

  // Settings singleton
  const settingsCount = await Settings.countDocuments();
  if (settingsCount === 0) {
    const resolvedMapEmbedUrl = await normalizeMapEmbedUrl(CAMPUS_MAP_LINK);
    // Fall back to the known campus address if resolving the share link
    // didn't produce anything embeddable (see mapUrl.js / apply-real-content.js
    // for why that can happen) — guarantees a fresh install still gets a
    // working Contact-page map either way.
    const mapEmbedUrl = isEmbeddableUrl(resolvedMapEmbedUrl)
      ? resolvedMapEmbedUrl
      : buildAddressEmbedUrl(['McCarthy Hill, West Accra', 'Accra', 'Ghana']) || resolvedMapEmbedUrl;
    await Settings.create({
      mapEmbedUrl,
      logoUrl: '/uploads/signatures/rolen-logo-default.png',
      // "McCarthy Hill, West Accra" — Eric's best-guess spelling in chat was
      // "machatty west Accra"; McCarthy Hill is the well-known West Accra
      // neighborhood near the Weija/Mallam area this most likely refers to.
      // Worth Eric double-checking the spelling in Admin → Settings.
      address: 'McCarthy Hill, West Accra',
      city: 'Accra',
      country: 'Ghana',
      phone: '055 339 3254 / 024 344 2262',
      // Official school email, given directly by Eric.
      email: 'ababryan3@gmail.com',
      // CEO name, given directly by Eric — replaces the "[CEO full name]"
      // placeholder printed above the signature on every admission letter.
      ceoName: 'Rose Bryan-Okyere',
      // CEO signature Eric shared directly — bundled into the repo (like the
      // logo) so it ships with every deploy rather than depending on
      // Render's ephemeral disk. Admin can replace it any time via
      // Admin → Settings → Admission Letter & CEO Signature.
      ceoSignatureUrl: '/uploads/signatures/rolen-ceo-signature-default.png',
      // WhatsApp is a separate number from the phone line(s) above and
      // hasn't been given yet — left blank rather than guessed. Set it in
      // Admin → Settings once known (the Contact page and the site-wide
      // WhatsApp button both read from this field independently of `phone`).
      // Real "List of Materials" / "Fabrics Needed" flyer content, given
      // directly by Eric — printed as page 2 of every admission letter.
      materialsList: [
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
      ],
      fabricsList: ['Cotton', 'Rayon', 'Chiffon', 'Plaid', 'Lace/ satin'],
      materialsNote: 'NB: Fabrics should be brought as and when they will be needed.',
      // Two-tier tuition, given directly by Eric — replaces the old single
      // "Tuition for this program is GHS 7,000" auto line (see
      // generateAdmissionLetter.js), since it now covers both tracks.
      tuitionText:
        'Tuition for the Beginner class (6 months) is GHS 7,000. Tuition for the Advanced class (3 months) is GHS 10,000.',
      // Real "Fees and Payment Schedule" flyer content, given directly by
      // Eric — printed on the same admission-letter page as the materials list.
      paymentScheduleText:
        'For Beginners, the duration is Six (6) months. The cost is Seven Thousand Ghana Cedis (GHS 7,000.00).\n\nPayment Schedule: GHS 5,000.00 payable before commencement of class and the balance paid within a scheduled 3-month installments.',
      // Class days/times per track and the academic terms, given directly by
      // Eric — printed as its own section on admission letter page 2.
      scheduleText:
        'Beginner class: Monday – Wednesday, 9:00am – 2:00pm.\nAdvanced class: Thursday – Friday, 9:00am – 2:00pm.\n\nAcademic terms: March – September and September – March.',
    });
    console.log('Created default school settings — edit real details in Admin → Settings.');
  }

  // Courses
  for (const c of sampleCourses) {
    const exists = await Course.findOne({ title: c.title });
    if (!exists) await Course.create(c);
  }
  console.log(`Ensured ${sampleCourses.length} sample courses exist.`);

  // Testimonials
  for (const t of sampleTestimonials) {
    const exists = await Testimonial.findOne({ name: t.name, quote: t.quote });
    if (!exists) await Testimonial.create(t);
  }
  console.log(`Ensured ${sampleTestimonials.length} sample testimonials exist.`);

  console.log('Seed complete.');
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
