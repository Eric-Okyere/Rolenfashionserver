const express = require('express');
const { body } = require('express-validator');
const ctrl = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

router.get('/', protect, authorize('admin'), ctrl.listUsers);
router.post(
  '/',
  protect,
  authorize('admin'),
  [
    body('name').trim().notEmpty(),
    body('email').isEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
  validate,
  ctrl.createUser
);
router.patch('/:id', protect, authorize('admin'), ctrl.updateUser);

module.exports = router;
