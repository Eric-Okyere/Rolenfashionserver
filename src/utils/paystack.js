// Thin wrapper around Paystack's REST API — no SDK dependency needed, same
// "plain fetch" style already used for the WhatsApp Cloud API (see
// utils/whatsapp.js). Paystack is the payment aggregator standing between
// this site and a student/shopper's actual Mobile Money wallet: it's the
// only way to genuinely debit a MoMo account from a website (a custom form
// asking for a MoMo PIN would be both insecure and against every MoMo
// network's terms) — the phone-number entry and PIN approval both happen on
// Paystack's own secure checkout page, never on this site. See the README's
// "Mobile Money payments (Paystack)" section for the one-time account setup
// Eric needs to do himself (this project only ever holds the API key he
// generates there).
const crypto = require('crypto');

const PAYSTACK_BASE = 'https://api.paystack.co';

function requireSecretKey() {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    const err = new Error('Online Mobile Money payments are not set up yet. Please contact the school to arrange payment.');
    err.statusCode = 503;
    throw err;
  }
  return secret;
}

// Starts a transaction and returns Paystack's { authorization_url,
// access_code, reference } — the browser is sent to authorization_url to
// complete payment (Paystack's own hosted checkout, which offers Mobile
// Money as a channel for GHS transactions).
async function initializeTransaction({ email, amountGHS, reference, callbackUrl, channels, metadata }) {
  const secret = requireSecretKey();
  const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      amount: Math.round(Number(amountGHS) * 100), // GHS -> pesewas (Paystack's subunit)
      currency: 'GHS',
      reference,
      callback_url: callbackUrl,
      channels: channels || ['mobile_money', 'card'],
      metadata,
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.status) {
    const err = new Error(data?.message || 'Could not start the payment. Please try again.');
    err.statusCode = 502;
    throw err;
  }
  return data.data; // { authorization_url, access_code, reference }
}

// Looks up a transaction's real, current status directly from Paystack —
// never trust a client-supplied "it worked" without this, since that's
// exactly what would let someone fake a payment.
async function verifyTransaction(reference) {
  const secret = requireSecretKey();
  const res = await fetch(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.status) {
    const err = new Error(data?.message || 'Could not verify this payment.');
    err.statusCode = 502;
    throw err;
  }
  return data.data; // { status, amount, currency, reference, paid_at, gateway_response, customer }
}

// Paystack signs every webhook call with an HMAC-SHA512 of the exact raw
// request body, using the secret key — this is what proves a webhook call
// genuinely came from Paystack and wasn't forged by hitting the URL
// directly. `rawBody` must be the literal bytes Paystack sent (see app.js's
// express.json({ verify }) hook), not a re-serialized copy of req.body,
// since re-serializing can reorder keys/whitespace and produce a different
// hash even for identical data.
function verifyWebhookSignature(rawBody, signatureHeader) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret || !signatureHeader || !rawBody) return false;
  const hash = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
  // timingSafeEqual needs equal-length buffers, and a wrong-length signature
  // is already invalid, so length-check first rather than letting it throw.
  const a = Buffer.from(hash, 'utf8');
  const b = Buffer.from(String(signatureHeader), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { initializeTransaction, verifyTransaction, verifyWebhookSignature };
