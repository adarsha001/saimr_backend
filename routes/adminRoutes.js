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
  getAllProperties, // Add this
  updatePropertyOrder, // Add this
  bulkUpdateProperties, // Add this
  getPropertyStats // Add this
} = require('../controllers/adminController');

// Only admins can access these
router.use(protect, authorize('admin')); 

// Property management routes
router.get('/properties/pending', getPendingProperties);
router.get('/properties', getPropertiesByStatus);
router.get('/properties/all', getAllProperties); // New route for all properties
router.put('/properties/approve/:id', approveProperty);
router.put('/properties/reject/:id', rejectProperty);
router.put('/properties/feature/:id', toggleFeatured);
router.put('/properties/order/:id', updatePropertyOrder); // Update order
router.put('/properties/bulk-update', bulkUpdateProperties); // Bulk actions
router.get('/properties/stats', getPropertyStats); // Statistics

// User management routes
router.get('/users', getAllUsersWithLikes);
router.get('/users/:id', getUserById);

module.exports = router;