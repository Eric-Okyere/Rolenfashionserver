const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Attaches req.user if a valid session is present, but never blocks the request.
async function optionalAuth(req, res, next) {
  try {
    const token = req.cookies?.token;
    if (!token) return next();
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (user && user.active) req.user = user;
  } catch (e) {
    // ignore invalid/expired token for optional auth
  }
  next();
}

module.exports = { optionalAuth };
