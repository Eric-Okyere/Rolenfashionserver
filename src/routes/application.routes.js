const express = require('express');
const { body } = require('express-validator');
const ctrl = require('../controllers/applicationController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { applicationLimiter } = require('../middleware/rateLimiters');
const { uploadApplicationPhoto } = require('../middleware/upload');

const router = express.Router();

const applicationValidation = [
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('email').isEmail().withMessage('Enter a valid email'),
  body('phone').trim().notEmpty().withMessage('Phone number is required'),
  body('dateOfBirth').isISO8601().withMessage('Enter a valid date of birth'),
  body('address').trim().notEmpty().withMessage('Address is required'),
  body('course').isMongoId().withMessage('Select a valid course'),
];

// Public — the form is submitted as multipart/form-data so an optional
// "photo" file can ride along with the text fields; uploadApplicationPhoto
// parses that into req.body (text fields) / req.file (the photo, if any)
// before the validators below run.
router.post(
  '/',
  applicationLimiter,
  uploadApplicationPhoto.single('photo'),
  applicationValidation,
  validate,
  ctrl.submitApplication
);
router.get('/track/:applicationNumber', ctrl.trackApplication);
router.get('/track/:applicationNumber/letter', ctrl.downloadLetter);

// Admin
router.get('/', protect, authorize('admin', 'staff'), ctrl.listApplications);
router.get('/stats/summary', protect, authorize('admin', 'staff'), ctrl.stats);
router.get('/:id', protect, authorize('admin', 'staff'), ctrl.getApplication);
router.patch(
  '/:id/status',
  protect,
  authorize('admin', 'staff'),
  [body('status').isIn(['pending', 'under_review', 'admitted', 'rejected', 'waitlisted'])],
  validate,
  ctrl.updateStatus
);

module.exports = router;
