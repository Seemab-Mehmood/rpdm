-- Run this once against your Neon database before seeding.
-- (The seed script also runs this automatically, so you usually don't
-- need to run it by hand — it's here for reference / manual setup.)

CREATE TABLE IF NOT EXISTS categories (
  id            TEXT PRIMARY KEY,
  icon          TEXT NOT NULL,
  label         TEXT NOT NULL,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL,
  sort_order    INT NOT NULL
);

CREATE TABLE IF NOT EXISTS groups (
  id            SERIAL PRIMARY KEY,
  category_id   TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  sort_order    INT NOT NULL
);

CREATE TABLE IF NOT EXISTS items (
  id            SERIAL PRIMARY KEY,
  group_id      INT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  urdu          TEXT NOT NULL DEFAULT '',
  price         INT NOT NULL,
  price2        INT,               -- optional "mug" price, NULL if item has one size only
  available     BOOLEAN NOT NULL DEFAULT TRUE,
  description   TEXT NOT NULL DEFAULT '',      -- up to ~200 words, shown in the dish detail popup
  images        TEXT[] NOT NULL DEFAULT '{}',  -- up to 3 compressed photos, stored as data URIs
  sort_order    INT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_log (
  id            SERIAL PRIMARY KEY,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  message       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_groups_category ON groups(category_id);
CREATE INDEX IF NOT EXISTS idx_items_group ON items(group_id);
