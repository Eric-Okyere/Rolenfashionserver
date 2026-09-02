const express = require('express');
const { body } = require('express-validator');
const Newsletter = require('../models/Newsletter');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.post(
  '/',
  [body('email').isEmail().withMessage('Enter a valid email')],
  validate,
  async (req, res) => {
    try {
      await Newsletter.create({ email: req.body.email.toLowerCase() });
    } catch (err) {
      if (err.code !== 11000) throw err; // ignore duplicate subscribe attempts
    }
    res.status(201).json({ message: 'Subscribed! Thanks for joining our list.' });
  }
);

router.get('/', protect, authorize('admin', 'staff'), async (req, res) => {
  const subscribers = await Newsletter.find().sort({ createdAt: -1 });
  res.json({ subscribers });
});

module.exports = router;
