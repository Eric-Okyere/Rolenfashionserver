const express = require('express');
const { body } = require('express-validator');
const Newsletter = require('../models/Newsletter');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');
const logActivity = require('../utils/activityLog');
const { notifyNewNewsletterSignup } = require('../utils/whatsapp');

const router = express.Router();

router.post(
  '/',
  [body('email').isEmail().withMessage('Enter a valid email')],
  validate,
  async (req, res) => {
    const email = req.body.email.toLowerCase();
    try {
      await Newsletter.create({ email });
      await logActivity({ type: 'newsletter.subscribed', summary: `New newsletter subscriber: ${email}` });
      // Fire-and-forget (not awaited) so a slow or unconfigured WhatsApp API
      // never delays the visitor's response — see utils/whatsapp.js.
      notifyNewNewsletterSignup({ email });
    } catch (err) {
      if (err.code !== 11000) throw err; // ignore duplicate subscribe attempts (not logged/notified — nothing new happened)
    }
    res.status(201).json({ message: 'Subscribed! Thanks for joining our list.' });
  }
);

router.get('/', protect, authorize('admin', 'staff'), async (req, res) => {
  const subscribers = await Newsletter.find().sort({ createdAt: -1 });
  res.json({ subscribers });
});

module.exports = router;
