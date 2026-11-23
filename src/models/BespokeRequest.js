const mongoose = require('mongoose');

// Eric: "add [Request a bespoke outfit] form to the site" — modelled on the
// Euna site's bespoke form. A customer describes the outfit they want,
// attaches up to 4 inspiration photos, optionally gives measurements (in
// inches), and leaves contact details; Rolen replies with a quote. No
// payment is taken here.
const OUTFIT_TYPES = [
  'Bridal gown',
  'Engagement / Kente',
  'Evening / dinner gown',
  'Kaba & slit',
  'Corporate wear',
  'Party dress',
  'Bridesmaids',
  "Men's wear",
  'Other',
];
const BUDGETS = ['Under 500', '500 – 1,000', '1,000 – 2,500', '2,500 – 5,000', 'Above 5,000'];
const FABRIC_OPTIONS = ['I will bring my fabric', 'Please source fabric for me', 'Not sure yet'];
const MEASUREMENT_KEYS = ['bust', 'waist', 'hips', 'shoulder', 'sleeve', 'length', 'neck', 'thigh', 'trouser', 'notes'];
const STATUSES = ['new', 'contacted', 'quoted', 'in progress', 'completed', 'declined'];

const bespokeRequestSchema = new mongoose.Schema(
  {
    outfitType: { type: String, enum: OUTFIT_TYPES, required: true },
    occasion: { type: String, trim: true, maxlength: 120 },
    eventDate: { type: Date },
    budget: { type: String, enum: [...BUDGETS, ''] },
    fabric: { type: String, enum: [...FABRIC_OPTIONS, ''] },
    description: { type: String, trim: true, maxlength: 3000 },
    photoUrls: { type: [String], validate: [(v) => v.length <= 4, 'Up to 4 photos.'] },
    measurements: Object.fromEntries(MEASUREMENT_KEYS.map((k) => [k, { type: String, trim: true, maxlength: k === 'notes' ? 500 : 20 }])),
    wantsFitting: { type: Boolean, default: false },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, required: true, trim: true, maxlength: 40 },
    email: { type: String, trim: true, lowercase: true, maxlength: 160 },
    status: { type: String, enum: STATUSES, default: 'new' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('BespokeRequest', bespokeRequestSchema);
module.exports.OUTFIT_TYPES = OUTFIT_TYPES;
module.exports.BUDGETS = BUDGETS;
module.exports.FABRIC_OPTIONS = FABRIC_OPTIONS;
module.exports.MEASUREMENT_KEYS = MEASUREMENT_KEYS;
module.exports.STATUSES = STATUSES;
