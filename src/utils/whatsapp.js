// Sends a WhatsApp notification via Meta's WhatsApp Cloud API for select
// high-value events (currently: a new admission application). Deliberately
// never throws — a WhatsApp hiccup (missing config, Meta API error, network
// blip) should never break the real request that triggered it, same
// philosophy as utils/activityLog.js. If the required env vars aren't set,
// this silently does nothing, so the site works fine before Eric finishes
// setting up WhatsApp — see the README's "WhatsApp notifications" section
// for the Meta Business Manager setup steps.
//
// Meta requires business-initiated messages (i.e. not a reply within an
// open customer conversation) to use a pre-approved message "template" —
// you can't send arbitrary free text here. Create a template in Meta
// Business Manager first (see README), then set WHATSAPP_TEMPLATE_NAME to
// its exact name.

const GRAPH_API_VERSION = 'v21.0';

async function sendWhatsAppTemplate({ templateParams }) {
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
                  parameters: templateParams.map((text) => ({ type: 'text', text })),
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

// Notifies about a newly submitted admission application. `templateParams`
// must match the {{1}}, {{2}}, {{3}}... placeholders of the approved
// template body in order — see README for the suggested template text.
async function notifyNewApplication({ applicantName, courseTitle, applicationNumber }) {
  await sendWhatsAppTemplate({
    templateParams: [applicantName, courseTitle || 'a course', applicationNumber],
  });
}

module.exports = { notifyNewApplication };
