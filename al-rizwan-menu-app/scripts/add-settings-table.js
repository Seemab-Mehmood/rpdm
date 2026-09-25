// Adds the `settings` table (opening hours, tagline, and the announcement
// banner/pop-up) to a database that was already seeded before this feature
// existed. Safe to run on a live database, and safe to re-run — it only
// creates the table and its single default row if they don't already exist;
// it never touches or deletes any existing data.
//
// Run once (or again, if you're not sure it already ran):   npm run add-settings-table

require('dotenv').config();
const pool = require('../db/pool');

const DEFAULT_HOURS = JSON.stringify(
  ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(day => ({
    day, mode: '24h', open: '09:00', close: '23:00',
  }))
);

async function run() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id                      INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        description             TEXT NOT NULL DEFAULT '',
        timezone                TEXT NOT NULL DEFAULT 'Asia/Karachi',
        hours                   JSONB NOT NULL DEFAULT '${DEFAULT_HOURS}'::jsonb,
        announcement_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
        banner_text             TEXT NOT NULL DEFAULT '',
        popup_title             TEXT NOT NULL DEFAULT '',
        popup_message           TEXT NOT NULL DEFAULT '',
        popup_cta_text          TEXT NOT NULL DEFAULT '',
        popup_cta_link          TEXT NOT NULL DEFAULT '',
        updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await client.query(`INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING`);
    await client.query(
      `INSERT INTO admin_log (message) VALUES ($1)`,
      ['Database updated to support site hours, the tagline, and the announcement banner/pop-up.']
    );
    console.log('✅ Done — settings table is ready. No existing data was touched.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
