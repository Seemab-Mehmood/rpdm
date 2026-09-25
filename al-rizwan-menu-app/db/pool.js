const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.warn('⚠️  DATABASE_URL is not set. Set it in your .env file or Render environment settings.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // required for Neon
});

module.exports = pool;
