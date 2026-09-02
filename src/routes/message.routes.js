const express = require('express');
const { body } = require('express-validator');
const ctrl = require('../controllers/messageController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { contactLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

router.post(
  '/',
  contactLimiter,
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Enter a valid email'),
    body('message').trim().notEmpty().withMessage('Message is required'),
  ],
  validate,
  ctrl.createMessage
);

router.get('/', protect, authorize('admin', 'staff'), ctrl.listMessages);
router.patch('/:id/read', protect, authorize('admin', 'staff'), ctrl.markRead);
router.delete('/:id', protect, authorize('admin'), ctrl.deleteMessage);

module.exports = router;
