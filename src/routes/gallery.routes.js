const express = require('express');
const ctrl = require('../controllers/galleryController');
const { protect, authorize } = require('../middleware/auth');
const { optionalAuth } = require('../middleware/optionalAuth');
const { uploadGallery } = require('../middleware/upload');

const router = express.Router();

router.get('/', optionalAuth, ctrl.listGallery);
// Public — no auth. Fired by a shopper's own browser the instant they tap
// "Order via WhatsApp" (see GalleryItem.js / controller comment above).
router.post('/:id/order-click', ctrl.recordOrderClick);
router.post(
  '/',
  protect,
  authorize('admin', 'staff'),
  uploadGallery.fields([
    { name: 'images', maxCount: 5 },
    { name: 'video', maxCount: 1 },
  ]),
  ctrl.createGalleryItem
);
router.put('/:id', protect, authorize('admin', 'staff'), ctrl.updateGalleryItem);
router.delete('/:id', protect, authorize('admin'), ctrl.deleteGalleryItem);

module.exports = router;
