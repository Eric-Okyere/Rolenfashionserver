const express = require('express');
const ctrl = require('../controllers/testimonialController');
const { protect, authorize } = require('../middleware/auth');
const { optionalAuth } = require('../middleware/optionalAuth');

const router = express.Router();

router.get('/', optionalAuth, ctrl.listTestimonials);
router.post('/', protect, authorize('admin', 'staff'), ctrl.createTestimonial);
router.put('/:id', protect, authorize('admin', 'staff'), ctrl.updateTestimonial);
router.delete('/:id', protect, authorize('admin'), ctrl.deleteTestimonial);

module.exports = router;
