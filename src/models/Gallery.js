const mongoose = require('mongoose');

const gallerySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    // Every product needs a photo; the video is an optional companion clip
    // shown alongside it (not a replacement for the image).
    imageUrl: { type: String, required: true }, // /uploads/gallery/<file>
    videoUrl: { type: String }, // /uploads/gallery/<file>, optional
    category: { type: String, enum: ['Ready-to-Wear', 'Bridal', 'Accessories', 'Student Work', 'Runway', 'Other'], default: 'Other' },
    price: { type: Number }, // optional, if the item is for sale
    isFeatured: { type: Boolean, default: false },
    isPublished: { type: Boolean, default: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Gallery', gallerySchema);
