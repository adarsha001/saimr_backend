const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  getPendingProperties,
  approveProperty, // Changed from verifyProperty
  rejectProperty,
  toggleFeatured,
  getPropertiesByStatus // New function
} = require('../controllers/adminController');

// Only admins can access these
router.use(protect, authorize('admin')); 

router.get('/properties/pending', getPendingProperties);
router.get('/properties', getPropertiesByStatus); // New route for filtering by status
router.put('/properties/approve/:id', approveProperty); // Changed to /approve
router.put('/properties/reject/:id', rejectProperty);
router.put('/properties/feature/:id', toggleFeatured);

module.exports = router;