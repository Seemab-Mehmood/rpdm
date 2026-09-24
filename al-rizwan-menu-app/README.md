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
- `npm run add-media-columns` — adds the `description`, `images`, and `thumb` columns needed for the dish-photo feature. Run this once if your database was seeded before that feature existed (or before the main-menu thumbnail was added) — it's safe to run again even if some of these columns already exist.

## 4.5 Dish photos & descriptions

Each item can have up to 3 photos and a short (~200 word) description. You can add both right when you create the item (the "Add a new item" form has a photo row and a description box), or edit them later from any existing item's 📷 button in the admin panel.

- The first photo also becomes a small **menu-list thumbnail** shown next to the dish on the customer's main screen — this is a separate, smaller image than the full-size photos in the detail popup, generated automatically in the browser when you save, so the main menu still loads fast even with a photo on every dish.
- Tapping a dish still opens the full detail popup with all its photos (swipeable if there's more than one) and its description.
- Photos are stored directly in the database as compressed images — no external image host needed.
- **If photo/description saves are failing** (an error like "the database may need the add-media-columns migration run"), your live database was set up before this feature existed — run `npm run add-media-columns` once against it (see above) and the saves will start working immediately, no redeploy needed.

## 4.6 Dine-in vs. online (WhatsApp) ordering

The customer menu now has two modes, controlled by a small banner right under the top bar:

- **Online mode** (the default) — for people reaching the menu from outside the restaurant (social media, Google, a shared link). They can tap dishes, set a quantity for each with a `+`/`−` stepper, and a floating bar appears showing their running total with a **"Send Order via WhatsApp"** button. Tapping it opens WhatsApp with a pre-filled message listing every item, quantity, line price, and the total — the customer just hits send.
- **Dine-in mode** — for people already sitting in the restaurant, meant to be reached by scanning the table QR code. In this mode there's no "add to order" button, no floating order bar, and no WhatsApp/call bar at the bottom — customers can only browse the menu with photos and descriptions, then tell their order to the waiter directly.

**How customers end up in each mode:**
- Anyone opening the plain menu link (e.g. shared on Instagram/Facebook, or typed in a browser) lands in **online mode** automatically.
- To put a **table's QR code** into dine-in mode automatically, add `?dinein=1` to the end of the URL you encode into that QR — for example:
  `https://www.rizwan-paratha.world/?dinein=1`
  Every table can use the exact same link with this one parameter added; you don't need a different link per table.
- Anyone can also switch manually at any time using the small button inside the banner at the top of the page ("Dining in with us right now?" / "Ordering from outside instead?") — useful if a walk-in customer wants to order for takeaway while sitting inside, or if someone scans a dine-in QR but actually wants to place a WhatsApp order instead.
- The chosen mode is remembered for that browser tab only (it resets next time they open the site fresh), so it never sticks incorrectly between visits.

## 4.7 Interactive sub-categories & admin reordering

- **Customer menu:** when a category has more than one section (e.g. Paratha → Cheese Paratha, Anda Wala Paratha, Chocolate Paratha, etc.), a row of tappable pills appears at the top of that category. Tapping "Chocolate Paratha" jumps straight to just that section; tapping "All" shows everything again.
- **Admin panel:** every category, section, and item in the menu list now has small ▲ / ▼ buttons to move it up or down relative to its siblings (item within its section, section within its category, category within the whole menu). This is how you set the order things appear in on the customer menu, and how you build out a new category/section structure (add a category, then add sections/groups inside it via the "Add a new item" form's "+ New category" / "+ New section" options, then reorder them here).

## 4.8 Renaming, deleting, and moving sections between categories

Every category, section, and item in the admin list now has extra controls next to the ▲▼ reorder buttons:

- **✎ Rename** — on a category, renames its label/title; on a section, renames its name; on an item, renames its English and/or Urdu name. Prices, availability, photos, and descriptions are untouched by a rename.
- **🗑 Delete** — on a category, removes it along with every section and item inside it. On a section, removes it along with every item inside it. Both ask for confirmation first and can't be undone.
- **⇄ Move to another category** (sections only) — swaps the section's header buttons for a small dropdown of every *other* category, plus ✓/✕ to confirm or cancel. This is how you re-home a section that's currently in the wrong place — for example, moving "Chai, Lassi & More" out from under **Cheese Paratha** into its own **Drinks** category: create the new category first (via "Add a new item" → "➕ New category…"), then use ⇄ on the section to send it there. Every item inside the section moves with it automatically; nothing needs to be re-added.

## 4.9 A friendlier customer menu

- **Search** — a search bar above the category list lets customers find a dish by English or Urdu name from anywhere, without hunting through categories first. Tapping a result jumps straight to that dish's category and opens its detail popup.
- **Section highlight while scrolling** — when a category has multiple sections and "All" is selected, the matching pill at the top softly highlights as the customer scrolls past that section, so it's always clear where they are.
- **Back to top** — a floating button appears once a customer has scrolled a little way down a category, for jumping back to the category list on long menus.

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
