// One-time bulk-import for the first batch of 20 "Ready to Wear" photos Eric
// attached directly in chat. Grouped into 4 products (several photos were
// multiple poses/crops of the exact same garment from one shoot — including
// a few truly duplicate frames, which are left out entirely per Eric:
// "A product can have more than 1 picture but pictures must not duplicated").
// No price is set on any of these — Eric: "All products in ready to wear
// should have prices which I will add later." He'll add prices himself in
// Admin → Gallery & Shop once posted. He also said more batches of 20 are
// coming, so later batches get their own add-ready-to-wear-products-batchN.js
// file rather than editing this one.
//
// Mirrors add-lace-products.js exactly: loads server/.env the same way,
// connects with the same connectDB(), and is safe to re-run — any product
// whose title already exists in the Gallery collection is skipped rather
// than duplicated.
//
// Usage (from the Rolenfashionserver repo root):
//   node src/seed/add-ready-to-wear-products-batch1.js --dry   (prints the plan, touches nothing)
//   node src/seed/add-ready-to-wear-products-batch1.js         (uploads to Cloudinary + creates the products)
//
// Photos are expected at ../Claude outputs/ready_to_wear_batch1 relative to
// this repo (sibling to Rolenfashionserver, inside the shared
// rolen-fashion-school folder) — override with PHOTOS_DIR=/some/path if
// they're somewhere else.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Gallery = require('../models/Gallery');
const { cloudinary, cloudinaryConfigured } = require('../config/cloudinary');

const DRY_RUN = process.argv.includes('--dry');

const PHOTOS_DIR =
  process.env.PHOTOS_DIR || path.join(__dirname, '..', '..', '..', 'Claude outputs', 'ready_to_wear_batch1');

// Each entry is one product. `photos` lists the filenames inside PHOTOS_DIR
// that are the same garment, shot multiple times in the same sitting — the
// near-identical duplicate frames from that same sitting are deliberately
// left out of this list (not uploaded at all), so nothing duplicated ends
// up in the shop.
const PRODUCTS = [
  {
    title: 'Black & White Floral Tiered Halter Gown',
    photos: ['d6df04f7-image.jpg'],
    description: 'Black and white floral print tiered chiffon gown with a halter neckline and a colorful printed obi sash belt.',
  },
  {
    title: 'Red Baroque Print Ruffled Blouse & Skirt Set',
    photos: ['3daca32a-image.jpg', 'efd69a10-image.jpg', '22c0bc13-image.jpg', '73e8ca2b-image.jpg', '7cf094ae-image.jpg'],
    description: 'Red, black and gold baroque-print sheer ruffled high-neck blouse and matching tiered skirt, with a tie-neck ribbon.',
  },
  {
    title: 'Teal Dotted Swiss Belted Dress with African Print Trim',
    photos: ['20662f3f-image.jpg', 'b45ae142-image.jpg', 'e94db3a1-image.jpg', 'f50b7a80-image.jpg', '2927086a-image.jpg'],
    description: 'Teal dotted-swiss button-front midi dress with African-print shoulder and cuff trim, cinched with a matching printed belt.',
  },
  {
    title: 'Teal High-Neck Gathered Dress with African Print Collar',
    photos: ['4c3916bf-image.jpg', '2d8f5c49-image.jpg', '0cfa85a8-image.jpg'],
    description: 'Teal gathered midi dress with a ruffled African-print mandarin collar and matching bell-sleeve cuffs.',
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
      // No price — Eric will add this himself in Admin → Gallery & Shop.
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
  console.error('add-ready-to-wear-products-batch1 failed:', err);
  process.exit(1);
});
