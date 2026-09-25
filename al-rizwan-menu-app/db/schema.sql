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
  thumb         TEXT,                          -- small copy of the first photo, shown on the main menu list
  sort_order    INT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_log (
  id            SERIAL PRIMARY KEY,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  message       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_groups_category ON groups(category_id);
CREATE INDEX IF NOT EXISTS idx_items_group ON items(group_id);

-- Single-row table holding site-wide settings: opening hours, the tagline
-- shown under the restaurant name, and the announcement banner/pop-up used
-- for discount promos. Always has exactly one row (id = 1).
CREATE TABLE IF NOT EXISTS settings (
  id                      INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  description             TEXT NOT NULL DEFAULT '',
  timezone                TEXT NOT NULL DEFAULT 'Asia/Karachi',
  hours                   JSONB NOT NULL DEFAULT '[
    {"day":"mon","mode":"24h","open":"09:00","close":"23:00"},
    {"day":"tue","mode":"24h","open":"09:00","close":"23:00"},
    {"day":"wed","mode":"24h","open":"09:00","close":"23:00"},
    {"day":"thu","mode":"24h","open":"09:00","close":"23:00"},
    {"day":"fri","mode":"24h","open":"09:00","close":"23:00"},
    {"day":"sat","mode":"24h","open":"09:00","close":"23:00"},
    {"day":"sun","mode":"24h","open":"09:00","close":"23:00"}
  ]'::jsonb,
  announcement_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
  banner_text             TEXT NOT NULL DEFAULT '',
  popup_title             TEXT NOT NULL DEFAULT '',
  popup_message           TEXT NOT NULL DEFAULT '',
  popup_cta_text          TEXT NOT NULL DEFAULT '',
  popup_cta_link          TEXT NOT NULL DEFAULT '',
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
