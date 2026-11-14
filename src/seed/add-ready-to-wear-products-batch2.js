// Second batch of "Ready to Wear" photos Eric attached directly in chat.
// Out of 20 files, many were exact duplicate copies of the same shot saved
// under slightly different names (e.g. "DSC03600_hh", "..._hh_1", "..._hh_2",
// "..._hh_3" were all the identical frame) — those duplicates are left out
// entirely, per Eric: "pictures must not duplicated". What's left are 2 new
// distinct garments:
//   - a light blue dotted-swiss shirt dress with an African-print collar
//     accent (3 genuinely different photos)
//   - a black & white floral chiffon gown with an African-print corset
//     waist panel and bell sleeves (4 genuinely different photos)
// A third garment in this batch (a sleeveless black & white floral dress
// with a tied obi sash) is the SAME dress already posted in batch 1 as
// "Black & White Floral Tiered Halter Gown" — see
// add-photo-floral-halter-gown.js, which adds that one extra photo to the
// existing product instead of creating a duplicate listing.
//
// No price is set — Eric: "All products in ready to wear should have
// prices which I will add later."
//
// Usage (from the Rolenfashionserver repo root):
//   node src/seed/add-ready-to-wear-products-batch2.js --dry
//   node src/seed/add-ready-to-wear-products-batch2.js
//
// Photos expected at ../Claude outputs/ready_to_wear_batch2 — override with
// PHOTOS_DIR=/some/path if they're somewhere else.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Gallery = require('../models/Gallery');
const { cloudinary, cloudinaryConfigured } = require('../config/cloudinary');

const DRY_RUN = process.argv.includes('--dry');

const PHOTOS_DIR =
  process.env.PHOTOS_DIR || path.join(__dirname, '..', '..', '..', 'Claude outputs', 'ready_to_wear_batch2');

const PRODUCTS = [
  {
    title: 'Light Blue Dotted Swiss Shirt Dress with African Print Collar',
    photos: ['855bd862-image.jpg', 'fb505e05-image.jpg', 'f8c0fd11-image.jpg'],
    description: 'Light blue dotted-swiss chiffon shirt dress with bishop sleeves, button front, and an African-print collar and cuff accent.',
  },
  {
    title: 'Floral Chiffon Gown with African Print Corset Waist',
    photos: ['1c238de3-image.jpg', '16083583-image.jpg', '2c11e072-image.jpg', '8dd7973d-image.jpg'],
    description: 'Black and white floral chiffon gown with a deep V ruffle collar, bell sleeves, and a structured blue and purple African-print corset waist panel.',
  },
];

const CATEGORY = 'Rolen Ready-to-Wear';

async function run() {
  console.log(`Photos directory: ${PHOTOS_DIR}`);
  const missing = [];
  for (const p of PRODUCTS) {
    for (const file of p.photos) {
      if (!fs.existsSync(path.join(PHOTOS_DIR, file))) missing.push(file);
    }
  }
  if (missing.length) {
    console.error('❌ Missing photo file(s), aborting:', missing);
    process.exit(1);
  }

  if (DRY_RUN) {
    console.log(`\nDRY RUN — would create ${PRODUCTS.length} products under "${CATEGORY}" (no price set):\n`);
    for (const p of PRODUCTS) {
      console.log(`- ${p.title}  [${p.photos.join(', ')}]`);
    }
    console.log('\nNo network calls made, nothing uploaded, nothing written to the database.');
    return;
  }

  if (!cloudinaryConfigured) {
    console.error('❌ Cloudinary env vars (CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET) are not set in server/.env — aborting.');
    process.exit(1);
  }

  await connectDB();

  let created = 0;
  let skipped = 0;
  for (const p of PRODUCTS) {
    const existing = await Gallery.findOne({ title: p.title });
    if (existing) {
      console.log(`⏭  Skipping "${p.title}" — a product with this title already exists (id ${existing._id}).`);
      skipped++;
      continue;
    }

    console.log(`⬆  Uploading ${p.photos.length} photo(s) for "${p.title}"...`);
    const imageUrls = [];
    for (const file of p.photos) {
      const result = await cloudinary.uploader.upload(path.join(PHOTOS_DIR, file), {
        folder: 'rolen/gallery',
        resource_type: 'image',
      });
      imageUrls.push(result.secure_url);
    }

    const item = await Gallery.create({
      title: p.title,
      description: p.description,
      category: CATEGORY,
      imageUrl: imageUrls[0],
      imageUrls,
      isFeatured: false,
      isPublished: true,
    });
    console.log(`✅ Created "${item.title}" (id ${item._id})`);
    created++;
  }

  console.log(`\nDone. Created ${created}, skipped ${skipped} (already existed).`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('add-ready-to-wear-products-batch2 failed:', err);
  process.exit(1);
});
