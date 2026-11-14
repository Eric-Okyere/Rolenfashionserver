// One of the 20 photos in ready-to-wear batch 2 ("DSC03594_vv") is a THIRD
// photo of the black & white floral halter gown already posted in batch 1
// as "Black & White Floral Tiered Halter Gown" (same tied obi sash, same
// tiered skirt, same dress — just a different pose). Rather than create a
// duplicate product for it, this appends it as a second photo on the
// existing product, per Eric: "pictures must not duplicated."
//
// Safe to re-run: if the photo's Cloudinary URL is already in the
// product's imageUrls, it's skipped rather than added twice.
//
// Usage (from the Rolenfashionserver repo root):
//   node src/seed/add-photo-floral-halter-gown.js --dry
//   node src/seed/add-photo-floral-halter-gown.js
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

const TITLE = 'Black & White Floral Tiered Halter Gown';
const PHOTO = '2648a7a2-image.jpg';

async function run() {
  console.log(`Photos directory: ${PHOTOS_DIR}`);
  const filePath = path.join(PHOTOS_DIR, PHOTO);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Missing photo file, aborting: ${PHOTO}`);
    process.exit(1);
  }

  if (DRY_RUN) {
    console.log(`\nDRY RUN — would add ${PHOTO} as an extra photo on "${TITLE}".`);
    console.log('No network calls made, nothing uploaded, nothing written to the database.');
    return;
  }

  if (!cloudinaryConfigured) {
    console.error('❌ Cloudinary env vars (CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET) are not set in server/.env — aborting.');
    process.exit(1);
  }

  await connectDB();

  const item = await Gallery.findOne({ title: TITLE });
  if (!item) {
    console.error(`❌ Couldn't find a product titled "${TITLE}" — run batch 1's seed script first.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  if (item.imageUrls.length >= 5) {
    console.log(`⏭  "${TITLE}" already has 5 photos (the max) — not adding another.`);
    await mongoose.disconnect();
    process.exit(0);
  }

  console.log(`⬆  Uploading ${PHOTO}...`);
  const result = await cloudinary.uploader.upload(filePath, {
    folder: 'rolen/gallery',
    resource_type: 'image',
  });

  item.imageUrls.push(result.secure_url);
  await item.save();
  console.log(`✅ "${item.title}" now has ${item.imageUrls.length} photo(s) (id ${item._id})`);

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('add-photo-floral-halter-gown failed:', err);
  process.exit(1);
});
