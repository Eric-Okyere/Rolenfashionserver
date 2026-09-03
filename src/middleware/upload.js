const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { cloudinary, cloudinaryConfigured } = require('../config/cloudinary');

const UPLOAD_ROOT = path.join(__dirname, '..', '..', 'uploads');

const ALLOWED_IMAGE = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
const ALLOWED_VIDEO = ['.mp4', '.mov', '.webm'];

function safeName(originalName) {
  const ext = path.extname(originalName).toLowerCase();
  const random = crypto.randomBytes(8).toString('hex');
  return `${Date.now()}-${random}${ext}`;
}

// A minimal multer storage engine that streams the upload straight to
// Cloudinary instead of local disk. Implements the same _handleFile/
// _removeFile contract multer's built-in diskStorage does.
class CloudinaryStorage {
  constructor(folder, resourceTypeFor) {
    this.folder = folder;
    this.resourceTypeFor = typeof resourceTypeFor === 'function' ? resourceTypeFor : () => resourceTypeFor || 'image';
  }

  _handleFile(req, file, cb) {
    const publicId = safeName(file.originalname).replace(path.extname(file.originalname), '');
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: this.folder, resource_type: this.resourceTypeFor(file), public_id: publicId, overwrite: false },
      (err, result) => {
        if (err) return cb(err);
        // `path` mirrors what diskStorage sets it to, so downstream code can
        // treat both engines the same way (see fileUrl() below).
        cb(null, { path: result.secure_url, filename: result.public_id, size: result.bytes });
      }
    );
    file.stream.on('error', (err) => uploadStream.destroy(err));
    file.stream.pipe(uploadStream);
  }

  _removeFile(req, file, cb) {
    cloudinary.uploader.destroy(file.filename, { resource_type: this.resourceTypeFor(file) }, () => cb(null));
  }
}

function makeStorage(subfolder, resourceTypeFor) {
  if (cloudinaryConfigured) {
    return new CloudinaryStorage(`rolen/${subfolder}`, resourceTypeFor);
  }
  const dir = path.join(UPLOAD_ROOT, subfolder);
  fs.mkdirSync(dir, { recursive: true });
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, dir),
    filename: (req, file, cb) => cb(null, safeName(file.originalname)),
  });
}

// Turns a multer file object into the URL that should be saved on the
// document — the Cloudinary secure_url when Cloudinary is configured
// (CloudinaryStorage already put that in `file.path`), or the local
// `/uploads/<subfolder>/<filename>` path served by app.js's static route.
function fileUrl(file, subfolder) {
  if (!file) return undefined;
  if (file.path && /^https?:\/\//i.test(file.path)) return file.path;
  return `/uploads/${subfolder}/${file.filename}`;
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
  storage: makeStorage('gallery', (file) => (file.fieldname === 'video' ? 'video' : 'image')),
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

module.exports = {
  uploadImage,
  uploadGallery,
  uploadCourseImage,
  uploadApplicationPhoto,
  UPLOAD_ROOT,
  fileUrl,
};
