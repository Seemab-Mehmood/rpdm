const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const pool = require('../db/pool');
const { requireAdmin } = require('../middleware/auth');

const SESSION_HOURS = Number(process.env.SESSION_HOURS || 8);

async function addLog(message) {
  await pool.query('INSERT INTO admin_log (message) VALUES ($1)', [message]);
}

// POST /api/admin/login  { password }
// Checked entirely on the server against ADMIN_PASSWORD (an env var on Render) —
// the real password never ships in any file sent to the browser.
router.post('/login', (req, res) => {
  const { password } = req.body || {};
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Incorrect password.' });
  }

  const token = jwt.sign({ role: 'admin' }, process.env.SESSION_SECRET, {
    expiresIn: `${SESSION_HOURS}h`,
  });

  res.cookie('admin_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_HOURS * 60 * 60 * 1000,
  });

  addLog('Staff logged in to the admin panel.').catch(console.error);
  res.json({ ok: true });
});

router.post('/logout', requireAdmin, (req, res) => {
  res.clearCookie('admin_session');
  res.json({ ok: true });
});

router.get('/session', (req, res) => {
  const token = req.cookies && req.cookies.admin_session;
  if (!token) return res.json({ loggedIn: false });
  try {
    jwt.verify(token, process.env.SESSION_SECRET);
    res.json({ loggedIn: true });
  } catch {
    res.json({ loggedIn: false });
  }
});

// GET /api/admin/items — full item list with category/group context, for editing
router.get('/items', requireAdmin, async (req, res) => {
  const { rows } = await pool.query(`
    SELECT items.id, items.name, items.urdu, items.price, items.price2, items.available,
           groups.name AS group_name, categories.label AS category_label, categories.icon AS category_icon
    FROM items
    JOIN groups ON groups.id = items.group_id
    JOIN categories ON categories.id = groups.category_id
    ORDER BY categories.sort_order, groups.sort_order, items.sort_order
  `);
  res.json(rows);
});

// PATCH /api/admin/items/:id  { price, price2, available }
router.patch('/items/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { price, price2, available } = req.body || {};

  const { rows: before } = await pool.query('SELECT * FROM items WHERE id = $1', [id]);
  if (!before.length) return res.status(404).json({ error: 'Item not found.' });
  const item = before[0];

  const newPrice = price !== undefined ? Number(price) : item.price;
  const newPrice2 = price2 !== undefined ? (price2 === null ? null : Number(price2)) : item.price2;
  const newAvailable = available !== undefined ? Boolean(available) : item.available;

  await pool.query(
    'UPDATE items SET price = $1, price2 = $2, available = $3 WHERE id = $4',
    [newPrice, newPrice2, newAvailable, id]
  );

  const messages = [];
  if (newPrice !== item.price) messages.push(`${item.name} price changed Rs.${item.price} → Rs.${newPrice}`);
  if (newPrice2 !== item.price2) messages.push(`${item.name} mug price changed to Rs.${newPrice2}`);
  if (newAvailable !== item.available) {
    messages.push(`${item.name} marked ${newAvailable ? 'back in stock' : 'sold out / coming back soon'}`);
  }
  for (const m of messages) await addLog(m);

  res.json({ ok: true });
});

// GET /api/admin/log — recent changes, newest first
router.get('/log', requireAdmin, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT created_at, message FROM admin_log ORDER BY created_at DESC LIMIT 100'
  );
  res.json(rows);
});

module.exports = router;
