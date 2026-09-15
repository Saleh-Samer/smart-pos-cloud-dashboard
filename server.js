/* ==========================================================================
   Smart POS Cloud — one website for every shop

   - Each shop's Smart POS pushes its day's numbers here (one-way; this site
     never talks back to a shop).
   - Each shop's manager signs in with their shop code + password and sees
     only their own shop.
   - The owner (whoever sells Smart POS) signs in at /admin.html to add shops
     and hand out connection codes.

   Database writes are batched: pushes land in memory and are flushed every
   FLUSH_INTERVAL_MS (and on shutdown). The free database suspends when idle
   and bills by active time, so waking it for every shop's every push would
   burn through the free allowance as shops are added. A push always carries
   the whole day, so nothing is lost if a batch is ever missed — the next
   push brings it back.

   Env: DATABASE_URL, JWT_SECRET, ADMIN_PASSWORD_HASH (see .env.example)
   ========================================================================== */

require('dotenv').config();
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./db');

// Values pasted into a hosting dashboard often carry extras copied along with
// them: surrounding quotes, a "KEY=" prefix, a "psql" command, stray spaces or
// line breaks. Strip those rather than fail on an otherwise correct value.
function cleanEnv(name) {
  let value = String(process.env[name] || '').trim();
  value = value.replace(new RegExp(`^${name}\\s*=\\s*`), '').replace(/^psql\s+/, '').trim();
  value = value.replace(/^(['"])([\s\S]*)\1$/, '$2').trim();
  return value;
}

process.env.DATABASE_URL = cleanEnv('DATABASE_URL');
const PORT = process.env.PORT || 5000;
const JWT_SECRET = cleanEnv('JWT_SECRET');
const ADMIN_PASSWORD_HASH = cleanEnv('ADMIN_PASSWORD_HASH');
const FLUSH_INTERVAL_MS = Number(process.env.FLUSH_INTERVAL_MS) || 10 * 60 * 1000;
const KEEP_DAYS = 90;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Say exactly which setting is wrong (never the value itself) so a bad paste is easy to spot in the logs.
const configProblems = [];
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) configProblems.push('DATABASE_URL is empty.');
else if (dbUrl !== 'pg-mem' && !/^postgres(ql)?:\/\/[^\s]+$/.test(dbUrl)) configProblems.push('DATABASE_URL must start with postgresql:// and be one line.');
else if (/\*{3,}/.test(dbUrl)) configProblems.push('DATABASE_URL still has **** in place of the password — copy it again after "Show password".');
if (JWT_SECRET.length < 32) configProblems.push(`JWT_SECRET must be at least 32 characters (it has ${JWT_SECRET.length}).`);
if (!/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(ADMIN_PASSWORD_HASH)) configProblems.push('ADMIN_PASSWORD_HASH must be the single line starting with $2a$10$ from the password tool.');
if (configProblems.length) {
  configProblems.forEach((p) => console.error('[startup] ' + p));
  process.exit(1);
}

/* ---------- Helpers ---------- */

const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

// No look-alike characters (0/O, 1/I/L), so codes survive being read aloud or typed on a phone.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function randomString(length) {
  const out = [];
  while (out.length < length) {
    for (const b of crypto.randomBytes(length)) {
      if (b < 256 - (256 % CODE_ALPHABET.length) && out.length < length) out.push(CODE_ALPHABET[b % CODE_ALPHABET.length]);
    }
  }
  return out.join('');
}

// Unknown shop codes are still checked against a hash, so response time
// doesn't reveal which codes exist.
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(12).toString('hex'), 10);

