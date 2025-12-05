// routes/adminRoutes.js
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
  getPropertyById,
  getWebsiteUserStats,
  getUsersByWebsite,
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
  getUserAnalytics,
  getHourlyDistribution: getClickHourlyDistribution
} = require('../controllers/clickController');

// Import enquiry controller
const {
  getAllEnquiries,
  getEnquiryById,
  updateEnquiryStatus,
  addEnquiryNotes,
  deleteEnquiry,
  bulkUpdateEnquiries,
  getEnquiryStats,
  exportEnquiries,
  getEnquiriesByUserId
} = require('../controllers/enquiryController');
const upload = require('../middlewares/multer');
const { assignPropertiesToWebsites, getPropertiesForAdmin } = require('../controllers/propertyController');


// Only admins can access these
router.use(protect, authorize('admin')); 

// ==================== ENQUIRY MANAGEMENT ROUTES ====================

// Get all enquiries with pagination and filters
router.get('/enquiries', getAllEnquiries);

// Get enquiry by ID
router.get('/enquiries/:id', getEnquiryById);

// Update enquiry status
router.put('/enquiries/:id/status', updateEnquiryStatus);

// Add notes to enquiry
router.post('/enquiries/:id/notes', addEnquiryNotes);

// Delete enquiry
router.delete('/enquiries/:id', deleteEnquiry);

// Bulk update enquiries
router.put('/enquiries/bulk-update', bulkUpdateEnquiries);

// Get enquiry statistics
router.get('/enquiries/stats', getEnquiryStats);

// Export enquiries
router.get('/enquiries/export', exportEnquiries);

// Get enquiries by user ID
router.get('/enquiries/user/:userId', getEnquiriesByUserId);

// ==================== PROPERTY MANAGEMENT ROUTES ====================

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
router.get('/properties/:id', getPropertyById);
// ==================== USER MANAGEMENT ROUTES ====================

// User management routes
router.get('/users', getAllUsersWithLikes);
router.get('/users/:id', getUserById);
router.get('/stats/website', getWebsiteUserStats);
router.get('/website/:website', getUsersByWebsite);
// ==================== ANALYTICS ROUTES ====================

// Analytics routes
router.get('/analytics/clicks', getClickAnalytics);
router.get('/analytics/clicks/by-type', getClickStatsByType);
router.get('/analytics/clicks/popular', getPopularClicks);
router.get('/analytics/clicks/trends', getClickTrends);
router.get('/analytics/clicks/raw', getRawClickData);
router.get('/analytics/clicks/sessions', getUserSessions);
router.get('/analytics/clicks/export', exportClickData);
router.post('/analytics/track', trackClick);

// User-focused analytics routes
router.get('/analytics/users', getUserAnalytics);
router.get('/analytics/clicks/hourly', getClickHourlyDistribution);

// Enhanced analytics routes with user filtering
router.get('/analytics/clicks/user/:userId', getClickAnalytics);
router.get('/analytics/clicks/summary', getClickAnalytics);




router.post('/properties/assign-websites', assignPropertiesToWebsites);
router.get('/properties', getPropertiesForAdmin);

// Test endpoint
router.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Admin API is working',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;