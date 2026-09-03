const Gallery = require('../models/Gallery');
const logActivity = require('../utils/activityLog');
const { fileUrl } = require('../middleware/upload');

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

// POST /api/gallery (admin) — after upload middleware sets req.files.image / req.files.video
async function createGalleryItem(req, res) {
  const imageFile = req.files?.image?.[0];
  const videoFile = req.files?.video?.[0];
  if (!imageFile) return res.status(400).json({ message: 'A product photo is required.' });

  const item = await Gallery.create({
    title: req.body.title || imageFile.originalname,
    description: req.body.description,
    category: req.body.category,
    price: req.body.price || undefined,
    isFeatured: req.body.isFeatured === 'true',
    imageUrl: fileUrl(imageFile, 'gallery'),
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

// PUT /api/gallery/:id (admin)
async function updateGalleryItem(req, res) {
  const item = await Gallery.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!item) return res.status(404).json({ message: 'Item not found.' });
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
  await logActivity({
    type: 'gallery.deleted',
    summary: `${req.user.name} deleted product: ${item.title}`,
    actor: req.user,
  });
  res.json({ message: 'Deleted.' });
}

module.exports = { listGallery, createGalleryItem, updateGalleryItem, deleteGalleryItem };
