require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');

const menuRoutes = require('./routes/menu');
const adminRoutes = require('./routes/admin');

const app = express();
app.use(express.json());
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Al-Rizwan menu app running on port ${PORT}`);
  console.log(`Admin page: /${ADMIN_PATH}  (keep this URL private — don't post it publicly)`);
});
