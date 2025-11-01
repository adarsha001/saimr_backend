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
  getHourlyDistribution,
} = require('../controllers/adminController');
const {
  getClickAnalytics,
  getClickStatsByType,
  getPopularClicks,
  exportClickData,
  getClickTrends,
  getRawClickData,
  getUserSessions,
  trackClick // Make sure this is imported
} = require('../controllers/clickController');

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

// ✅ CORRECTED: Click Analytics Routes - Direct paths (no /analytics prefix)
router.get('/analytics/clicks', getClickAnalytics);
router.get('/analytics/clicks/by-type', getClickStatsByType);
router.get('/analytics/clicks/popular', getPopularClicks);
router.get('/analytics/clicks/trends', getClickTrends);
router.get('/analytics/clicks/raw', getRawClickData);
router.get('/analytics/clicks/sessions', getUserSessions);
router.get('/analytics/clicks/export', exportClickData);
router.post('/analytics/track', trackClick); // Add track route
// Add this route to your existing routes
router.get('/analytics/clicks/hourly', getHourlyDistribution);;
module.exports = router;