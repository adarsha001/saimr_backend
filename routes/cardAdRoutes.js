// routes/cardAdRoutes.js
const express = require('express');
const router = express.Router();
const upload = require('../middlewares/multer'); // Your existing upload config
const {
  getSectionAds,
  getAllSections,
  createCardAd,
  updateCardAd,
  deleteCardAd,
  trackClick,
  trackView,
  updateSectionOrder,
  getSectionsList
} = require('../controllers/cardAdController');
const { protect, authorize } = require('../middleware/authMiddleware');

// ============ PUBLIC ROUTES ============
router.get('/sections', getAllSections);
router.get('/sections/list', getSectionsList);
router.get('/section/:section', getSectionAds);
router.post('/track-click/:id', trackClick);
router.post('/track-view/:id', trackView);

// ============ ADMIN ROUTES ============
router.post('/create', protect, authorize('admin', 'superadmin'), upload.single('image'), createCardAd);
router.put('/update/:id', protect, authorize('admin', 'superadmin'), upload.single('image'), updateCardAd);
router.delete('/delete/:id', protect, authorize('admin', 'superadmin'), deleteCardAd);
router.post('/update-order', protect, authorize('admin', 'superadmin'), updateSectionOrder);

module.exports = router;