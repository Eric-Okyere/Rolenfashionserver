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

// Rolen's real courses, as given directly by the school's co-owner — five
// standalone 6-month programs, each GHS 7,000 (from the Fees & Payment
// Schedule flyer — see Settings.paymentScheduleText for the full breakdown).
const sampleCourses = [
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
    await Settings.create({
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
