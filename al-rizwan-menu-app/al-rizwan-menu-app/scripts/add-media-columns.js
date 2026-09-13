// Adds the new `description` and `images` columns to the items table on a
// database that was already seeded before this feature existed.
// Completely safe to run on a live database — it only ADDS columns with
// defaults, never touches or deletes any existing rows.
//
// Run once:   npm run add-media-columns

require('dotenv').config();
const pool = require('../db/pool');

async function run() {
  const client = await pool.connect();
  try {
    await client.query(`ALTER TABLE items ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT ''`);
    await client.query(`ALTER TABLE items ADD COLUMN IF NOT EXISTS images TEXT[] NOT NULL DEFAULT '{}'`);
    await client.query(
      `INSERT INTO admin_log (message) VALUES ($1)`,
      ['Database updated to support dish photos and descriptions.']
    );
    console.log('✅ Done — items table now supports photos and descriptions. No existing data was touched.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
