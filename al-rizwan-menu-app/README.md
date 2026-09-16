# Al-Rizwan Paratha Experts — Digital Menu

A live, database-backed menu:
- Customers scan a QR code → see the menu, tap items to highlight their picks, call or WhatsApp to order.
- Staff open a private, hard-to-guess URL → log in with a password → edit prices or mark items "sold out" → changes appear for every customer immediately (next page load/refresh), because everyone reads from the same Neon database.

The admin password and the admin page's URL both live in **environment variables**, not in any file sent to a customer's browser.

---

## 1. Create the database (Neon)

1. Go to [neon.tech](https://neon.tech) → sign up → **New Project**.
2. Once created, open **Connection Details** and copy the connection string. It looks like:
   `postgresql://user:password@ep-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require`
3. Keep this tab open — you'll paste it into Render in step 3.

## 2. Push this project to GitHub

```bash
cd al-rizwan-menu-app
git init
git add .
git commit -m "Al-Rizwan digital menu"
```
Create a new GitHub repo and push it there. (`.env` is already git-ignored — never commit real secrets.)

## 3. Deploy to Render

1. [render.com](https://render.com) → **New +** → **Web Service** → connect your GitHub repo.
2. Build command: `npm install`
3. Start command: `npm start`
4. Under **Environment**, add these variables:

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | the Neon connection string from step 1 |
   | `ADMIN_PASSWORD` | a password only your staff know |
   | `ADMIN_PATH` | a random string, e.g. `kR9x2mQp7` |
   | `SESSION_SECRET` | a long random string (generate below) |
   | `SESSION_HOURS` | `8` (or however long a staff login should last) |
   | `NODE_ENV` | `production` |

   Generate a strong `SESSION_SECRET` locally:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

5. Deploy. Render will build and start the app.

## 4. Load the menu into the database

Run this **once**, from your own computer, with `DATABASE_URL` set to the same Neon connection string (put it in a local `.env` file, copied from `.env.example`):

```bash
npm install
npm run seed
```

This creates the tables and loads every category, item, and price from the menu boards you provided. Re-running it later will reset prices/availability back to these defaults — don't run it again after staff have made live edits unless you mean to reset.

### If your database already existed before a feature update

Two follow-up scripts exist for updating a **live** database safely, without wiping anything:

- `npm run add-new-items` — adds any dishes/categories from later menu-board updates that aren't in the database yet, and applies a short list of known price corrections. Safe to run anytime.
- `npm run add-media-columns` — adds the `description` and `images` columns needed for the dish-photo feature. Run this once if your database was seeded before that feature existed.

## 4.5 Dish photos & descriptions

Each item can have up to 3 photos and a short (~200 word) description, editable from the admin panel (tap the 📷 button next to any item). Photos are stored directly in the database as compressed images — no external image host needed — and are only downloaded by a customer's phone when they actually tap that dish, so the main menu stays fast to load even with photos on every item.

## 5. Point your QR code at the site

- Customer menu: `https://your-app.onrender.com/`
- Staff admin: `https://your-app.onrender.com/<ADMIN_PATH>` — share this URL only with staff (e.g. over WhatsApp), never post it publicly or link it from the menu. Nothing on the customer page references it.

## How the security works

- The admin password is checked **only on the server**, against `process.env.ADMIN_PASSWORD`. It is never included in any HTML/JS file sent to a browser, so opening dev tools on the customer page reveals nothing.
- The admin page itself lives outside the public folder and is only served at the one route matching `ADMIN_PATH`. Guessing common paths like `/admin` or `/staff` won't find it.
- After login, an `httpOnly` signed session cookie (using `SESSION_SECRET`) authorizes further edits for `SESSION_HOURS` hours, then staff need to log in again.
- All menu reads/writes go through the API — the database credentials never reach the browser either.

## Local development

```bash
cp .env.example .env
# fill in DATABASE_URL, ADMIN_PASSWORD, ADMIN_PATH, SESSION_SECRET
npm install
npm run seed
npm start
```
Then open `http://localhost:3000` (customer menu) and `http://localhost:3000/<ADMIN_PATH>` (admin).

## Project structure

```
server.js          — Express app, routes, and the one hidden admin URL
routes/menu.js      — GET /api/menu (public)
routes/admin.js      — login/logout/session + item edits + change log (all require auth)
middleware/auth.js   — verifies the admin session cookie
db/pool.js           — Neon Postgres connection
db/schema.sql        — table definitions
scripts/seed.js      — loads the real menu data into the database
public/index.html    — customer-facing menu (fetches live data, no admin code at all)
public/logo.jpg      — your logo, served as a normal static file
views/admin.html     — admin dashboard (only reachable via ADMIN_PATH)
```
