const crypto = require('crypto');
const Payment = require('../models/Payment');
const Application = require('../models/Application');
const Gallery = require('../models/Gallery');
const logActivity = require('../utils/activityLog');
const { notifyPaymentReceived } = require('../utils/whatsapp');
const { initializeTransaction, verifyTransaction, verifyWebhookSignature } = require('../utils/paystack');

function makeReference(type) {
  // Not a Paystack requirement to be unguessable, just unique — prefixed so
  // it's recognizable as ours in the Paystack dashboard alongside other
  // integrations that might share the same account later.
  return `rolen_${type}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

function callbackUrl() {
  // Where Paystack sends the browser back to after checkout. Configurable
  // separately from CLIENT_URL in case the deployed frontend URL ever
  // differs from where payments should land, but defaults to the obvious
  // place so nothing extra needs setting for the common case.
  const base = process.env.PAYSTACK_CALLBACK_URL || `${process.env.CLIENT_URL || 'http://localhost:3000'}/payment/callback`;
  return base;
}

// POST /api/payments/initialize (public) — starts a Paystack Mobile Money/
// card checkout for either an admission-fee deposit or a shop order, and
// returns the URL to send the browser to.
async function initializePayment(req, res, next) {
  try {
    const { type, email, name, phone, applicationId, galleryItemId } = req.body;
    if (!['admission_fee', 'shop_order'].includes(type)) {
      return res.status(400).json({ message: 'Invalid payment type.' });
    }
    if (!email) return res.status(400).json({ message: 'An email address is required to pay online.' });

    let amount; // GHS
    let application = null;
    let galleryItem = null;

    if (type === 'admission_fee') {
      application = await Application.findById(applicationId).populate('course', 'title fee depositAmount');
      if (!application) return res.status(404).json({ message: 'Application not found.' });
      if (application.status !== 'admitted') {
        return res.status(400).json({ message: 'The fee deposit can only be paid online once your application has been admitted.' });
      }
      if (application.feePaymentStatus === 'paid') {
        return res.status(400).json({ message: 'The deposit for this application has already been paid.' });
      }
      amount = application.course?.depositAmount || application.course?.fee;
      if (!amount) {
        return res.status(400).json({ message: 'No fee amount is set for this course yet. Please contact the school to arrange payment.' });
      }
    } else {
      galleryItem = await Gallery.findById(galleryItemId);
      if (!galleryItem) return res.status(404).json({ message: 'Product not found.' });
      amount = galleryItem.price;
      if (!amount) {
        return res.status(400).json({ message: 'This product does not have a price set yet. Please order via WhatsApp instead.' });
      }
    }

    const reference = makeReference(type);

    const payment = await Payment.create({
      type,
      reference,
      amount,
      email,
      name,
      phone,
      application: application?._id,
      galleryItem: galleryItem?._id,
      status: 'pending',
    });

    const paystackData = await initializeTransaction({
      email,
      amountGHS: amount,
      reference,
      callbackUrl: callbackUrl(),
      channels: ['mobile_money', 'card'],
      metadata: {
        paymentId: String(payment._id),
        type,
        applicationId: application ? String(application._id) : undefined,
        galleryItemId: galleryItem ? String(galleryItem._id) : undefined,
      },
    });

    res.status(201).json({
      authorizationUrl: paystackData.authorization_url,
      reference: paystackData.reference,
    });
  } catch (err) {
    next(err);
  }
}

// Shared finalization step: takes a Paystack transaction's real, verified
// data (from either the client-facing verify call right after checkout, or
// the server-to-server webhook — whichever arrives first) and applies it to
// our own Payment record plus, on success, the linked Application/Gallery
// item. Idempotent — safe to call twice for the same reference, since both
// paths above can legitimately fire for the same payment.
async function finalizePayment(reference, txData) {
  const payment = await Payment.findOne({ reference });
  if (!payment) return null;
  if (payment.status === 'success') return payment; // already finalized, nothing to do

  const isSuccess = txData.status === 'success';
  payment.status = isSuccess ? 'success' : txData.status === 'abandoned' ? 'abandoned' : 'failed';
  payment.gatewayResponse = txData.gateway_response;
  if (txData.paid_at) payment.paidAt = new Date(txData.paid_at);
  await payment.save();

  if (!isSuccess) return payment;

  if (payment.type === 'admission_fee' && payment.application) {
    const application = await Application.findById(payment.application);
    if (application && application.feePaymentStatus !== 'paid') {
      application.feePaymentStatus = 'paid';
      application.feeAmountPaid = (application.feeAmountPaid || 0) + payment.amount;
      application.feePaymentReference = payment.reference;
      await application.save();
      await logActivity({
        type: 'payment.admission_fee_paid',
        summary: `${application.firstName} ${application.lastName} paid the GH¢ ${payment.amount.toLocaleString()} deposit via MoMo (${payment.reference})`,
        meta: { applicationId: application._id, paymentId: payment._id },
      });
      notifyPaymentReceived({
        label: `${application.firstName} ${application.lastName}'s fee deposit`,
        amount: payment.amount,
        reference: payment.reference,
      });
    }
  } else if (payment.type === 'shop_order' && payment.galleryItem) {
    const item = await Gallery.findById(payment.galleryItem);
    await logActivity({
      type: 'payment.shop_order_paid',
      summary: `${payment.name || payment.email} paid GH¢ ${payment.amount.toLocaleString()} for ${item?.title || 'a product'} via MoMo (${payment.reference})`,
      meta: { galleryItemId: payment.galleryItem, paymentId: payment._id },
    });
    notifyPaymentReceived({
      label: `Order paid: ${item?.title || 'a product'}`,
      amount: payment.amount,
      reference: payment.reference,
    });
  }

  return payment;
}

