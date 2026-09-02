const express = require('express');
const ctrl = require('../controllers/activityController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Admin/staff only — this is an internal operations feed, not public data.
router.get('/', protect, authorize('admin', 'staff'), ctrl.listActivity);

module.exports = router;
