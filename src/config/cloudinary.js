const cloudinary = require('cloudinary').v2;

// Cloudinary is optional-but-recommended: hosts like Render give a web
// service an ephemeral filesystem, so anything multer wrote to local disk
// (course/gallery/signature/application images, generated admission letter
// PDFs) is wiped on the next restart, redeploy, or free-tier spin-down —
// which is why uploaded pictures were "disappearing after a few minutes".
// When these three env vars are set, upload.js and generateAdmissionLetter.js
// store files in Cloudinary instead, which survives all of that. When they
// aren't set (e.g. plain local dev), everything gracefully falls back to the
// original local-disk behavior — see cloudinaryConfigured below.
const cloudinaryConfigured = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (cloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

module.exports = { cloudinary, cloudinaryConfigured };
