/* ==========================================================================
   Smart POS Cloud — Database (PostgreSQL, e.g. Neon's free tier)
   Two tables:
   - shops:     one row per shop you've sold Smart POS to (its login + push key)
   - snapshots: one row per shop per day — that day's numbers as last pushed
   - backups:   the latest full database backup per shop (gzip), for restoring
                a shop whose computer died or was stolen

   DATABASE_URL=pg-mem runs an in-memory Postgres instead, for local testing
   only (nothing is saved when the process stops).
   ========================================================================== */

const { Pool } = require('pg');

let pool;

function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set.');

  if (url === 'pg-mem') {
    const { newDb } = require('pg-mem');
    const mem = newDb();
    const adapter = mem.adapters.createPg();
    pool = new adapter.Pool();
    return;
  }

  pool = new Pool({
    connectionString: url,
    ssl: url.includes('localhost') ? false : { rejectUnauthorized: true },
    max: 3,
    idleTimeoutMillis: 30000
  });
  // A dropped idle connection (e.g. the database suspending) must not crash the server.
  pool.on('error', (err) => console.error('[db] idle client error:', err.message));
}

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS shops (
      id                    SERIAL PRIMARY KEY,
      code                  TEXT NOT NULL UNIQUE,
      name                  TEXT NOT NULL,
      manager_password_hash TEXT NOT NULL,
      password_version      INTEGER NOT NULL DEFAULT 1,
      push_key_hash         TEXT NOT NULL,
      disabled              BOOLEAN NOT NULL DEFAULT FALSE,
      last_push_at          TIMESTAMPTZ,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS snapshots (
      shop_id       INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
      business_date TEXT NOT NULL,   -- 'YYYY-MM-DD', the shop's own business day
      payload       JSONB NOT NULL,
      received_at   TIMESTAMPTZ NOT NULL,
      PRIMARY KEY (shop_id, business_date)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS backups (
      shop_id        INTEGER PRIMARY KEY REFERENCES shops(id) ON DELETE CASCADE,
      data           TEXT NOT NULL,           -- base64 of the gzip of the shop's SQLite file (text works identically on every Postgres, incl. the in-memory test one)
      compressed_size INTEGER NOT NULL,
      original_size  INTEGER NOT NULL,
      sha256         TEXT NOT NULL,           -- of the gzip bytes
      business_date  TEXT,
      created_at     TIMESTAMPTZ NOT NULL,    -- when the shop made it
      received_at    TIMESTAMPTZ NOT NULL
    )
  `);
}

const SHOP_COLUMNS = 'id, code, name, manager_password_hash, password_version, push_key_hash, disabled, last_push_at, created_at';

async function allShops() {
  const { rows } = await pool.query(`SELECT ${SHOP_COLUMNS} FROM shops ORDER BY created_at ASC`);
  return rows;
}

async function insertShop({ code, name, managerPasswordHash, pushKeyHash }) {
  const { rows } = await pool.query(
    `INSERT INTO shops (code, name, manager_password_hash, push_key_hash) VALUES ($1, $2, $3, $4) RETURNING ${SHOP_COLUMNS}`,
    [code, name, managerPasswordHash, pushKeyHash]
  );
  return rows[0];
}

async function updateShop(id, fields) {
  const allowed = { name: 'name', managerPasswordHash: 'manager_password_hash', passwordVersion: 'password_version', pushKeyHash: 'push_key_hash', disabled: 'disabled' };
  const sets = [];
  const values = [];
  for (const [key, column] of Object.entries(allowed)) {
    if (fields[key] !== undefined) {
      values.push(fields[key]);
      sets.push(`${column} = $${values.length}`);
    }
  }
  if (!sets.length) return null;
  values.push(id);
  const { rows } = await pool.query(`UPDATE shops SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING ${SHOP_COLUMNS}`, values);
  return rows[0] || null;
}

/** Writes a batch of buffered pushes in one round trip per row. */
async function saveSnapshots(entries) {
  for (const e of entries) {
    await pool.query(
      `INSERT INTO snapshots (shop_id, business_date, payload, received_at) VALUES ($1, $2, $3, $4)
       ON CONFLICT (shop_id, business_date) DO UPDATE SET payload = EXCLUDED.payload, received_at = EXCLUDED.received_at`,
      [e.shopId, e.date, JSON.stringify(e.payload), e.receivedAt]
    );
  }
}

async function saveLastPushTimes(times) {
  for (const [shopId, at] of times) {
    await pool.query('UPDATE shops SET last_push_at = $1 WHERE id = $2', [at, shopId]);
  }
}

async function getSnapshot(shopId, date) {
  const { rows } = await pool.query(
    'SELECT payload, received_at FROM snapshots WHERE shop_id = $1 AND business_date = $2',
    [shopId, date]
  );
  if (!rows[0]) return null;
  const payload = typeof rows[0].payload === 'string' ? JSON.parse(rows[0].payload) : rows[0].payload;
  return { payload, receivedAt: new Date(rows[0].received_at).toISOString() };
}

async function listDates(shopId, limit) {
  const { rows } = await pool.query(
    'SELECT business_date AS d FROM snapshots WHERE shop_id = $1 ORDER BY business_date DESC LIMIT $2',
    [shopId, limit]
  );
  return rows.map((r) => r.d);
}

async function pruneSnapshots(keepDays) {
  const cutoff = new Date(Date.now() - keepDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await pool.query('DELETE FROM snapshots WHERE business_date < $1', [cutoff]);
}

/** Keeps only the newest backup per shop — the free database is small. */
async function saveBackup(b) {
  await pool.query(
    `INSERT INTO backups (shop_id, data, compressed_size, original_size, sha256, business_date, created_at, received_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (shop_id) DO UPDATE SET data = EXCLUDED.data, compressed_size = EXCLUDED.compressed_size,
       original_size = EXCLUDED.original_size, sha256 = EXCLUDED.sha256, business_date = EXCLUDED.business_date,
       created_at = EXCLUDED.created_at, received_at = EXCLUDED.received_at`,
    [b.shopId, b.data.toString('base64'), b.compressedSize, b.originalSize, b.sha256, b.businessDate, b.createdAt, b.receivedAt]
  );
}

async function getBackup(shopId) {
  const { rows } = await pool.query('SELECT * FROM backups WHERE shop_id = $1', [shopId]);
  if (!rows[0]) return null;
  return { ...rows[0], data: Buffer.from(rows[0].data, 'base64') };
}

/** Everything about each shop's backup except the (large) file itself. */
async function backupSummaries() {
  const { rows } = await pool.query('SELECT shop_id, compressed_size, original_size, business_date, created_at, received_at FROM backups');
  return rows;
}

module.exports = { saveBackup, getBackup, backupSummaries, connect, migrate, allShops, insertShop, updateShop, saveSnapshots, saveLastPushTimes, getSnapshot, listDates, pruneSnapshots };
