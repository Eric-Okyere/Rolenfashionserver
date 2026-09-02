const express = require('express');
const ctrl = require('../controllers/settingsController');
const { protect, authorize } = require('../middleware/auth');
const { uploadImage } = require('../middleware/upload');

const router = express.Router();

router.get('/', ctrl.getSettings);
router.put('/', protect, authorize('admin'), ctrl.updateSettings);
router.post('/signature', protect, authorize('admin'), uploadImage.single('file'), ctrl.uploadSignature);
router.post('/logo', protect, authorize('admin'), uploadImage.single('file'), ctrl.uploadLogo);

module.exports = router;
