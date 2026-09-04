// Turns whatever an admin pastes into the "Google Maps Embed URL" Settings
// field into something that will actually render inside the Contact page's
// <iframe>. Eric's actual attempt ("fix the map link so it works") was a
// share link copied straight from the Google Maps app —
// https://maps.app.goo.gl/xxxxxxx — which looks like a normal link but
// Google's regular maps.google.com pages (and the short link that redirects
// to one) refuse to be framed (X-Frame-Options), so dropping it straight
// into an <iframe src> just shows a blank/broken box. The only URL shape
// Google actually allows in an iframe without an API key is the
// `output=embed` form, e.g. https://www.google.com/maps?q=<place>&output=embed
// — this file converts a pasted share link, a full (non-embed) Maps URL, or
// even a plain typed address into that form automatically, so admins never
// need to know the difference.
const http = require('http');
const https = require('https');
const { URL } = require('url');

// Google's own short-link domains for shared map pins.
const SHORT_LINK_HOSTS = new Set(['maps.app.goo.gl', 'goo.gl']);

function isEmbeddableUrl(value) {
  return /\/maps\/embed(\?|$)/.test(value) || /[?&]output=embed(&|$)/.test(value);
}

// A real desktop Chrome UA string. Google's short-link redirector
// (maps.app.goo.gl links are Firebase Dynamic Links under the hood) can
// serve a different response to an unrecognized/bot-looking User-Agent —
// sometimes an HTML "interstitial" page with a JS/meta-refresh redirect
// instead of a clean HTTP 3xx — so presenting as an ordinary browser gets
// the plain-redirect behavior far more reliably.
const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Pulls a redirect target out of an HTML body when there was no Location
// header to follow — covers the interstitial-page case mentioned above:
// <meta http-equiv="refresh" content="0;url=https://...">, or a bare
// canonical/og:url link to the real maps.google.com page.
function findUrlInHtml(html) {
  const metaRefresh = html.match(/<meta[^>]+http-equiv=["']?refresh["']?[^>]+content=["'][^;]*;\s*url=([^"'>]+)["']/i);
  if (metaRefresh) return metaRefresh[1];
  const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
  if (canonical) return canonical[1];
  const ogUrl = html.match(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i);
  if (ogUrl) return ogUrl[1];
  return null;
}

// Follows HTTP redirects manually (rather than relying on a library) so we
// only ever need the *final URL* a short link resolves to — the coordinates
// or place name we need are encoded in that URL itself. Falls back to
// scanning the response body for a redirect (see findUrlInHtml) when a hop
// doesn't send a clean Location header, which Google's short-link service
// sometimes does instead of a plain HTTP redirect.
function resolveFinalUrl(startUrl, maxRedirects = 8) {
  return new Promise((resolve, reject) => {
    const attempt = (currentUrl, redirectsLeft) => {
      let parsed;
      try {
        parsed = new URL(currentUrl);
      } catch (err) {
        return reject(err);
      }
      // Real short links are always https; the http branch exists purely so
      // this logic is testable against a local mock server.
      const client = parsed.protocol === 'http:' ? http : https;
      const req = client.request(
        {
          method: 'GET',
          hostname: parsed.hostname,
          port: parsed.port || undefined,
          path: parsed.pathname + parsed.search,
          headers: {
            'User-Agent': BROWSER_USER_AGENT,
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
          timeout: 8000,
        },
        (res) => {
          const location = res.headers.location;
          if (location && res.statusCode >= 300 && res.statusCode < 400) {
            res.resume();
            if (redirectsLeft <= 0) return reject(new Error('Too many redirects resolving map link.'));
            const nextUrl = new URL(location, currentUrl).toString();
            return attempt(nextUrl, redirectsLeft - 1);
          }
          // No redirect header — before settling on this as the final URL,
          // check whether it's already embeddable/has what we need in its
          // own URL; if not, read a bit of the body in case it's an
          // interstitial page pointing further on via HTML/meta-refresh.
          if (isEmbeddableUrl(currentUrl) || extractFromLongUrl(currentUrl)) {
            res.resume();
            return resolve(currentUrl);
          }
          let body = '';
          res.on('data', (chunk) => {
            if (body.length < 50000) body += chunk;
          });
          res.on('end', () => {
            const found = findUrlInHtml(body);
            if (found && redirectsLeft > 0) {
              const nextUrl = new URL(found, currentUrl).toString();
              return attempt(nextUrl, redirectsLeft - 1);
            }
            resolve(currentUrl);
          });
        }
      );
      req.on('timeout', () => req.destroy(new Error('Timed out resolving map link.')));
      req.on('error', reject);
      req.end();
    };
    attempt(startUrl, maxRedirects);
  });
}

// Pulls a lat/lng pair or a place name out of a full (resolved) Google Maps
// URL, e.g.:
//   https://www.google.com/maps/place/Rolen+School/@5.5765,-0.2810,17z/...
//                                        ^^^^^^^^^^^ place name    ^^^^^^^^^ coords
function extractFromLongUrl(longUrl) {
  const coordMatch = longUrl.match(/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);
  if (coordMatch) {
    return { lat: coordMatch[1], lng: coordMatch[2] };
  }
  const placeMatch = longUrl.match(/\/maps\/place\/([^/@]+)/);
  if (placeMatch) {
    try {
      return { query: decodeURIComponent(placeMatch[1].replace(/\+/g, ' ')) };
    } catch (err) {
      return { query: placeMatch[1].replace(/\+/g, ' ') };
    }
  }
  return null;
}

// Builds a working embed URL directly from address-like text — no network
// call, so it can never fail the way resolving a share link can. Used as
// the final safety net in settingsController: if a pasted Maps link
// couldn't be turned into something embeddable for any reason, the Contact
// page still gets a real map instead of a blank box.
function buildAddressEmbedUrl(parts) {
  const query = (parts || []).filter(Boolean).join(', ').trim();
  if (!query) return null;
  return `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
}

// Main entry point — called from settingsController.updateSettings whenever
// mapEmbedUrl is part of the save. Best-effort by design: on any failure
// (short link host unreachable, unexpected format, etc.) it falls back to
// returning the admin's original input unchanged rather than throwing and
// blocking the whole Settings save.
async function normalizeMapEmbedUrl(input) {
  const trimmed = (input || '').trim();
  if (!trimmed) return trimmed;

  // Already a working embed URL (or the admin pasted a full <iframe> embed
  // snippet some other tool generated) — leave it alone.
  if (isEmbeddableUrl(trimmed)) return trimmed;

  const looksLikeUrl = /^https?:\/\//i.test(trimmed);

  // Plain text (an address, a place name) — no redirect to follow, just
  // build the embed directly. This also covers the very common case of an
  // admin typing/pasting the campus address instead of a Maps link at all.
  if (!looksLikeUrl) {
    return `https://www.google.com/maps?q=${encodeURIComponent(trimmed)}&output=embed`;
  }

  let finalUrl = trimmed;
  try {
    const parsed = new URL(trimmed);
    if (SHORT_LINK_HOSTS.has(parsed.hostname)) {
      finalUrl = await resolveFinalUrl(trimmed);
    }
  } catch (err) {
    // Couldn't resolve the short link (network hiccup, host briefly
    // unreachable, etc.) — fall through and try extracting from what was
    // pasted as-is; a maps.app.goo.gl short code alone carries no
    // coordinates, so this will typically fall through to the final
    // "return unchanged" case below rather than silently losing the input.
    finalUrl = trimmed;
  }

  const extracted = extractFromLongUrl(finalUrl);
  if (extracted?.lat && extracted?.lng) {
    return `https://www.google.com/maps?q=${extracted.lat},${extracted.lng}&z=16&output=embed`;
  }
  if (extracted?.query) {
    return `https://www.google.com/maps?q=${encodeURIComponent(extracted.query)}&output=embed`;
  }

  // Nothing embeddable could be pulled out — return whatever we resolved to
  // (better than the short link, but may still need a manual fix) so the
  // save isn't silently dropped.
  return finalUrl;
}

module.exports = {
  normalizeMapEmbedUrl,
  isEmbeddableUrl,
  extractFromLongUrl,
  resolveFinalUrl,
  buildAddressEmbedUrl,
};
