const mongoose = require('mongoose');

const gallerySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    // Every product needs a photo; the video is an optional companion clip
    // shown alongside it (not a replacement for the image). `imageUrl` is
    // kept as the single "cover" photo — every existing consumer (grid
    // thumbnails, category cover art, admin list) reads just this field, so
    // it stays populated exactly as before (the first uploaded photo).
    imageUrl: { type: String, required: true }, // /uploads/gallery/<file>
    // Eric: "Product post can have a video and five pictures." — the full
    // set of up to 5 photos for browsing in the product lightbox.
    // `imageUrl` above is always `imageUrls[0]`; older products created
    // before this field existed simply have an empty array here, and
    // GalleryItem.js falls back to just `imageUrl` in that case — nothing
    // needed migrating.
    imageUrls: {
      type: [String],
      validate: {
        validator: (arr) => arr.length <= 5,
        message: 'A product can have at most 5 photos.',
      },
      default: [],
    },
    videoUrl: { type: String }, // /uploads/gallery/<file>, optional
    // The shop's current, finalized brand-line structure, given directly by
    // Eric from his own naming/tagline session: Rolen Kente, Rolen Bridals,
    // Rolen Custom, Rolen Ready-to-Wear, and Rolen Bespoke — these are the
    // only options offered in the public shop filter and the admin
    // "Post a Product" form going forward. Every older category value
    // (including the previous "Nuptials / Kente / Exclusives / Melange by
    // Rolen" round, and the original generic values before that:
    // Ready-to-Wear, Bridal, Accessories, Student Work, Runway) is kept in
    // the enum — not removed — purely so any already-saved product with one
    // of those values doesn't fail validation the next time an admin edits/
    // saves it; same "don't break existing records" pattern used for
    // Application.gender and the retired standalone-subject courses.
    category: {
      type: String,
      enum: [
        'Rolen Kente',
        'Rolen Bridals',
        'Rolen Custom',
        'Rolen Ready-to-Wear',
        'Rolen Bespoke',
        'Lace',
        'Custom',
        'Wedding Gowns',
        'Other',
        'Nuptials',
        'Kente',
        'Exclusives',
        'Melange by Rolen',
        'Ready-to-Wear',
        'Bridal',
        'Accessories',
        'Student Work',
        'Runway',
      ],
      default: 'Other',
    },
    price: { type: Number }, // optional, if the item is for sale
    isFeatured: { type: Boolean, default: false },
    isPublished: { type: Boolean, default: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Gallery', gallerySchema);
