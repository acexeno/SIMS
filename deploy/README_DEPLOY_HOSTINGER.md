# SIMS (BuildIt PC) - Hostinger Deployment Guide

This project is prepared for a simple upload-and-extract deployment on Hostinger.

## What is included in the ZIP
- `dist/` – Production React build (static files)
- `backend/` – PHP API (all endpoints)
- `.htaccess` – Root rewrite rules for SPA routing and Authorization headers
- `.env` – App and database configuration (edit `DB_PASS` before or after upload)
- `backend/health.php` – Diagnostic endpoint to verify DB connectivity

## Steps
1) Create a MySQL database and user in Hostinger.
   - Example:
     - Database: `u709288172_builditpc_db`
     - User: `u709288172_sims`
     - Password: `YOUR_PASSWORD`
   - Grant the user full privileges on the database.

2) Upload the ZIP to your domain's `public_html/` folder and extract it.

3) Edit `.env` in `public_html/` and set:
   - `DB_HOST=localhost`
   - `DB_NAME=u709288172_builditpc_db` (or your own)
   - `DB_USER=u709288172_sims` (or your own)
   - `DB_PASS=YOUR_PASSWORD`
   - `DB_PORT=3306`
   - `DB_NAME_PREFIX=u709288172` (optional; used by the fallback if `DB_NAME` is not prefixed)
   - `APP_DEBUG=0` (set to `1` temporarily if you need to troubleshoot)

4) Import the database schema/data using phpMyAdmin (Hostinger panel) into the same database.

5) Verify using the health check:
   - Open: `https://yourdomain.tld/backend/health.php`
   - Expect: `{ "checks": { "db_connect": true, ... } }`

6) Test the application:
   - React app: `https://yourdomain.tld/` (served from `dist/`)
   - API sample: `https://yourdomain.tld/backend/api/index.php?endpoint=components&category=CPU`

## Notes
- Do not expose the `.env` file publicly. The provided `.htaccess` denies direct access to `.env`.
- For email, fill in the Gmail OAuth or App Password values in `.env` if you want outbound emails to work.
- Keep `APP_DEBUG=0` in production. Switch to `1` only temporarily to see error details, then set back to `0`.

## Troubleshooting
- 500 on API: check `.env` DB settings and try `APP_DEBUG=1` temporarily.
- CORS/auth header issues: `.htaccess` (root) and `backend/config/cors.php` already handle common cases, including `getallheaders()` polyfill.
- If `components` table shows 0 rows, ensure you imported the database correctly.
