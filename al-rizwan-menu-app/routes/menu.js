const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

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
      'SELECT id, group_id, name, urdu, price, price2, available FROM items ORDER BY group_id, sort_order'
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

module.exports = router;
