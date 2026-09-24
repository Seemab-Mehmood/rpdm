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
  try {
    const { rows } = await pool.query(`
      SELECT items.id, items.name, items.urdu, items.price, items.price2, items.available,
             items.group_id, groups.name AS group_name, groups.category_id,
             categories.label AS category_label, categories.icon AS category_icon
      FROM items
      JOIN groups ON groups.id = items.group_id
      JOIN categories ON categories.id = groups.category_id
      ORDER BY categories.sort_order, groups.sort_order, items.sort_order
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load the menu.' });
  }
});

// POST /api/admin/categories/:id/move  { direction: 'up' | 'down' }
// POST /api/admin/groups/:id/move      { direction: 'up' | 'down' }
// POST /api/admin/items/:id/move       { direction: 'up' | 'down' }
// Each swaps sort_order with its nearest sibling in that direction, within
// the same parent (groups within a category, items within a group). Used
// by the admin panel's ▲▼ reorder buttons.
function makeMoveHandler({ table, idType, parentColumn }) {
  return async (req, res) => {
    const id = idType === 'int' ? Number(req.params.id) : req.params.id;
    const { direction } = req.body || {};
    if (!['up', 'down'].includes(direction)) {
      return res.status(400).json({ error: 'direction must be "up" or "down".' });
    }
    try {
      const { rows: current } = await pool.query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
      if (!current.length) return res.status(404).json({ error: 'Not found.' });
      const row = current[0];

      const cmp = direction === 'up' ? '<' : '>';
      const order = direction === 'up' ? 'DESC' : 'ASC';
      const parentClause = parentColumn ? `${parentColumn} = $3 AND` : '';
      const params = parentColumn ? [id, row.sort_order, row[parentColumn]] : [id, row.sort_order];
      const { rows: neighborRows } = await pool.query(
        `SELECT * FROM ${table} WHERE ${parentClause} sort_order ${cmp} $2 AND id != $1 ORDER BY sort_order ${order} LIMIT 1`,
        params
      );
      if (!neighborRows.length) return res.json({ ok: true, moved: false });
      const neighbor = neighborRows[0];

      await pool.query(`UPDATE ${table} SET sort_order = $1 WHERE id = $2`, [neighbor.sort_order, row.id]);
      await pool.query(`UPDATE ${table} SET sort_order = $1 WHERE id = $2`, [row.sort_order, neighbor.id]);
      res.json({ ok: true, moved: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Could not reorder — please try again.' });
    }
  };
}
router.post('/categories/:id/move', requireAdmin, makeMoveHandler({ table: 'categories', idType: 'text', parentColumn: null }));
router.post('/groups/:id/move', requireAdmin, makeMoveHandler({ table: 'groups', idType: 'int', parentColumn: 'category_id' }));
router.post('/items/:id/move', requireAdmin, makeMoveHandler({ table: 'items', idType: 'int', parentColumn: 'group_id' }));

// GET /api/admin/structure — categories + their groups, for the "add new item" form
router.get('/structure', requireAdmin, async (req, res) => {
  try {
    const { rows: categories } = await pool.query(
      'SELECT id, icon, label FROM categories ORDER BY sort_order'
    );
    const { rows: groups } = await pool.query(
      'SELECT id, category_id, name FROM groups ORDER BY category_id, sort_order'
    );
    const payload = categories.map(cat => ({
      ...cat,
      groups: groups.filter(g => g.category_id === cat.id).map(g => ({ id: g.id, name: g.name })),
    }));
    res.json(payload);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load categories/sections.' });
  }
});

// POST /api/admin/categories  { id, icon, label, title, description }
router.post('/categories', requireAdmin, async (req, res) => {
  const { id, icon, label, title, description } = req.body || {};
  if (!id || !icon || !label) return res.status(400).json({ error: 'Category id, icon, and label are required.' });

  try {
    const maxSort = await pool.query('SELECT COALESCE(MAX(sort_order), 0) AS m FROM categories');
    await pool.query(
      `INSERT INTO categories (id, icon, label, title, description, sort_order) VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, icon, label, title || label, description || '', maxSort.rows[0].m + 1]
    );
    await addLog(`New category added: ${icon} ${label}`);
    res.json({ ok: true, id });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'A category with that ID already exists — try a different name.' });
    console.error(err);
    res.status(500).json({ error: 'Could not create the category.' });
  }
});

