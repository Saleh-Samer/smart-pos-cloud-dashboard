/* ==========================================================================
   Smart POS — Cloud Dashboard (receiver + read-only viewer)

   One-way by design: the shop's local server pushes a JSON snapshot here
   (POST /api/push, authenticated with a shared secret only the shop server
   knows). This app only ever stores the latest snapshot and shows it back
   to the owner behind its own login — it never calls back to the shop.

   No database: "latest snapshot" is exactly what's needed (no history), so
   it's just one JSON file on this service's own disk. If a rare redeploy
   resets it, the next push from the shop (every few minutes, and after
   every checkout) fills it back in.
   ========================================================================== */

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const DATA_DIR = path.join(__dirname, 'data');
const LATEST_PATH = path.join(DATA_DIR, 'latest.json');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const JWT_SECRET = process.env.JWT_SECRET;
const PUSH_SECRET = process.env.PUSH_SECRET || '';
const DASHBOARD_PASSWORD_HASH = process.env.DASHBOARD_PASSWORD_HASH || '';

if (!JWT_SECRET || !PUSH_SECRET) {
  console.warn('[startup] JWT_SECRET and/or PUSH_SECRET is not set — set them in .env before relying on this service.');
}

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'smart-pos-cloud-dashboard' }));

// ---------- Machine-to-machine: the shop's local server pushes here ----------
// No login/session involved on purpose — this is the shop's own server
// talking to this one, authenticated only by the shared secret.
app.post('/api/push', (req, res) => {
  if (!PUSH_SECRET || req.headers['x-push-secret'] !== PUSH_SECRET) {
    return res.status(401).json({ error: 'Invalid push secret.' });
  }
  const snapshot = { ...req.body, receivedAt: new Date().toISOString() };
  fs.writeFileSync(LATEST_PATH, JSON.stringify(snapshot, null, 2));
  res.json({ ok: true });
});

// ---------- Dashboard's own login ----------
// The shop may be offline right when the owner checks this page — that's
// the whole point of checking remotely — so this can't verify against the
// shop's live accounts. It has its own single admin password instead.
app.post('/api/login', (req, res) => {
  if (!DASHBOARD_PASSWORD_HASH) {
    return res.status(500).json({ error: 'This server has no DASHBOARD_PASSWORD_HASH configured yet.' });
  }
  const password = (req.body && req.body.password) || '';
  if (!password || !bcrypt.compareSync(password, DASHBOARD_PASSWORD_HASH)) {
    return res.status(401).json({ error: 'Incorrect password.' });
  }
  const token = jwt.sign({ role: 'owner' }, JWT_SECRET, { expiresIn: '12h' });
  res.json({ token });
});

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing session token.' });
  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired session.' });
  }
}

app.get('/api/data', requireAuth, (req, res) => {
  if (!fs.existsSync(LATEST_PATH)) {
    return res.json({ empty: true });
  }
  res.json(JSON.parse(fs.readFileSync(LATEST_PATH, 'utf8')));
});

app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Smart POS cloud dashboard listening on port ${PORT}`));
