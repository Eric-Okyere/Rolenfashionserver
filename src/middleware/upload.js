const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const UPLOAD_ROOT = path.join(__dirname, '..', '..', 'uploads');

const ALLOWED_IMAGE = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
const ALLOWED_VIDEO = ['.mp4', '.mov', '.webm'];

function safeName(originalName) {
  const ext = path.extname(originalName).toLowerCase();
  const random = crypto.randomBytes(8).toString('hex');
  return `${Date.now()}-${random}${ext}`;
}

function makeStorage(subfolder) {
  const dir = path.join(UPLOAD_ROOT, subfolder);
  fs.mkdirSync(dir, { recursive: true });
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, dir),
    filename: (req, file, cb) => cb(null, safeName(file.originalname)),
  });
}

// A rejected file surfaces as a plain Error from multer's fileFilter — tag it
// with statusCode so the centralized error handler returns a clean 400 with
// the real message instead of falling through to a generic 500.
function badFileType(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
}

function fileFilter(allowedExts) {
  return (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedExts.includes(ext)) {
      return cb(badFileType(`Unsupported file type: ${ext}`));
    }
    cb(null, true);
  };
}

// Like fileFilter, but the allowed extensions depend on which form field the
// file came in on — e.g. a multi-file upload where an "image" field must be
// a photo and a "video" field must be a video.
function fileFilterByField(allowedExtsByField) {
  return (req, file, cb) => {
    const allowedExts = allowedExtsByField[file.fieldname];
    if (!allowedExts) {
      return cb(badFileType(`Unexpected field: ${file.fieldname}`));
    }
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedExts.includes(ext)) {
      return cb(badFileType(`Unsupported file type for ${file.fieldname}: ${ext}`));
    }
    cb(null, true);
  };
}

const maxBytes = (parseInt(process.env.MAX_UPLOAD_MB, 10) || 50) * 1024 * 1024;

const uploadImage = multer({
  storage: makeStorage('signatures'),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: fileFilter(ALLOWED_IMAGE),
});

// Gallery/shop products: a required product photo ("image" field) optionally
// paired with a product video ("video" field) — see gallery.routes.js, which
// wires this up with .fields([{ name: 'image' }, { name: 'video' }]).
const uploadGallery = multer({
  storage: makeStorage('gallery'),
  limits: { fileSize: maxBytes },
  fileFilter: fileFilterByField({ image: ALLOWED_IMAGE, video: ALLOWED_VIDEO }),
});

const uploadCourseImage = multer({
  storage: makeStorage('courses'),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: fileFilter(ALLOWED_IMAGE),
});

// Optional passport-style photo a student attaches to their admission
// application — see application.routes.js (POST /api/applications).
const uploadApplicationPhoto = multer({
  storage: makeStorage('applications'),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: fileFilter(ALLOWED_IMAGE),
});

module.exports = { uploadImage, uploadGallery, uploadCourseImage, uploadApplicationPhoto, UPLOAD_ROOT };
