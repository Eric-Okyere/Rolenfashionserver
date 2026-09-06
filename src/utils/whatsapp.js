// Sends WhatsApp notifications via Meta's WhatsApp Cloud API for the site
// activity Eric wants to know about without checking Admin every day: a new
// admission application, a new contact-form message, a new newsletter
// signup, and a shopper tapping "Order via WhatsApp" on a product.
// Deliberately never throws — a WhatsApp hiccup (missing config, Meta API
// error, network blip) should never break the real request that triggered
// it, same philosophy as utils/activityLog.js. If the required env vars
// aren't set, this silently does nothing, so the site works fine before the
// Meta WhatsApp Cloud API is configured — see the README's "WhatsApp
// notifications" section for setup steps.
//
// Meta requires business-initiated messages (i.e. not a reply within an
// open customer conversation) to use a pre-approved message "template" —
// you can't send arbitrary free text here. One deliberately generic
// template ({{1}} = what happened, {{2}} = the detail, {{3}} = a reference/
// next step) covers every event type below, so only ONE template ever needs
// creating and approving in Meta Business Manager, no matter how many kinds
// of alerts get added later — see README for the exact suggested wording.

const GRAPH_API_VERSION = 'v21.0';

async function sendWhatsAppTemplate(templateParams) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME;
  const languageCode = process.env.WHATSAPP_TEMPLATE_LANG || 'en_US';
  const recipients = (process.env.WHATSAPP_TO || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (!token || !phoneNumberId || !templateName || recipients.length === 0) {
    // Not configured yet — quietly skip rather than erroring.
    return;
  }

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;

  await Promise.all(
    recipients.map(async (to) => {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to,
            type: 'template',
            template: {
              name: templateName,
              language: { code: languageCode },
              components: [
                {
                  type: 'body',
                  parameters: templateParams.map((text) => ({ type: 'text', text: String(text) })),
                },
              ],
            },
          }),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          console.error(`WhatsApp notification failed (${res.status}) for ${to}:`, body);
        }
      } catch (err) {
        console.error(`WhatsApp notification failed for ${to}:`, err.message);
      }
    })
  );
}

// Notifies about a newly submitted admission application.
async function notifyNewApplication({ applicantName, courseTitle, applicationNumber }) {
  await sendWhatsAppTemplate([
    'New admission application',
    `${applicantName} applied for ${courseTitle || 'a course'}`,
    `App #${applicationNumber}`,
  ]);
}

// Notifies about a newly submitted contact-form message.
async function notifyNewMessage({ name, subject }) {
  await sendWhatsAppTemplate([
    'New contact message',
    subject ? `${name}: ${subject}` : `${name} sent a message`,
    'Check Admin → Messages',
  ]);
}

// Notifies about a newly submitted newsletter signup.
async function notifyNewNewsletterSignup({ email }) {
  await sendWhatsAppTemplate([
    'New newsletter signup',
    email,
    'Check Admin → Newsletter',
  ]);
}

// Notifies that a shopper tapped "Order via WhatsApp" on a product — sent in
// parallel with that same tap opening the shopper's own WhatsApp chat to the
// school, so Eric hears about the order interest even if he doesn't see the
// incoming chat right away.
async function notifyOrderInterest({ productTitle }) {
  await sendWhatsAppTemplate([
    'Product order interest',
    productTitle,
    'Customer is messaging you on WhatsApp now',
  ]);
}

module.exports = {
  notifyNewApplication,
  notifyNewMessage,
  notifyNewNewsletterSignup,
  notifyOrderInterest,
};
