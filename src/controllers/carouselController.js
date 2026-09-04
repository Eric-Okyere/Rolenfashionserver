const CarouselPost = require('../models/CarouselPost');
const logActivity = require('../utils/activityLog');
const { fileUrl } = require('../middleware/upload');

// GET /api/carousel (public — active only unless admin ?all=1)
async function listCarouselPosts(req, res) {
  const showAll = req.query.all === '1' && req.user;
  const filter = showAll ? {} : { isActive: true };
  const posts = await CarouselPost.find(filter).sort({ order: 1, createdAt: -1 });
  res.json({ posts });
}

// POST /api/carousel (admin) — after upload middleware sets req.files.image / req.files.video.
// A slide is one photo OR one video, never both required — mirrors how a
// carousel post is meant to be a single big ad, not a product with multiple
// media types.
async function createCarouselPost(req, res) {
  const imageFile = req.files?.image?.[0];
  const videoFile = req.files?.video?.[0];
  if (!imageFile && !videoFile) {
    return res.status(400).json({ message: 'Add a photo or a video for this slide.' });
  }

  const post = await CarouselPost.create({
    title: req.body.title,
    caption: req.body.caption,
    linkCategory: req.body.linkCategory || undefined,
    ctaLabel: req.body.ctaLabel || undefined,
    order: req.body.order || 0,
    isActive: req.body.isActive !== 'false',
    imageUrl: imageFile ? fileUrl(imageFile, 'carousel') : undefined,
    videoUrl: videoFile ? fileUrl(videoFile, 'carousel') : undefined,
    uploadedBy: req.user._id,
  });
  await logActivity({
    type: 'carousel.created',
    summary: `${req.user.name} added a new ad carousel slide${post.title ? `: ${post.title}` : ''}`,
    meta: { postId: post._id },
    actor: req.user,
  });
  res.status(201).json({ post });
}

// PUT /api/carousel/:id (admin)
async function updateCarouselPost(req, res) {
  const post = await CarouselPost.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!post) return res.status(404).json({ message: 'Slide not found.' });
  await logActivity({
    type: 'carousel.updated',
    summary: `${req.user.name} updated an ad carousel slide`,
    meta: { postId: post._id },
    actor: req.user,
  });
  res.json({ post });
}

// DELETE /api/carousel/:id (admin)
async function deleteCarouselPost(req, res) {
  const post = await CarouselPost.findByIdAndDelete(req.params.id);
  if (!post) return res.status(404).json({ message: 'Slide not found.' });
  await logActivity({
    type: 'carousel.deleted',
    summary: `${req.user.name} deleted an ad carousel slide`,
    actor: req.user,
  });
  res.json({ message: 'Deleted.' });
}

module.exports = { listCarouselPosts, createCarouselPost, updateCarouselPost, deleteCarouselPost };
