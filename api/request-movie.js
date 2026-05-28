const { handleRequestMovie } = require('./request-movie.shared.cjs');

module.exports = async function handler(req, res) {
  const response = await handleRequestMovie({
    method: req.method,
    headers: req.headers,
    body: req.body,
    ip: clientIp(req),
    env: process.env,
    fetchImpl: fetch
  });

  for (const [name, value] of Object.entries(response.headers)) {
    res.setHeader(name, value);
  }

  return res.status(response.status).json(response.body);
};

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];

  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }

  return req.socket?.remoteAddress || 'unknown';
}
