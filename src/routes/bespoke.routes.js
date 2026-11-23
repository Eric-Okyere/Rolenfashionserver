const express = require('express');
const { body } = require('express-validator');
const ctrl = require('../controllers/bespokeController');
const { OUTFIT_TYPES } = require('../models/BespokeRequest');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { contactLimiter } = require('../middleware/rateLimiters');
const { uploadBespokePhotos } = require('../middleware/upload');

const router = express.Router();

router.post(
  '/',
  contactLimiter,
  uploadBespokePhotos.array('photos', 4),
  [
    body('outfitType').isIn(OUTFIT_TYPES).withMessage('Choose the type of outfit you want.'),
    body('name').trim().notEmpty().withMessage('Your name is required.'),
    body('phone').trim().notEmpty().withMessage('A phone / WhatsApp number is required.'),
    body('email').optional({ checkFalsy: true }).isEmail().withMessage('Enter a valid email.'),
    body('eventDate').optional({ checkFalsy: true }).isISO8601().withMessage('Enter a valid date.'),
  ],
  validate,
  ctrl.createRequest
);

router.get('/', protect, authorize('admin', 'staff'), ctrl.listRequests);
router.patch('/:id/status', protect, authorize('admin', 'staff'), ctrl.updateStatus);
router.delete('/:id', protect, authorize('admin'), ctrl.deleteRequest);

module.exports = router;
