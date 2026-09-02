const express = require('express');
const { body } = require('express-validator');
const ctrl = require('../controllers/courseController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { uploadCourseImage } = require('../middleware/upload');

const router = express.Router();

// Optional auth: attach req.user if a valid cookie is present, but don't require it
const { optionalAuth } = require('../middleware/optionalAuth');

router.get('/', optionalAuth, ctrl.listCourses);
router.get('/:slug', optionalAuth, ctrl.getCourse);

const courseValidation = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('summary').trim().notEmpty().withMessage('Summary is required'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('duration').trim().notEmpty().withMessage('Duration is required'),
  body('fee').optional({ checkFalsy: true }).isNumeric().withMessage('Fee must be a number'),
];

router.post('/', protect, authorize('admin', 'staff'), courseValidation, validate, ctrl.createCourse);
router.put('/:id', protect, authorize('admin', 'staff'), ctrl.updateCourse);
router.delete('/:id', protect, authorize('admin'), ctrl.deleteCourse);
router.post('/:id/image', protect, authorize('admin', 'staff'), uploadCourseImage.single('image'), ctrl.setCourseImage);

module.exports = router;
