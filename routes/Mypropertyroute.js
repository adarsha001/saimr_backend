const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getUserProperties,
  getPropertyById,
  updateProperty,
  deleteProperty,
  updatePropertyStatus,
  bulkDeleteProperties
} = require('../controllers/MypropertyController');

// All routes require authentication
router.use(protect);

// Get user's properties
router.get('/my-properties', getUserProperties);

// Bulk operations
router.delete('/bulk-delete', bulkDeleteProperties);

// Single property operations
router.get('/:id', getPropertyById);
router.put('/:id', updateProperty);
router.delete('/:id', deleteProperty);
router.patch('/:id/status', updatePropertyStatus);

module.exports = router;