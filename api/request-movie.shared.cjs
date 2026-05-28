const { createHash } = require('node:crypto');

const RESEND_API_URL = 'https://api.resend.com/emails';
const RATE_LIMIT_WINDOW_MS = 60_000;
const recentRequests = new Map();

async function handleRequestMovie({ method, headers = {}, body, ip = 'unknown', env = process.env, fetchImpl = fetch }) {
  if (method !== 'POST') {
    return jsonResponse(405, {
      ok: false,
      error: 'method_not_allowed',
      message: 'Use POST when sending a movie request.'
    }, { Allow: 'POST' });
  }

  const { RESEND_API_KEY, REQUEST_EMAIL_TO, REQUEST_EMAIL_FROM } = env;

  if (!RESEND_API_KEY || !REQUEST_EMAIL_TO || !REQUEST_EMAIL_FROM) {
    return jsonResponse(500, {
      ok: false,
      error: 'configuration_error',
      message: 'Movie requests are not configured on this deployment yet.'
    });
  }

  const payload = normalizePayload(body);

  if (!payload.title || !payload.tmdbId) {
    return jsonResponse(400, {
      ok: false,
      error: 'validation_error',
      message: 'Movie title and TMDB id are required.'
    });
  }

  const rateKey = `${ip}:${payload.tmdbId}:${payload.userEmail || payload.userName || 'anonymous'}`;

  if (isRateLimited(rateKey)) {
    return jsonResponse(429, {
      ok: false,
      error: 'rate_limited',
      message: 'Please wait a moment before sending that movie request again.'
    });
  }

  rememberRateLimit(rateKey);

  const timestamp = new Date().toISOString();
  const subject = `New OrionPlay movie request: ${payload.title}`;
  const html = buildHtmlEmail(payload, timestamp);
  const text = buildTextEmail(payload, timestamp);

  try {
    // Use a stable idempotency key so duplicate retries do not fan out extra emails.
    const resendResponse = await fetchImpl(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': payload.requestKey || buildIdempotencyKey(payload)
      },
      body: JSON.stringify({
        from: REQUEST_EMAIL_FROM,
        to: [REQUEST_EMAIL_TO],
        subject,
        html,
        text
      })
    });

    const result = await resendResponse.json().catch(() => ({}));

    if (!resendResponse.ok) {
      return jsonResponse(502, {
        ok: false,
        error: 'email_send_failed',
        message: 'We could not send the request email right now.'
      });
    }

    return jsonResponse(200, {
      ok: true,
      message: 'Request sent.',
      requestId: typeof result.id === 'string' ? result.id : undefined
    });
  } catch {
    return jsonResponse(502, {
      ok: false,
      error: 'email_send_failed',
      message: 'We could not send the request email right now.'
    });
  }
}

function jsonResponse(status, body, headers = {}) {
  return {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body
  };
}

function normalizePayload(rawBody) {
  const body = parseBody(rawBody);

  return {
    title: normalizeString(body.title, 180),
    tmdbId: normalizeTmdbId(body.tmdbId),
    releaseYear: normalizeYear(body.releaseYear),
    posterUrl: normalizeUrl(body.posterUrl, true),
    backdropUrl: normalizeUrl(body.backdropUrl, true),
    overview: normalizeString(body.overview, 4000),
    userName: normalizeString(body.userName, 180),
    userEmail: normalizeEmail(body.userEmail),
    pageUrl: normalizeUrl(body.pageUrl, false),
    requestKey: normalizeString(body.requestKey, 255)
  };
}

function parseBody(rawBody) {
  if (!rawBody) {
    return {};
  }

  if (typeof rawBody === 'string') {
    try {
      return JSON.parse(rawBody);
    } catch {
      return {};
    }
  }

  return typeof rawBody === 'object' ? rawBody : {};
}

function normalizeString(value, maxLength) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().slice(0, maxLength);
}

