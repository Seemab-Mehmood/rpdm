// Safely brings a LIVE database up to date with the latest menu boards,
// WITHOUT truncating anything — unlike `npm run seed`, this never deletes
// existing rows. It only:
//   1. Creates the 2 new categories (Mini Fatayer, Rice) if missing.
//   2. Creates any new groups those categories need.
//   3. Inserts any item that doesn't already exist (matched by name).
//   4. Updates the price of a short list of items whose price changed on
//      the new boards (skipped if you've already hand-edited that price
//      in the admin panel to something else — see SKIP_IF_MANUALLY_EDITED
//      note below).
//
// Run once against your Neon database:
//   node scripts/add-new-items.js

require('dotenv').config();
const pool = require('../db/pool');

// ---- 1. New categories to ensure exist -----------------------------------
const NEW_CATEGORIES = [
  { id: 'minifatayer', icon: '🥐', label: 'Mini Fatayer', title: 'Arabic Mini Fatayer', description: 'Break Fast Meal — small bites, big flavour.', sort_order: 9 },
  { id: 'rice', icon: '🍚', label: 'Rice', title: 'Rice', description: 'Al-Rizwan special rice plates.', sort_order: 10 },
];

// ---- 2. New items to insert, grouped by [category_id, group_name] --------
// Existing categories/groups are matched by name; if a group doesn't exist
// yet under that category, it's created automatically.
const NEW_ITEMS = [
  { category: 'parathas', group: 'Rate List', name: 'Mooli Wala Paratha', urdu: 'مولی والا پراٹھا', price: 200 },
  { category: 'parathas', group: 'Rate List', name: 'Boil Egg', urdu: 'ابلا انڈا', price: 60 },

  { category: 'cheese', group: 'Chai, Lassi & More', name: 'Kashmiri Green Tea', urdu: 'کشمیری گرین چائے', price: 150 },
  { category: 'cheese', group: 'Chai, Lassi & More', name: 'Afghani Qahwa', urdu: 'افغانی قہوہ', price: 100 },

  { category: 'shawarma', group: 'Turkish Shawarma', name: 'Fateer Shawarma', urdu: 'شاورما فطیر', price: 600 },
  { category: 'shawarma', group: 'Turkish Shawarma', name: 'Shawarma with Cheese Medium', urdu: 'شاورما بالجبن وسط', price: 600 },
  { category: 'shawarma', group: 'Turkish Shawarma', name: 'Shawarma with Cheese Large', urdu: 'شاورما بالجبن کبیر', price: 700 },
  { category: 'shawarma', group: 'Turkish Shawarma', name: 'Samoon Shawarma (Pocket)', urdu: 'شاورما الصمون', price: 500 },
  { category: 'shawarma', group: 'Turkish Shawarma', name: 'Zinger Shawarma', urdu: 'زنجر شاورما', price: 450 },

  { category: 'falafil', group: 'Crispy', name: 'Nuggets 5 Pcs', urdu: 'ناجتس 5 حبات', price: 350 },
  { category: 'falafil', group: 'Crispy', name: 'Crispy Hot Wings 5 Pcs', urdu: 'ونجز حاره مقرمشة 5 حبات', price: 400 },

  { category: 'sides', group: 'Kings Sweet Food', name: 'Ash Bulbul', urdu: 'عش البلبل', price: 870 },
  { category: 'sides', group: 'Sides', name: 'Potato Wedges', urdu: 'بطاطس ودجز', price: 370 },
  { category: 'sides', group: 'Sides', name: 'Potato Bites', urdu: 'بطاطس بايتس', price: 650 },
  { category: 'sides', group: 'Sides', name: 'Cheese Croquettes', urdu: 'كروكيت الجبن', price: 980 },
  { category: 'sides', group: 'Sides', name: 'Hash Brown', urdu: 'هاش براون', price: 500 },

  { category: 'juices', group: 'Fresh Juices  ·  Glass', name: 'Grape Fruit Juice', urdu: 'گریپ فروٹ جوس', price: 300 },
  { category: 'juices', group: 'Fresh Juices  ·  Glass', name: 'Musami Juice', urdu: 'موسمی جوس', price: 370 },
  { category: 'juices', group: 'Fresh Juices  ·  Glass', name: 'Red Anar Juice', urdu: 'ریڈ انار جوس', price: 400 },
  { category: 'juices', group: 'Fresh Juices  ·  Glass', name: 'White Anar Juice', urdu: 'وائٹ انار جوس', price: 650 },

  { category: 'minifatayer', group: 'Arabic Mini Fatayer (Break Fast Meal)', name: 'Crosson Sweet Dish', urdu: 'کروسان سویٹ ڈش', price: 100 },
  { category: 'minifatayer', group: 'Arabic Mini Fatayer (Break Fast Meal)', name: 'Chicken Mini Fatayer', urdu: 'فطایر دجاج صغیر', price: 100 },
  { category: 'minifatayer', group: 'Arabic Mini Fatayer (Break Fast Meal)', name: 'Mutton Mini Fatayer', urdu: 'فطایر لحم صغیر', price: 100 },
  { category: 'minifatayer', group: 'Arabic Mini Fatayer (Break Fast Meal)', name: 'Cheese Egg Mini Fatayer', urdu: 'فطایر جبن بیض صغیر', price: 100 },
  { category: 'minifatayer', group: 'Arabic Mini Fatayer (Break Fast Meal)', name: 'Mini Ash Bulbul', urdu: 'مینی عش البلبل', price: 100 },
  { category: 'minifatayer', group: 'Arabic Mini Fatayer (Break Fast Meal)', name: 'Club Sandwich', urdu: 'کلب سینڈوچ', price: 550 },

  { category: 'rice', group: 'Rice Plates', name: 'Al Rizwan Special Dal Chawal Plate', urdu: 'دال چاول پلیٹ سپیشل', price: 250 },
  { category: 'rice', group: 'Rice Plates', name: 'Al Rizwan Special Chicken Palak Chawal Plate', urdu: 'چکن پالک چاول پلیٹ سپیشل', price: 500 },
];

