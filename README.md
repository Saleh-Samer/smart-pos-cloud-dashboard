# Smart POS Cloud

One website for every shop running Smart POS.

- **Shops** push their day's numbers here (Smart POS → Settings → Remote Monitoring → paste the connection code).
- **Managers** open the site, sign in with their shop code + password, and see only their own shop — today and up to 90 days back.
- **You (the owner)** open `/admin.html` to add shops, get each shop's connection code and manager password, reset passwords, or disable a shop.

## Environment (Render → Environment)

| Variable | What |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (e.g. Neon free tier). Secret. |
| `JWT_SECRET` | Long random string, 32+ characters (Render "Generate"). |
| `ADMIN_PASSWORD_HASH` | Hash of your owner password — run `npm run hash-password` (or "Make Owner Password.bat"). |
| `PUBLIC_URL` | Optional. The site's address, used inside connection codes. |

## How data is stored

Pushes are kept in memory and written to the database every 10 minutes and on shutdown. The free database bills by active time; batching keeps it asleep most of the time no matter how many shops push. Every push carries the whole day, so a missed batch is refilled by the next push.

## Local test (no database)

```
DATABASE_URL=pg-mem JWT_SECRET=<32+ chars> ADMIN_PASSWORD_HASH=<hash> node server.js
```
