const express = require('express');
const ctrl = require('../controllers/carouselController');
const { protect, authorize } = require('../middleware/auth');
const { optionalAuth } = require('../middleware/optionalAuth');
const { uploadCarousel } = require('../middleware/upload');

const router = express.Router();

router.get('/', optionalAuth, ctrl.listCarouselPosts);
router.post(
  '/',
  protect,
  authorize('admin', 'staff'),
  uploadCarousel.fields([
    { name: 'image', maxCount: 1 },
    { name: 'video', maxCount: 1 },
  ]),
  ctrl.createCarouselPost
);
router.put('/:id', protect, authorize('admin', 'staff'), ctrl.updateCarouselPost);
router.delete('/:id', protect, authorize('admin'), ctrl.deleteCarouselPost);

module.exports = router;
