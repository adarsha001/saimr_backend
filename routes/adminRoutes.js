const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  getPendingProperties,
  approveProperty,
  rejectProperty,
  toggleFeatured,
  getPropertiesByStatus,
  getAllUsersWithLikes,
  getUserById,
  getAllProperties,
  updatePropertyOrder,
  bulkUpdateProperties,
  getPropertyStats,
  updateProperty,
  patchProperty,
  // Click Analytics Routes
  getClickAnalytics,
  getClickStatsByType,
  getPopularClicks,
  exportClickData,
  getClickTrends
} = require('../controllers/adminController');

// Only admins can access these
router.use(protect, authorize('admin')); 

// Property management routes
router.get('/properties/pending', getPendingProperties);
router.get('/properties', getPropertiesByStatus);
router.get('/properties/all', getAllProperties);
router.put('/properties/approve/:id', approveProperty);
router.put('/properties/reject/:id', rejectProperty);
router.put('/properties/feature/:id', toggleFeatured);
router.put('/properties/order/:id', updatePropertyOrder);
router.put('/properties/bulk-update', bulkUpdateProperties);
router.get('/properties/stats', getPropertyStats);
router.put('/properties/:id', updateProperty);
router.patch('/properties/:id', patchProperty);

// User management routes
router.get('/users', getAllUsersWithLikes);
router.get('/users/:id', getUserById);

// Click Analytics Routes
router.get('/analytics/clicks', getClickAnalytics);
router.get('/analytics/clicks/by-type', getClickStatsByType);
router.get('/analytics/clicks/popular', getPopularClicks);
router.get('/analytics/clicks/export', exportClickData);
router.get('/analytics/clicks/trends', getClickTrends);

module.exports = router;