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
  trackClick,
  getUserAnalytics, // ✅ NEW: Import the user analytics function
  getHourlyDistribution: getClickHourlyDistribution // ✅ NEW: Import with alias to avoid conflict
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

// ✅ ANALYTICS ROUTES - Complete set with user-focused analytics
router.get('/analytics/clicks', getClickAnalytics);
router.get('/analytics/clicks/by-type', getClickStatsByType);
router.get('/analytics/clicks/popular', getPopularClicks);
router.get('/analytics/clicks/trends', getClickTrends);
router.get('/analytics/clicks/raw', getRawClickData);
router.get('/analytics/clicks/sessions', getUserSessions);
router.get('/analytics/clicks/export', exportClickData);
router.post('/analytics/track', trackClick);

// ✅ NEW: User-focused analytics routes
router.get('/analytics/users', getUserAnalytics); // User-centric analytics
router.get('/analytics/clicks/hourly', getClickHourlyDistribution); // Hourly distribution with user data

// ✅ NEW: Enhanced analytics routes with user filtering
router.get('/analytics/clicks/user/:userId', getClickAnalytics); // Get analytics for specific user
router.get('/analytics/clicks/summary', getClickAnalytics); // Alternative summary endpoint

module.exports = router;