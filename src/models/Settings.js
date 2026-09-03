const mongoose = require('mongoose');

// Singleton document holding site-wide, admin-editable content.
const settingsSchema = new mongoose.Schema(
  {
    schoolName: { type: String, default: 'Rolen School of Fashion and Design' },
    tagline: { type: String, default: 'Shaping Africa\'s next generation of fashion talent' },
    aboutText: { type: String, default: 'Rolen School of Fashion and Design trains designers, tailors and stylists with hands-on, industry-led programs.' },
    logoUrl: { type: String, default: '' },
    email: { type: String, default: 'info@rolenfashion.example' },
    phone: { type: String, default: '+233 000 000 000' },
    whatsapp: { type: String, default: '' },
    address: { type: String, default: '[Set your campus address in Admin → Settings]' },
    city: { type: String, default: 'Accra' },
    country: { type: String, default: 'Ghana' },
    mapEmbedUrl: { type: String, default: '' }, // Google Maps embed src
    latitude: { type: Number },
    longitude: { type: Number },
    facebookUrl: { type: String, default: '' },
    instagramUrl: { type: String, default: '' },
    tiktokUrl: { type: String, default: '' },
    twitterUrl: { type: String, default: '' },
    youtubeUrl: { type: String, default: '' },
    officeHours: { type: String, default: 'Mon - Fri, 8:00am - 5:00pm' },
    ceoName: { type: String, default: '[CEO full name]' },
    ceoTitle: { type: String, default: 'Chief Executive Officer' },
    ceoSignatureUrl: { type: String, default: '' }, // uploaded signature image, stamped on admission letters
    admissionLetterIntro: {
      type: String,
      default:
        'We are pleased to inform you that you have been offered admission to Rolen School of Fashion and Design. This letter confirms your place, subject to the terms below.',
    },
    // Printed as a second page on every admission letter (see
    // generateAdmissionLetter.js) so an admitted student can print their
    // letter and shopping list together in one go. Either list can be left
    // empty — the page is skipped entirely if both are empty.
    materialsList: { type: [String], default: [] }, // e.g. "A set of curves", "Tape measure"...
    fabricsList: { type: [String], default: [] }, // e.g. "Cotton", "Rayon"...
    materialsNote: { type: String, default: '' }, // freeform note, e.g. when fabrics are needed / class days
  },
  { timestamps: true }
);

module.exports = mongoose.model('Settings', settingsSchema);