function publicUrl(req) {
  return (process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
}

/** What gets pasted into Smart POS → Settings → Remote Monitoring. */
function connectionCode(req, shopCode, pushKey) {
  const body = Buffer.from(JSON.stringify({ u: publicUrl(req), c: shopCode, k: pushKey })).toString('base64url');
  return `SPC1.${body}`;
}

/* ---------- In-memory state ---------- */

// Shops are few and change only through this server, so they live in memory
// and a push never needs a database round trip to authenticate.
const shopsByCode = new Map();
const shopsById = new Map();
function cacheShop(shop) {
  shopsByCode.set(shop.code, shop);
  shopsById.set(shop.id, shop);
}

const pendingSnapshots = new Map(); // `${shopId}|${date}` -> { shopId, date, payload, receivedAt }
const lastPushTimes = new Map();     // shopId -> ISO time (flushed with the snapshots)
let flushing = null;

function shopView(shop) {
  return {
    id: shop.id,
    code: shop.code,
    name: shop.name,
    disabled: shop.disabled,
    lastPushAt: lastPushTimes.get(shop.id) || (shop.last_push_at ? new Date(shop.last_push_at).toISOString() : null),
    createdAt: new Date(shop.created_at).toISOString()
  };
}

function flush() {
  if (flushing) return flushing;
  if (!pendingSnapshots.size && !lastPushTimes.size) return Promise.resolve();

  const entries = [...pendingSnapshots.values()];
  const times = [...lastPushTimes.entries()];
  flushing = (async () => {
    try {
      await db.saveSnapshots(entries);
      await db.saveLastPushTimes(times);
      // Only drop what was written — a newer push that arrived mid-flush stays queued.
      for (const e of entries) {
        const key = `${e.shopId}|${e.date}`;
        if (pendingSnapshots.get(key) === e) pendingSnapshots.delete(key);
      }
      for (const [shopId, at] of times) {
        const shop = shopsById.get(shopId);
        if (shop) shop.last_push_at = at;
        if (lastPushTimes.get(shopId) === at) lastPushTimes.delete(shopId);
      }
    } catch (err) {
      console.error('[flush] failed, will retry next cycle:', err.message);
    } finally {
      flushing = null;
    }
  })();
  return flushing;
}

/* ---------- Sign-in rate limiting ---------- */

const attempts = new Map(); // key -> { count, resetAt }
const MAX_ATTEMPTS = 10;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

function tooManyAttempts(key) {
  const entry = attempts.get(key);
  return Boolean(entry && entry.resetAt > Date.now() && entry.count >= MAX_ATTEMPTS);
}
function recordFailure(key) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) attempts.set(key, { count: 1, resetAt: now + ATTEMPT_WINDOW_MS });
  else entry.count++;
}
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of attempts) if (entry.resetAt < now) attempts.delete(key);
}, ATTEMPT_WINDOW_MS).unref();

/* ---------- App ---------- */

const app = express();
app.set('trust proxy', 1); // behind Render's proxy: real client IP + https

app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; frame-ancestors 'none'"
  });
  next();
});
app.use(express.json({ limit: '512kb' }));

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'smart-pos-cloud' }));

/* ---------- Shop → cloud pushes ---------- */

function authenticatePush(req, res) {
  const shop = shopsByCode.get(String(req.get('X-Shop-Code') || '').toUpperCase());
  const key = req.get('X-Push-Key') || '';
  if (!shop || !key || !safeEqual(sha256(key), shop.push_key_hash)) {
    res.status(401).json({ error: 'Invalid connection code.' });
    return null;
  }
  if (shop.disabled) {
    res.status(403).json({ error: 'This shop has been disabled.' });
    return null;
  }
  return shop;
}

// Lets Smart POS confirm a pasted connection code works before saving it.
app.post('/api/push/verify', (req, res) => {
  const shop = authenticatePush(req, res);
  if (shop) res.json({ ok: true, shopName: shop.name, shopCode: shop.code });
});