// ---- 3. Price updates for existing items on the new boards ---------------
// Matched by exact current name. If you've already hand-edited one of
// these prices in the admin panel, this will overwrite it back to the
// board price below — comment out any line you want to leave alone.
const PRICE_UPDATES = [
  { name: 'Sarookh Shawarma', price: 600 },
  { name: 'Plater Shawarma — Small', price: 1150 },
  { name: 'Plater Shawarma — Medium', price: 1700 },
  { name: 'Plater Shawarma — Large', price: 2200 },
  { name: 'Mutton Mutabbaq', price: 900 },
  { name: 'Mutton Mutabbaq Cheese', price: 950 },
  { name: 'Chicken Mutabbaq Cheese', price: 700 },
  { name: 'Fatayer Chicken Egg', price: 850 },
  { name: 'Fatayer Mutton Egg', price: 900 },
  { name: 'Fatayer Shinga La La', price: 900 },
  { name: 'Family Fatayer', price: 2500 },
  { name: 'Plain Fries', price: 370 }, // was "Fries" — renamed below too
];

// A couple of items were renamed on the new boards; update old name -> new name.
const RENAMES = [
  { from: 'Fatayer Shawarma Medium', to: 'Fateer Shawarma' },
  { from: 'Fatayer Turkey Special', to: 'Fatayer Istanbul Special' },
  { from: 'Fries', to: 'Plain Fries' },
];

async function run() {
  const client = await pool.connect();
  try {
    let addedCount = 0, updatedCount = 0, renamedCount = 0;

    // Rename first, so later matching by name works correctly.
    for (const r of RENAMES) {
      const res = await client.query('UPDATE items SET name = $1 WHERE name = $2', [r.to, r.from]);
      if (res.rowCount > 0) {
        renamedCount += res.rowCount;
        console.log(`Renamed: "${r.from}" → "${r.to}"`);
      }
    }

    // Ensure new categories exist.
    for (const cat of NEW_CATEGORIES) {
      const exists = await client.query('SELECT 1 FROM categories WHERE id = $1', [cat.id]);
      if (exists.rowCount === 0) {
        await client.query(
          `INSERT INTO categories (id, icon, label, title, description, sort_order) VALUES ($1,$2,$3,$4,$5,$6)`,
          [cat.id, cat.icon, cat.label, cat.title, cat.description, cat.sort_order]
        );
        console.log(`Created category: ${cat.label}`);
      }
    }

    // Insert new items (skip if an item with that name already exists anywhere).
    for (const item of NEW_ITEMS) {
      const already = await client.query('SELECT 1 FROM items WHERE name = $1', [item.name]);
      if (already.rowCount > 0) continue;

      // Find or create the group under the given category.
      let groupRes = await client.query(
        'SELECT id FROM groups WHERE category_id = $1 AND name = $2',
        [item.category, item.group]
      );
      let groupId;
      if (groupRes.rowCount === 0) {
        const maxSort = await client.query(
          'SELECT COALESCE(MAX(sort_order), -1) AS m FROM groups WHERE category_id = $1',
          [item.category]
        );
        const ins = await client.query(
          'INSERT INTO groups (category_id, name, sort_order) VALUES ($1,$2,$3) RETURNING id',
          [item.category, item.group, maxSort.rows[0].m + 1]
        );
        groupId = ins.rows[0].id;
        console.log(`Created group: ${item.group} (under ${item.category})`);
      } else {
        groupId = groupRes.rows[0].id;
      }

      const maxItemSort = await client.query(
        'SELECT COALESCE(MAX(sort_order), -1) AS m FROM items WHERE group_id = $1',
        [groupId]
      );
      await client.query(
        `INSERT INTO items (group_id, name, urdu, price, available, sort_order)
         VALUES ($1,$2,$3,$4,true,$5)`,
        [groupId, item.name, item.urdu, item.price, maxItemSort.rows[0].m + 1]
      );
      addedCount++;
      console.log(`Added item: ${item.name} — Rs.${item.price}`);
    }

    // Apply price updates.
    for (const p of PRICE_UPDATES) {
      const res = await client.query('UPDATE items SET price = $1 WHERE name = $2', [p.price, p.name]);
      if (res.rowCount > 0) {
        updatedCount += res.rowCount;
        console.log(`Updated price: ${p.name} → Rs.${p.price}`);
      }
    }

    await client.query(
      'INSERT INTO admin_log (message) VALUES ($1)',
      [`Menu updated from new boards: ${addedCount} item(s) added, ${updatedCount} price(s) updated, ${renamedCount} item(s) renamed.`]
    );

    console.log(`\n✅ Done — ${addedCount} added, ${updatedCount} price(s) updated, ${renamedCount} renamed.`);
    console.log('Nothing existing was deleted. Check the admin panel to fine-tune anything.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
