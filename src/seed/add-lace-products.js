// One-time bulk-import for the 18 "Lace" category photos Eric attached
// directly in chat (19 photos — one dress was shot in two locations, so it's
// one product with 2 photos). Written instead of posting these one-by-one
// through Admin → Gallery & Shop because the browser automation available
// couldn't attach files to that form's file input in this environment.
//
// Mirrors the existing seed scripts in this folder: loads server/.env the
// same way, connects with the same connectDB(), and is safe to re-run —
// any product whose title already exists in the Gallery collection is
// skipped rather than duplicated, so running this twice (or running --dry
// then the real thing) never creates doubles.
//
// Usage (from the Rolenfashionserver repo root, i.e. this script's npm
// package):
//   node src/seed/add-lace-products.js --dry      (prints the plan, touches nothing)
//   node src/seed/add-lace-products.js            (uploads to Cloudinary + creates the products)
//
// Photos are expected at ../Claude outputs/lace_photos relative to this
// repo (i.e. sibling to Rolenfashionserver, inside the shared
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
  process.env.PHOTOS_DIR || path.join(__dirname, '..', '..', '..', 'Claude outputs', 'lace_photos');

// Each entry is one product. `photos` lists 1-2 filenames inside PHOTOS_DIR —
// two filenames means the same dress photographed in two different settings
// (Eric: "Post these under Lace" on a batch of 19 photos of individually
// styled gowns — two pairs among them are clearly the same garment re-shot
// in a different location, everything else is a distinct piece).
const PRODUCTS = [
  { title: 'Coral Beaded Mermaid Gown', photos: ['42f00938-image.jpg'], description: 'Hand-beaded coral lace mermaid gown with a sculpted shoulder rosette.' },
  { title: 'Ivory Beaded Gown with Fascinator', photos: ['0b8e5600-image.jpg'], description: 'Ivory beaded lace gown with illusion long sleeves, styled with a fascinator.' },
  { title: 'Champagne Sequin Gown', photos: ['af4ed776-image.jpg'], description: 'Champagne sequin gown with sheer bell sleeves.' },
  { title: 'Olive & Gold Sequin Gown', photos: ['0a4c518d-image.jpg'], description: 'Olive and gold sequin gown with a satin waist bow.' },
  { title: 'Yellow Beaded Evening Gown', photos: ['7f283895-image.jpg', '8e79f5c1-image.jpg'], description: 'Yellow hand-beaded evening gown with a scalloped lace hem.' },
  { title: 'Tan Lace Halter Gown', photos: ['b93711de-image.jpg'], description: 'Tan lace halter-neck gown with a front slit.' },
  { title: 'Black Beaded Lace Gown', photos: ['ae601acb-image.jpg', 'a754503b-image.jpg'], description: 'Black beaded illusion lace gown with long sleeves.' },
  { title: 'Champagne Lace Gown with Sash', photos: ['917a8ba9-image.jpg'], description: 'Champagne lace gown with a crossed sash belt and bow-cuff sleeves.' },
  { title: 'Gold Draped Mermaid Gown', photos: ['f1e5399c-image.jpg'], description: 'Gold beaded mermaid gown with draped pearl-strand straps.' },
  { title: 'Champagne Floral Lace Gown', photos: ['6da01683-image.jpg'], description: 'Champagne floral beaded lace gown with a sculptural shoulder ornament.' },
  { title: 'Dusty Pink Lace Gown', photos: ['38219c51-image.jpg'], description: 'Dusty pink and gold fitted lace gown with an illusion yoke.' },
  { title: 'Emerald Satin Gown', photos: ['2479a47f-image.jpg'], description: 'Emerald satin gown with a beaded bodice and hip bow drape.' },
  { title: 'Champagne Lace Gown (Fitted)', photos: ['5de384c6-image.jpg'], description: 'Champagne lace gown, fitted silhouette with a gathered illusion yoke.' },
  { title: 'Champagne Lace Ball Gown', photos: ['cf33313e-image.jpg'], description: 'Champagne lace ball gown with a full A-line skirt.' },
  { title: 'Peach High-Neck Lace Gown', photos: ['49b5a7ba-image.jpg'], description: 'Peach lace gown with a mandarin collar and matching sash.' },
  { title: 'Blush Peplum Lace Gown', photos: ['940c8992-image.jpg'], description: 'Blush lace and sequin gown with a structured satin peplum.' },
  { title: 'Coral One-Shoulder Fringe Gown', photos: ['28c1f01a-image.jpg'], description: 'Coral and white one-shoulder gown with a fringe skirt.' },
];

const CATEGORY = 'Lace';

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
    console.log(`\nDRY RUN — would create ${PRODUCTS.length} products under "${CATEGORY}":\n`);
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
  console.error('add-lace-products failed:', err);
  process.exit(1);
});