// PATCH /api/admin/categories/:id  { icon, label, title, description }
// Renames a category (and/or its icon/subtitle/description).
router.patch('/categories/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { icon, label, title, description } = req.body || {};
  try {
    const { rows: before } = await pool.query('SELECT * FROM categories WHERE id = $1', [id]);
    if (!before.length) return res.status(404).json({ error: 'Category not found.' });
    const cat = before[0];

    const newIcon = icon !== undefined && icon.trim() ? icon.trim() : cat.icon;
    const newLabel = label !== undefined && label.trim() ? label.trim() : cat.label;
    const newTitle = title !== undefined && title.trim() ? title.trim() : cat.title;
    const newDescription = description !== undefined ? description : cat.description;

    await pool.query(
      'UPDATE categories SET icon = $1, label = $2, title = $3, description = $4 WHERE id = $5',
      [newIcon, newLabel, newTitle, newDescription, id]
    );

    if (newLabel !== cat.label) await addLog(`Category renamed: "${cat.label}" → "${newLabel}"`);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update this category.' });
  }
});

// DELETE /api/admin/categories/:id
// Also removes every section and item inside it (the DB foreign keys cascade).
router.delete('/categories/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query('SELECT label FROM categories WHERE id = $1', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Category not found.' });

    await pool.query('DELETE FROM categories WHERE id = $1', [id]);
    await addLog(`Category removed: ${rows[0].label} (and everything inside it)`);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not delete this category — please try again.' });
  }
});

// POST /api/admin/groups  { category_id, name }
router.post('/groups', requireAdmin, async (req, res) => {
  const { category_id, name } = req.body || {};
  if (!category_id || !name) return res.status(400).json({ error: 'category_id and name are required.' });

  try {
    const cat = await pool.query('SELECT label FROM categories WHERE id = $1', [category_id]);
    if (!cat.rowCount) return res.status(404).json({ error: 'Category not found.' });

    const maxSort = await pool.query('SELECT COALESCE(MAX(sort_order), -1) AS m FROM groups WHERE category_id = $1', [category_id]);
    const { rows } = await pool.query(
      'INSERT INTO groups (category_id, name, sort_order) VALUES ($1,$2,$3) RETURNING id',
      [category_id, name, maxSort.rows[0].m + 1]
    );
    await addLog(`New section added: "${name}" under ${cat.rows[0].label}`);
    res.json({ ok: true, id: rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not create the section.' });
  }
});

// PATCH /api/admin/groups/:id  { name, category_id }
// Renames a section, and/or moves it to sit under a different main category —
// e.g. moving "Chai, Lassi & More" out from under Cheese Paratha into a
// separate Drinks category. Moving a section takes every item inside it
// along with it and drops it at the end of the target category.
router.patch('/groups/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { name, category_id } = req.body || {};
  try {
    const { rows: before } = await pool.query('SELECT * FROM groups WHERE id = $1', [id]);
    if (!before.length) return res.status(404).json({ error: 'Section not found.' });
    const group = before[0];

    let newCategoryId = group.category_id;
    let newSortOrder = group.sort_order;
    let oldCatLabel = null, newCatLabel = null;

    if (category_id !== undefined && category_id !== group.category_id) {
      const targetCat = await pool.query('SELECT label FROM categories WHERE id = $1', [category_id]);
      if (!targetCat.rowCount) return res.status(404).json({ error: 'Target category not found.' });
      const currentCat = await pool.query('SELECT label FROM categories WHERE id = $1', [group.category_id]);
      const maxSort = await pool.query('SELECT COALESCE(MAX(sort_order), -1) AS m FROM groups WHERE category_id = $1', [category_id]);
      newCategoryId = category_id;
      newSortOrder = maxSort.rows[0].m + 1;
      oldCatLabel = currentCat.rows[0]?.label || group.category_id;
      newCatLabel = targetCat.rows[0].label;
    }

    const newName = name !== undefined && name.trim() ? name.trim() : group.name;

    await pool.query(
      'UPDATE groups SET name = $1, category_id = $2, sort_order = $3 WHERE id = $4',
      [newName, newCategoryId, newSortOrder, id]
    );

    if (newCatLabel) {
      await addLog(`Section "${newName}" moved: ${oldCatLabel} → ${newCatLabel}`);
    } else if (newName !== group.name) {
      await addLog(`Section renamed: "${group.name}" → "${newName}"`);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update this section.' });
  }
});

// DELETE /api/admin/groups/:id
// Also removes every item inside it (the DB foreign keys cascade).
router.delete('/groups/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  try {
    const { rows } = await pool.query('SELECT name FROM groups WHERE id = $1', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Section not found.' });

    await pool.query('DELETE FROM groups WHERE id = $1', [id]);
    await addLog(`Section removed: ${rows[0].name} (and every item inside it)`);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not delete this section — please try again.' });
  }
});

// GET /api/admin/items/:id/media — description + photos for one item.
// Kept separate from the main /items list so that list stays fast to load
// even with 100+ items (photos are only fetched when an admin expands one).
router.get('/items/:id/media', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT description, images FROM items WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Item not found.' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    // Most common cause: the `description`/`images` columns don't exist yet on
    // this database — run `npm run add-media-columns` once against it.
    res.status(500).json({ error: 'Could not load photos for this item. If this keeps happening, the database may need the add-media-columns migration run.' });
  }
});

