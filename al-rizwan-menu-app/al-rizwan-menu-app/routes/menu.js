const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

// Used if the settings table hasn't been migrated in yet on an older
// database, so the customer page still loads (defaults to "open 24 hours",
// no announcement) instead of erroring.
const DEFAULT_SETTINGS = {
  description: '',
  timezone: 'Asia/Karachi',
  hours: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(day => ({
    day, mode: '24h', open: '09:00', close: '23:00',
  })),
  announcement_enabled: false,
  banner_text: '',
  popup_title: '',
  popup_message: '',
  popup_cta_text: '',
  popup_cta_link: '',
};

// GET /api/menu — public, no auth. Always reflects whatever is in the database,
// so every customer sees admin changes immediately on their next page load.
router.get('/menu', async (req, res) => {
  try {
    const { rows: categories } = await pool.query(
      'SELECT id, icon, label, title, description FROM categories ORDER BY sort_order'
    );
    const { rows: groups } = await pool.query(
      'SELECT id, category_id, name FROM groups ORDER BY category_id, sort_order'
    );
    const { rows: items } = await pool.query(
      'SELECT id, group_id, name, urdu, price, price2, available, thumb FROM items ORDER BY group_id, sort_order'
    );

    const groupsByCat = {};
    groups.forEach(g => {
      (groupsByCat[g.category_id] = groupsByCat[g.category_id] || []).push({ ...g, items: [] });
    });
    const itemsByGroup = {};
    items.forEach(it => {
      (itemsByGroup[it.group_id] = itemsByGroup[it.group_id] || []).push(it);
    });

    const payload = categories.map(cat => ({
      id: cat.id,
      icon: cat.icon,
      label: cat.label,
      title: cat.title,
      description: cat.description,
      groups: (groupsByCat[cat.id] || []).map(g => ({
        name: g.name,
        items: itemsByGroup[g.id] || [],
      })),
    }));

    res.json(payload);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load the menu right now.' });
  }
});

// GET /api/items/:id — public, no auth. Full detail for one dish (photos +
// description), fetched on demand when a customer taps an item, so the main
// /api/menu payload stays light even with photos on every dish.
router.get('/items/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, urdu, price, price2, available, description, images FROM items WHERE id = $1',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Item not found.' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load this item right now.' });
  }
});

// GET /api/settings — public, no auth. Powers the customer page's open/closed
// badge, tagline, and the announcement banner + promo pop-up.
router.get('/settings', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM settings WHERE id = 1');
    if (!rows.length) return res.json(DEFAULT_SETTINGS);
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    // If the settings table hasn't been migrated in yet, degrade gracefully
    // instead of breaking the whole menu page.
    res.json(DEFAULT_SETTINGS);
  }
});

module.exports = router;
