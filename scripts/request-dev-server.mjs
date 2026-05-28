import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

const require = createRequire(import.meta.url);
const { handleRequestMovie } = require('../api/request-movie.shared.cjs');

loadEnv({ path: resolve('.env') });

if (existsSync(resolve('.env.local'))) {
  loadEnv({ path: resolve('.env.local'), override: true });
}

const port = Number.parseInt(process.env.REQUEST_API_PORT ?? '8787', 10) || 8787;

const server = createServer(async (req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.url !== '/api/request-movie') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, message: 'Not found.' }));
    return;
  }

  const body = await readJsonBody(req);
  const response = await handleRequestMovie({
    method: req.method ?? 'GET',
    headers: req.headers,
    body,
    ip: clientIp(req),
    env: process.env,
    fetchImpl: fetch
  });

  res.writeHead(response.status, response.headers);
  res.end(JSON.stringify(response.body));
});

server.listen(port, '127.0.0.1', () => {
  console.log(`[orionplay] Local request API listening on http://127.0.0.1:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}

async function readJsonBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString('utf8');

  if (!raw.trim()) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];

  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }

  return req.socket?.remoteAddress || 'unknown';
}