// POST /api/admin/items  { group_id, name, urdu, price, price2, available, description, images, thumb }
router.post('/items', requireAdmin, async (req, res) => {
  const { group_id, name, urdu, price, price2, available, description, images, thumb } = req.body || {};
  if (!group_id || !name || price === undefined || price === '') {
    return res.status(400).json({ error: 'group_id, name, and price are required.' });
  }
  if (Array.isArray(images) && images.length > 3) {
    return res.status(400).json({ error: 'A dish can have at most 3 photos.' });
  }

  try {
    const grp = await pool.query('SELECT name FROM groups WHERE id = $1', [group_id]);
    if (!grp.rowCount) return res.status(404).json({ error: 'Section not found.' });

    const maxSort = await pool.query('SELECT COALESCE(MAX(sort_order), -1) AS m FROM items WHERE group_id = $1', [group_id]);
    const { rows } = await pool.query(
      `INSERT INTO items (group_id, name, urdu, price, price2, available, description, images, thumb, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [
        group_id, name, urdu || '', Number(price), price2 ? Number(price2) : null, available !== false,
        description || '', Array.isArray(images) ? images : [], thumb || null, maxSort.rows[0].m + 1,
      ]
    );
    await addLog(`New item added: ${name} — Rs.${price}${price2 ? ' / Rs.'+price2+' (mug)' : ''}`);
    res.json({ ok: true, id: rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not add the item. If this keeps happening, the database may need the add-media-columns migration run.' });
  }
});

// DELETE /api/admin/items/:id
router.delete('/items/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query('SELECT name FROM items WHERE id = $1', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Item not found.' });

    await pool.query('DELETE FROM items WHERE id = $1', [id]);
    await addLog(`Item removed: ${rows[0].name}`);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not delete this item.' });
  }
});

// PATCH /api/admin/items/:id  { name, urdu, price, price2, available, description, images, thumb }
router.patch('/items/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, urdu, price, price2, available, description, images, thumb } = req.body || {};
  if (images !== undefined && (!Array.isArray(images) || images.length > 3)) {
    return res.status(400).json({ error: 'A dish can have at most 3 photos.' });
  }

  try {
    const { rows: before } = await pool.query('SELECT * FROM items WHERE id = $1', [id]);
    if (!before.length) return res.status(404).json({ error: 'Item not found.' });
    const item = before[0];

    const newName = name !== undefined && name.trim() ? name.trim() : item.name;
    const newUrdu = urdu !== undefined ? urdu : item.urdu;
    const newPrice = price !== undefined ? Number(price) : item.price;
    const newPrice2 = price2 !== undefined ? (price2 === null ? null : Number(price2)) : item.price2;
    const newAvailable = available !== undefined ? Boolean(available) : item.available;
    const newDescription = description !== undefined ? description : item.description;
    const newImages = images !== undefined ? images : item.images;
    // thumb tracks the main-menu-list preview. Once images are sent, always
    // resync thumb to whatever the client computed for it (null when the
    // dish has no photos left), so a removed photo also clears the list
    // preview instead of leaving a stale thumbnail behind.
    const newThumb = images !== undefined ? (thumb || null) : item.thumb;

    await pool.query(
      'UPDATE items SET name = $1, urdu = $2, price = $3, price2 = $4, available = $5, description = $6, images = $7, thumb = $8 WHERE id = $9',
      [newName, newUrdu, newPrice, newPrice2, newAvailable, newDescription, newImages, newThumb, id]
    );

    const messages = [];
    if (newName !== item.name) messages.push(`Item renamed: "${item.name}" → "${newName}"`);
    if (newPrice !== item.price) messages.push(`${newName} price changed Rs.${item.price} → Rs.${newPrice}`);
    if (newPrice2 !== item.price2) messages.push(`${newName} mug price changed to Rs.${newPrice2}`);
    if (newAvailable !== item.available) {
      messages.push(`${newName} marked ${newAvailable ? 'back in stock' : 'sold out / coming back soon'}`);
    }
    if (description !== undefined && description !== item.description) messages.push(`${newName} description updated`);
    if (images !== undefined && JSON.stringify(images) !== JSON.stringify(item.images)) {
      messages.push(`${newName} photos updated (${images.length} photo${images.length === 1 ? '' : 's'})`);
    }
    for (const m of messages) await addLog(m);

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not save that change. If this keeps happening, the database may need the add-media-columns migration run.' });
  }
});

// GET /api/admin/log — recent changes, newest first
router.get('/log', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT created_at, message FROM admin_log ORDER BY created_at DESC LIMIT 100'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load the change log.' });
  }
});

module.exports = router;
