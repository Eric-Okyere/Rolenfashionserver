const mongoose = require('mongoose');

// A "carousel post" is deliberately a separate content type from a Gallery
// product (see Gallery.js). Eric: "Carousel post should be different from
// product post. Carousels should be very big to be used for advertisement
// showing videos and pictures of the products of the business." — so this
// feeds the big homepage ad banner (one slide = one photo OR one video),
// while Gallery stays the actual product catalog (now up to 5 photos +
// a video per product). Keeping them as separate models means Eric decides
// exactly what the advertisement banner shows, instead of it being
// auto-derived from whatever happens to be in the catalog.
const carouselPostSchema = new mongoose.Schema(
  {
    // Optional headline/caption shown over the slide — e.g. "New Bridal
    // Collection". Not required: a slide can just be a striking photo/video
    // with no text overlay of its own.
    title: { type: String, trim: true },
    caption: { type: String, trim: true },
    // Exactly one of these two is required (enforced in the controller,
    // same "required companion, not both required" pattern as Gallery) —
    // a slide is either a photo ad or a video ad.
    imageUrl: { type: String }, // /uploads/carousel/<file> or Cloudinary URL
    videoUrl: { type: String },
    // Which shop category (if any) the slide's CTA button links to — reuses
    // the same brand-line names as Gallery.category, but isn't restricted to
    // them the way products are, since a slide can also promote something
    // general (e.g. the whole shop) with no specific category. Left as a
    // free string rather than an enum for that reason.
    linkCategory: { type: String, trim: true },
    ctaLabel: { type: String, trim: true, default: 'Shop Now' },
    // Lower numbers show first. Plain manual ordering (no drag-and-drop) —
    // simplest thing that works for a handful of ad slides.
    order: { type: Number, default: 0 },
    // Lets Eric pause a slide (e.g. an ad for a sold-out drop) without
    // losing it, same "soft toggle" pattern as Gallery.isPublished.
    isActive: { type: Boolean, default: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CarouselPost', carouselPostSchema);