// GET /api/payments/verify/:reference (public) — called by the client right
// after Paystack redirects the browser back, so the payer sees an immediate
// pass/fail result rather than waiting on the webhook.
async function verifyPayment(req, res, next) {
  try {
    const { reference } = req.params;
    const txData = await verifyTransaction(reference);
    const payment = await finalizePayment(reference, txData);
    if (!payment) return res.status(404).json({ message: 'Payment record not found.' });
    res.json({
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      reference: payment.reference,
      type: payment.type,
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/payments/webhook (public — called by Paystack's own servers, not
// a browser). This is the reliable source of truth: it still fires even if
// the payer closes the tab before Paystack redirects them back, unlike
// verifyPayment above. Must respond quickly (Paystack retries otherwise), so
// the response is sent before doing the actual database work.
async function paystackWebhook(req, res) {
  const signature = req.headers['x-paystack-signature'];
  const rawBody = req.rawBody;
  if (!verifyWebhookSignature(rawBody, signature)) {
    console.error('Paystack webhook: invalid or missing signature — ignoring request.');
    return res.status(401).end();
  }

  res.status(200).end(); // acknowledge immediately, process below

  const event = req.body;
  if (event?.event === 'charge.success' && event.data?.reference) {
    try {
      await finalizePayment(event.data.reference, event.data);
    } catch (err) {
      console.error('Failed to finalize payment from Paystack webhook:', err.message);
    }
  }
}

// GET /api/payments (admin) — a simple ledger so Eric can see who's paid
// without checking the Paystack dashboard separately.
async function listPayments(req, res, next) {
  try {
    const filter = {};
    if (req.query.type) filter.type = req.query.type;
    if (req.query.status) filter.status = req.query.status;
    const payments = await Payment.find(filter)
      .populate('application', 'applicationNumber firstName lastName')
      .populate('galleryItem', 'title')
      .sort({ createdAt: -1 })
      .limit(300);
    res.json({ payments });
  } catch (err) {
    next(err);
  }
}

module.exports = { initializePayment, verifyPayment, paystackWebhook, listPayments };
