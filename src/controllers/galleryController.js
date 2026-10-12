const Gallery = require('../models/Gallery');
const logActivity = require('../utils/activityLog');
const { notifyOrderInterest } = require('../utils/whatsapp');
const { fileUrl, deleteUploadedFile } = require('../middleware/upload');

// GET /api/gallery (public — published only unless admin ?all=1)
async function listGallery(req, res) {
  const showAll = req.query.all === '1' && req.user;
  const filter = showAll ? {} : { isPublished: true };
  // "With video" filter: every product has a photo, so the useful distinction
  // for shoppers is whether a product also has a video attached.
  if (req.query.video === '1') filter.videoUrl = { $exists: true, $nin: [null, ''] };
  if (req.query.category) filter.category = req.query.category;
  const items = await Gallery.find(filter).sort({ isFeatured: -1, createdAt: -1 });
  res.json({ items });
}

// POST /api/gallery (admin) — after upload middleware sets req.files.images (1-5) / req.files.video
async function createGalleryItem(req, res) {
  const imageFiles = req.files?.images || [];
  const videoFile = req.files?.video?.[0];
  if (!imageFiles.length) return res.status(400).json({ message: 'At least one product photo is required.' });
  if (imageFiles.length > 5) return res.status(400).json({ message: 'A product can have at most 5 photos.' });

  const imageUrls = imageFiles.map((f) => fileUrl(f, 'gallery'));

  const item = await Gallery.create({
    title: req.body.title || imageFiles[0].originalname,
    description: req.body.description,
    category: req.body.category,
    price: req.body.price || undefined,
    isFeatured: req.body.isFeatured === 'true',
    imageUrl: imageUrls[0],
    imageUrls,
    videoUrl: videoFile ? fileUrl(videoFile, 'gallery') : undefined,
    uploadedBy: req.user._id,
  });
  await logActivity({
    type: 'gallery.created',
    summary: `${req.user.name} posted a new product: ${item.title}`,
    meta: { itemId: item._id },
    actor: req.user,
  });
  res.status(201).json({ item });
}

// PUT /api/gallery/:id (admin) — partial update to any of title/
// description/category/price/isFeatured/isPublished, and (new) optionally
// replacing the photos and/or video in the same request, multipart, same
// field names as POST (`images`, `video`). Eric: "Let a product be edited
// in the gallery and shop page" — the route already accepted field
// changes (used by the Publish/Unpublish toggle), this adds the actual
// edit form plus photo/video replacement.
async function updateGalleryItem(req, res) {
  const item = await Gallery.findById(req.params.id);
  if (!item) return res.status(404).json({ message: 'Item not found.' });

  // Whitelisted, explicitly-typed fields only — req.body may come from
  // either a JSON request (the Publish/Unpublish toggle, correctly typed
  // already) or multipart form fields (the edit form, everything a string),
  // so booleans/empty-price are normalized the same way createGalleryItem
  // already does.
  for (const key of ['title', 'description', 'category']) {
    if (req.body[key] !== undefined) item[key] = req.body[key];
  }
  if (req.body.price !== undefined) {
    item.price = req.body.price === '' ? undefined : req.body.price;
  }
  for (const key of ['isFeatured', 'isPublished']) {
    if (req.body[key] !== undefined) item[key] = req.body[key] === true || req.body[key] === 'true';
  }

  const newImageFiles = req.files?.images || [];
  const newVideoFile = req.files?.video?.[0];
  if (newImageFiles.length > 5) {
    return res.status(400).json({ message: 'A product can have at most 5 photos.' });
  }
  const oldImageUrls = item.imageUrls || [];
  const oldVideoUrl = item.videoUrl;
  if (newImageFiles.length) {
    const imageUrls = newImageFiles.map((f) => fileUrl(f, 'gallery'));
    item.imageUrl = imageUrls[0];
    item.imageUrls = imageUrls;
  }
  if (newVideoFile) {
    item.videoUrl = fileUrl(newVideoFile, 'gallery');
  }

  // .save() already runs schema validators by default — no runValidators option needed here (that's a findByIdAndUpdate-style option, not a .save() one).
  await item.save();

  // Old media is replaced wholesale (not merged), matching how the Post
  // form itself works (choose 1-5 photos as one set) — cleaned up from
  // Cloudinary after the DB write succeeds, same best-effort, never-blocks
  // pattern as deleteGalleryItem.
  if (newImageFiles.length) {
    Promise.all(oldImageUrls.filter(Boolean).map(deleteUploadedFile)).catch(() => {});
  }
  if (newVideoFile && oldVideoUrl) {
    deleteUploadedFile(oldVideoUrl).catch(() => {});
  }

  await logActivity({
    type: 'gallery.updated',
    summary: `${req.user.name} updated product: ${item.title}`,
    meta: { itemId: item._id },
    actor: req.user,
  });
  res.json({ item });
}

// DELETE /api/gallery/:id (admin)
async function deleteGalleryItem(req, res) {
  const item = await Gallery.findByIdAndDelete(req.params.id);
  if (!item) return res.status(404).json({ message: 'Item not found.' });
  // Eric: "If a product is delete, delete the picture or the video also from
  // cloudinary" — otherwise every deleted product left its photos/video
  // behind forever. Runs after the response-critical delete so a storage
  // hiccup here (already best-effort/non-throwing inside the helper) can
  // never block or fail the admin's delete action.
  await Promise.all([...(item.imageUrls || []), item.videoUrl].filter(Boolean).map(deleteUploadedFile));
  await logActivity({
    type: 'gallery.deleted',
    summary: `${req.user.name} deleted product: ${item.title}`,
    actor: req.user,
  });
  res.json({ message: 'Deleted.' });
}

// POST /api/gallery/:id/order-click (public) — fired the moment a shopper
// taps "Order via WhatsApp" on a product (see GalleryItem.js), at the same
// time that tap opens the shopper's own WhatsApp chat to the school. Eric:
// "If a customer wants to buy a product, let admin receives whatsapp
// notifications" — the chat itself already reaches the school's WhatsApp
// number directly (Settings.whatsapp), but this is what lets Eric also get
// a WhatsApp *alert* about it (via Meta's Cloud API) without having to
// watch that chat, same as the other activity notifications below. Never
// blocks or fails the shopper's flow either way — it fires right alongside
// the wa.me link opening, not before it.
async function recordOrderClick(req, res) {
  const item = await Gallery.findById(req.params.id);
  if (!item) return res.status(404).json({ message: 'Item not found.' });

  await logActivity({
    type: 'gallery.order_clicked',
    summary: `Order interest: ${item.title}`,
    meta: { itemId: item._id },
  });

  // Fire-and-forget (not awaited) so a slow or unconfigured WhatsApp API
  // never delays this — see utils/whatsapp.js.
  notifyOrderInterest({ productTitle: item.title });

  res.status(204).end();
}

module.exports = { listGallery, createGalleryItem, updateGalleryItem, deleteGalleryItem, recordOrderClick };
