const express = require('express');
const { body } = require('express-validator');
const { login, logout, me, changePassword } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

router.post(
  '/login',
  authLimiter,
  [body('email').isEmail().withMessage('Enter a valid email'), body('password').notEmpty().withMessage('Password is required')],
  validate,
  login
);
router.post('/logout', logout);
router.get('/me', protect, me);
router.patch(
  '/password',
  protect,
  [body('currentPassword').notEmpty(), body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters')],
  validate,
  changePassword
);

module.exports = router;
