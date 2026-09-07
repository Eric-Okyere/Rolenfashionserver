const express = require('express');
const ctrl = require('../controllers/paymentController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Public — a student or shopper's own browser calls this to start a checkout.
router.post('/initialize', ctrl.initializePayment);
// Public — called by the client right after Paystack redirects back.
router.get('/verify/:reference', ctrl.verifyPayment);
// Public (from Paystack's servers, not a browser) — authenticity is checked
// via the x-paystack-signature header inside the controller, not auth middleware.
router.post('/webhook', ctrl.paystackWebhook);
// Admin — a simple payments ledger.
router.get('/', protect, authorize('admin', 'staff'), ctrl.listPayments);

module.exports = router;
