const User = require('../models/User');
const { generateToken, setAuthCookie } = require('../utils/generateToken');
const logActivity = require('../utils/activityLog');

// POST /api/auth/login  (admin/staff only — students don't have accounts, they track by application number)
async function login(req, res) {
  const { email, password } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

  if (!user || !user.active || !(await user.comparePassword(password))) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });

  const token = generateToken(user);
  setAuthCookie(res, token);

  await logActivity({ type: 'user.login', summary: `${user.name} logged in`, actor: user });

  res.json({
    user: { id: user._id, name: user.name, email: user.email, role: user.role, isCEO: user.isCEO },
  });
}

// POST /api/auth/logout
function logout(req, res) {
  res.clearCookie('token', { path: '/' });
  res.json({ message: 'Logged out.' });
}

// GET /api/auth/me
function me(req, res) {
  const { _id, name, email, role, isCEO } = req.user;
  res.json({ user: { id: _id, name, email, role, isCEO } });
}

// PATCH /api/auth/password — change own password
async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.comparePassword(currentPassword))) {
    return res.status(400).json({ message: 'Current password is incorrect.' });
  }
  user.password = newPassword;
  await user.save();
  res.json({ message: 'Password updated.' });
}

module.exports = { login, logout, me, changePassword };
