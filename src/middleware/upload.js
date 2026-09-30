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
        if (err) {
          // Cloudinary's own rejection (e.g. a photo over its plan's per-file
          // size limit) is the real, useful message here — tag it 400 so
          // errorHandler.js shows it to the admin verbatim instead of
          // falling through to a generic "Something went wrong." (Eric:
          // "let the form be able to take large pictures and video instead
          // of reducing the quality" — this makes the actual ceiling (his
          // Cloudinary plan's own limit, not this app) visible when hit.)
          err.statusCode = 400;
          return cb(err);
        }
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

// Removes a previously-uploaded file (photo or video) given the URL that was
// saved on a document — the counterpart to fileUrl() above, used when a
// product/slide is deleted so its media doesn't linger in Cloudinary or on
// local disk forever (Eric: "If a product is delete, delete the picture or
// the video also from cloudinary"). Handles both storage engines the same
// way callers already deal with URLs, so no caller needs to know which one
// is active. Best-effort: logs and resolves rather than throwing, so a
// storage hiccup never blocks the delete response the admin is waiting on.
async function deleteUploadedFile(url) {
  if (!url) return;
  try {
    if (/^https?:\/\//i.test(url)) {
      // Cloudinary URL, e.g.
      // https://res.cloudinary.com/<cloud>/video/upload/v169.../rolen/gallery/<id>.mp4
      // The public_id Cloudinary's API wants is the folder + basename
      // (no extension, no version segment) — "rolen/gallery/<id>" here.
      const resourceType = /\/video\/upload\//.test(url) ? 'video' : 'image';
      const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z0-9]+(?:\?.*)?$/);
      if (!match) return;
      await cloudinary.uploader.destroy(match[1], { resource_type: resourceType });
    } else {
      // Local path, e.g. /uploads/gallery/169...-abcd.jpg
      const relative = url.replace(/^\/uploads\//, '');
      const filePath = path.join(UPLOAD_ROOT, relative);
      if (!filePath.startsWith(UPLOAD_ROOT)) return; // guard against a malformed/traversal URL
      await fs.promises.unlink(filePath).catch((err) => {
        if (err.code !== 'ENOENT') throw err;
      });
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`deleteUploadedFile failed for ${url}:`, err.message);
  }
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

// Eric: "let the form be able to take large pictures and video instead of
// reducing the quality" — nothing in this app ever compressed or resized an
// upload (Cloudinary stores exactly what's sent unless a transformation is
// requested, and none is), so the only real ceiling was ever this number.
// 100MB matches Cloudinary's own free-plan video limit exactly, so a video
// never gets turned away by *this* app before it would've been accepted by
// Cloudinary anyway. Photos are comfortably covered too — even a high-res
// phone photo rarely exceeds 10-15MB. Override with MAX_UPLOAD_MB in .env
// if Eric's Cloudinary plan changes (see the size-limit note on
// uploadCourseImage below for the free plan's actual per-photo ceiling).
const maxBytes = (parseInt(process.env.MAX_UPLOAD_MB, 10) || 100) * 1024 * 1024;

const uploadImage = multer({
  storage: makeStorage('signatures'),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: fileFilter(ALLOWED_IMAGE),
});

// Gallery/shop products: 1-5 product photos ("images" field, see Eric: "Product
// post can have a video and five pictures") optionally paired with a product
// video ("video" field) — see gallery.routes.js, which wires this up with
// .fields([{ name: 'images', maxCount: 5 }, { name: 'video' }]).
const uploadGallery = multer({
  storage: makeStorage('gallery', (file) => (file.fieldname === 'video' ? 'video' : 'image')),
  limits: { fileSize: maxBytes },
  fileFilter: fileFilterByField({ images: ALLOWED_IMAGE, video: ALLOWED_VIDEO }),
});

// Homepage ad carousel slides — a separate content type from Gallery products
// (see models/CarouselPost.js). Each slide is one photo OR one video, never
// both, but both fields are wired up here so either can arrive; the
// controller enforces that at least one is present.
const uploadCarousel = multer({
  storage: makeStorage('carousel', (file) => (file.fieldname === 'video' ? 'video' : 'image')),
  limits: { fileSize: maxBytes },
  fileFilter: fileFilterByField({ image: ALLOWED_IMAGE, video: ALLOWED_VIDEO }),
});

const uploadCourseImage = multer({
  storage: makeStorage('courses'),
  // 10MB is Cloudinary's own free-plan per-image ceiling (verified against
  // Cloudinary's current pricing page) — raising this app's own limit any
  // higher wouldn't help, since Cloudinary would reject the file first.
  // Upgrading to Cloudinary's Plus plan raises that to 20MB (Advanced: 40MB)
  // if a course cover photo ever genuinely needs to be larger.
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: fileFilter(ALLOWED_IMAGE),
});

// Required passport-style photo a student attaches to their admission
// application — see application.routes.js (POST /api/applications), which
// enforces that it's present.
const uploadApplicationPhoto = multer({
  storage: makeStorage('applications'),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: fileFilter(ALLOWED_IMAGE),
});

module.exports = {
  uploadImage,
  uploadGallery,
  uploadCarousel,
  uploadCourseImage,
  uploadApplicationPhoto,
  UPLOAD_ROOT,
  fileUrl,
  deleteUploadedFile,
};
