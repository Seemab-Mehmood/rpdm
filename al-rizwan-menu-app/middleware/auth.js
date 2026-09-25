const jwt = require('jsonwebtoken');

function requireAdmin(req, res, next) {
  const token = req.cookies && req.cookies.admin_session;
  if (!token) return res.status(401).json({ error: 'Not logged in.' });

  try {
    const payload = jwt.verify(token, process.env.SESSION_SECRET);
    if (payload.role !== 'admin') throw new Error('bad role');
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Session expired — please log in again.' });
  }
}

module.exports = { requireAdmin };
