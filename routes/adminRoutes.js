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

// Enhanced CORS middleware for admin routes
router.use((req, res, next) => {
  const allowedOrigins = [
    'https://saimr-frontend.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173'
  ];
  const origin = req.headers.origin;
  
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

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

// Test endpoint
router.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Admin API is working',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;