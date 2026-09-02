const User = require('../models/User');
const logActivity = require('../utils/activityLog');

// GET /api/users (admin only) — manage staff/admin accounts
async function listUsers(req, res) {
  const users = await User.find().select('-password').sort({ createdAt: -1 });
  res.json({ users });
}

// POST /api/users (admin only)
async function createUser(req, res) {
  const user = await User.create(req.body);
  await logActivity({
    type: 'user.created',
    summary: `${req.user.name} created a staff account for ${user.name} (${user.role})`,
    meta: { userId: user._id, role: user.role },
    actor: req.user,
  });
  res.status(201).json({ user: { id: user._id, name: user.name, email: user.email, role: user.role } });
}

// PATCH /api/users/:id (admin only) — e.g. deactivate, change role, mark as CEO
async function updateUser(req, res) {
  const updates = { ...req.body };
  delete updates.password; // password changes go through /auth/password
  if (updates.isCEO) {
    // Only one CEO at a time — clear the flag from everyone else
    await User.updateMany({ _id: { $ne: req.params.id } }, { isCEO: false });
  }
  const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true }).select('-password');
  if (!user) return res.status(404).json({ message: 'User not found.' });
  res.json({ user });
}

module.exports = { listUsers, createUser, updateUser };