app.post('/api/push', (req, res) => {
  const shop = authenticatePush(req, res);
  if (!shop) return;

  const snapshots = Array.isArray(req.body && req.body.snapshots) ? req.body.snapshots : null;
  if (!snapshots || !snapshots.length || snapshots.length > 3) {
    return res.status(400).json({ error: 'Expected 1-3 snapshots.' });
  }
  if (!snapshots.every((snap) => snap && typeof snap === 'object' && DATE_RE.test(snap.date || ''))) {
    return res.status(400).json({ error: 'Each snapshot needs a date (YYYY-MM-DD).' });
  }

  const receivedAt = new Date().toISOString();
  for (const snap of snapshots) {
    pendingSnapshots.set(`${shop.id}|${snap.date}`, { shopId: shop.id, date: snap.date, payload: snap, receivedAt });
  }
  lastPushTimes.set(shop.id, receivedAt);
  res.json({ ok: true, shopName: shop.name });
});

/* ---------- Sessions ---------- */

function requireRole(role) {
  return (req, res, next) => {
    const header = req.get('Authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      if (payload.role !== role) throw new Error('wrong role');
      if (role === 'manager') {
        const shop = shopsById.get(payload.sid);
        // A password reset or disabling the shop signs every manager session out.
        if (!shop || shop.disabled || shop.password_version !== payload.pv) throw new Error('stale');
        req.shop = shop;
      }
      next();
    } catch (err) {
      res.status(401).json({ error: 'Your session has ended. Please sign in again.' });
    }
  };
}

/* ---------- Manager (one shop) ---------- */

app.post('/api/login', async (req, res) => {
  const code = String((req.body && req.body.code) || '').trim().toUpperCase();
  const password = String((req.body && req.body.password) || '');
  const limitKey = `m|${req.ip}`;
  if (tooManyAttempts(limitKey)) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });

  const shop = shopsByCode.get(code);
  const ok = await bcrypt.compare(password, shop ? shop.manager_password_hash : DUMMY_HASH);
  if (!shop || !ok) {
    recordFailure(limitKey);
    return res.status(401).json({ error: 'Incorrect shop code or password.' });
  }
  if (shop.disabled) return res.status(403).json({ error: 'This shop has been disabled.' });

  const token = jwt.sign({ role: 'manager', sid: shop.id, pv: shop.password_version }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, shop: { name: shop.name, code: shop.code } });
});

app.get('/api/shop', requireRole('manager'), async (req, res) => {
  try {
    const stored = await db.listDates(req.shop.id, KEEP_DAYS);
    const pending = [...pendingSnapshots.values()].filter((e) => e.shopId === req.shop.id).map((e) => e.date);
    const dates = [...new Set([...pending, ...stored])].sort().reverse();
    res.json({ ...shopView(req.shop), dates });
  } catch (err) {
    console.error('[shop] list dates failed:', err.message);
    res.status(503).json({ error: 'Could not reach the database. Try again shortly.' });
  }
});

app.get('/api/shop/snapshot', requireRole('manager'), async (req, res) => {
  const date = String(req.query.date || '');
  if (!DATE_RE.test(date)) return res.status(400).json({ error: 'A date is required.' });

  const pending = pendingSnapshots.get(`${req.shop.id}|${date}`);
  if (pending) return res.json({ date, receivedAt: pending.receivedAt, data: pending.payload });
  try {
    const stored = await db.getSnapshot(req.shop.id, date);
    if (!stored) return res.json({ date, empty: true });
    res.json({ date, receivedAt: stored.receivedAt, data: stored.payload });
  } catch (err) {
    console.error('[shop] snapshot failed:', err.message);
    res.status(503).json({ error: 'Could not reach the database. Try again shortly.' });
  }
});

/* ---------- Owner (all shops) ---------- */

app.post('/api/admin/login', async (req, res) => {
  const limitKey = `a|${req.ip}`;
  if (tooManyAttempts(limitKey)) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
  const ok = await bcrypt.compare(String((req.body && req.body.password) || ''), ADMIN_PASSWORD_HASH);
  if (!ok) {
    recordFailure(limitKey);
    return res.status(401).json({ error: 'Incorrect password.' });
  }
  res.json({ token: jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '12h' }) });
});