function normalizeTmdbId(value) {
  const parsed = typeof value === 'number' ? value : Number.parseInt(`${value ?? ''}`, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeYear(value) {
  const parsed = typeof value === 'number' ? value : Number.parseInt(`${value ?? ''}`, 10);
  return Number.isInteger(parsed) && parsed > 1800 && parsed < 3000 ? parsed : '';
}

function normalizeEmail(value) {
  const email = normalizeString(value, 320);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

function normalizeUrl(value, allowDataUrl) {
  const url = normalizeString(value, 2000);

  if (!url) {
    return '';
  }

  if (allowDataUrl && url.startsWith('data:')) {
    return '';
  }

  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : '';
  } catch {
    return '';
  }
}

function buildIdempotencyKey(payload) {
  const keySource = [payload.tmdbId, payload.userEmail, payload.userName, payload.title].join('|');
  return `orionplay-movie-request-${createHash('sha256').update(keySource).digest('hex').slice(0, 40)}`;
}

function buildHtmlEmail(payload, timestamp) {
  const rows = [
    ['Movie title', payload.title],
    ['TMDB id', payload.tmdbId],
    ['Release year', payload.releaseYear || 'Not provided'],
    ['Poster URL', payload.posterUrl || 'Not provided'],
    ['Backdrop URL', payload.backdropUrl || 'Not provided'],
    ['Overview', payload.overview || 'Not provided'],
    ['Requested by', formatRequester(payload)],
    ['Page URL', payload.pageUrl || 'Not provided'],
    ['Timestamp', timestamp]
  ];

  return `
    <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.6">
      <h1 style="margin:0 0 16px;font-size:24px">New OrionPlay movie request</h1>
      <table style="width:100%;border-collapse:collapse">
        <tbody>
          ${rows
            .map(
              ([label, value]) => `
                <tr>
                  <td style="padding:10px 12px;border:1px solid #dbe4f0;background:#f8fafc;font-weight:700;vertical-align:top">${escapeHtml(
                    `${label}`
                  )}</td>
                  <td style="padding:10px 12px;border:1px solid #dbe4f0;vertical-align:top">${linkify(value)}</td>
                </tr>
              `
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function buildTextEmail(payload, timestamp) {
  return [
    'New OrionPlay movie request',
    '',
    `Movie title: ${payload.title}`,
    `TMDB id: ${payload.tmdbId}`,
    `Release year: ${payload.releaseYear || 'Not provided'}`,
    `Poster URL: ${payload.posterUrl || 'Not provided'}`,
    `Backdrop URL: ${payload.backdropUrl || 'Not provided'}`,
    `Overview: ${payload.overview || 'Not provided'}`,
    `Requested by: ${formatRequester(payload)}`,
    `Page URL: ${payload.pageUrl || 'Not provided'}`,
    `Timestamp: ${timestamp}`
  ].join('\n');
}

function formatRequester(payload) {
  const name = payload.userName || 'Unknown user';
  return payload.userEmail ? `${name} <${payload.userEmail}>` : name;
}

function escapeHtml(value) {
  return `${value}`
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function linkify(value) {
  const text = `${value ?? ''}`;
  return /^https?:\/\//.test(text)
    ? `<a href="${escapeHtml(text)}" target="_blank" rel="noreferrer">${escapeHtml(text)}</a>`
    : escapeHtml(text);
}

function isRateLimited(rateKey) {
  const now = Date.now();
  cleanupRateLimit(now);
  const previous = recentRequests.get(rateKey) || 0;
  return now - previous < RATE_LIMIT_WINDOW_MS;
}

function rememberRateLimit(rateKey) {
  cleanupRateLimit(Date.now());
  recentRequests.set(rateKey, Date.now());
}

function cleanupRateLimit(now) {
  for (const [key, timestamp] of recentRequests.entries()) {
    if (now - timestamp >= RATE_LIMIT_WINDOW_MS) {
      recentRequests.delete(key);
    }
  }
}

module.exports = {
  handleRequestMovie
};
