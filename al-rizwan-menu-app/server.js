require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');

const menuRoutes = require('./routes/menu');
const adminRoutes = require('./routes/admin');

const app = express();
// Default body-size limit (100kb) is too small once photos are involved —
// compressed dish photos are sent as base64 JSON, so raise the ceiling.
app.use(express.json({ limit: '15mb' }));
app.use(cookieParser());

// Customer-facing static files (menu page, css/js, images). This folder has
// NO reference to the admin page anywhere in it.
app.use(express.static(path.join(__dirname, 'public')));

// Public + admin APIs
app.use('/api', menuRoutes);
app.use('/api/admin', adminRoutes);

// The admin page is intentionally NOT inside /public and NOT linked from the
// customer page. It only exists at this one path, which you set yourself via
// the ADMIN_PATH environment variable (e.g. a random string like "kR9x2mQp").
const ADMIN_PATH = process.env.ADMIN_PATH || 'staff-portal';
app.get(`/${ADMIN_PATH}`, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'admin.html'));
});

// Safety net: if any route throws an error that wasn't caught locally,
// always send back a JSON error instead of letting the request hang with
// no response (which is what Express 4 does by default for async errors).
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Al-Rizwan menu app running on port ${PORT}`);
  console.log(`Admin page: /${ADMIN_PATH}  (keep this URL private — don't post it publicly)`);
});