app.get('/api/admin/shops', requireRole('admin'), (req, res) => {
  res.json([...shopsById.values()].map(shopView).sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
});

function validName(body) {
  const name = String((body && body.name) || '').trim();
  return name && name.length <= 80 ? name : null;
}

app.post('/api/admin/shops', requireRole('admin'), async (req, res) => {
  const name = validName(req.body);
  if (!name) return res.status(400).json({ error: 'Enter a shop name (up to 80 characters).' });

  const managerPassword = randomString(10);
  const pushKey = crypto.randomBytes(24).toString('base64url');
  try {
    let code;
    do { code = `SP-${randomString(6)}`; } while (shopsByCode.has(code));
    const shop = await db.insertShop({ code, name, managerPasswordHash: await bcrypt.hash(managerPassword, 10), pushKeyHash: sha256(pushKey) });
    cacheShop(shop);
    res.status(201).json({ shop: shopView(shop), managerPassword, connectionCode: connectionCode(req, shop.code, pushKey) });
  } catch (err) {
    console.error('[admin] create shop failed:', err.message);
    res.status(503).json({ error: 'Could not reach the database. Try again shortly.' });
  }
});

async function applyShopUpdate(res, id, fields, extra) {
  const current = shopsById.get(id);
  if (!current) return res.status(404).json({ error: 'Shop not found.' });
  try {
    const updated = await db.updateShop(id, fields);
    updated.last_push_at = current.last_push_at;
    cacheShop(updated);
    res.json({ shop: shopView(updated), ...extra });
  } catch (err) {
    console.error('[admin] update shop failed:', err.message);
    res.status(503).json({ error: 'Could not reach the database. Try again shortly.' });
  }
}

app.post('/api/admin/shops/:id/reset-password', requireRole('admin'), async (req, res) => {
  const shop = shopsById.get(Number(req.params.id));
  if (!shop) return res.status(404).json({ error: 'Shop not found.' });
  const managerPassword = randomString(10);
  await applyShopUpdate(res, shop.id, {
    managerPasswordHash: await bcrypt.hash(managerPassword, 10),
    passwordVersion: shop.password_version + 1
  }, { managerPassword });
});

// A new connection code — the old one stops working at once (e.g. the shop's PC was replaced, or the code leaked).
app.post('/api/admin/shops/:id/new-connection-code', requireRole('admin'), async (req, res) => {
  const shop = shopsById.get(Number(req.params.id));
  if (!shop) return res.status(404).json({ error: 'Shop not found.' });
  const pushKey = crypto.randomBytes(24).toString('base64url');
  await applyShopUpdate(res, shop.id, { pushKeyHash: sha256(pushKey) }, { connectionCode: connectionCode(req, shop.code, pushKey) });
});

app.post('/api/admin/shops/:id/rename', requireRole('admin'), async (req, res) => {
  const name = validName(req.body);
  if (!name) return res.status(400).json({ error: 'Enter a shop name (up to 80 characters).' });
  await applyShopUpdate(res, Number(req.params.id), { name });
});

app.post('/api/admin/shops/:id/disabled', requireRole('admin'), async (req, res) => {
  await applyShopUpdate(res, Number(req.params.id), { disabled: Boolean(req.body && req.body.disabled) });
});

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

/* ---------- Boot ---------- */

async function main() {
  db.connect();
  await db.migrate();
  (await db.allShops()).forEach(cacheShop);
  await db.pruneSnapshots(KEEP_DAYS).catch((err) => console.error('[prune]', err.message));

  setInterval(flush, FLUSH_INTERVAL_MS).unref();
  setInterval(() => db.pruneSnapshots(KEEP_DAYS).catch(() => {}), 24 * 60 * 60 * 1000).unref();

  const server = app.listen(PORT, () => console.log(`Smart POS Cloud listening on port ${PORT} (${shopsById.size} shop(s))`));

  // Render stops idle free instances with SIGTERM — write whatever is queued first.
  const shutdown = async (signal) => {
    console.log(`[shutdown] ${signal} — flushing ${pendingSnapshots.size} pending snapshot(s)`);
    server.close();
    await flush();
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('[startup] failed:', err.message);
  process.exit(1);
});
