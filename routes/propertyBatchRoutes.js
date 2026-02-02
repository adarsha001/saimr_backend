const express = require('express');
const router = express.Router();
const propertyBatchController = require('../controllers/propertyBatchController');
const { protect, authorize } = require('../middleware/authMiddleware');
const upload = require('../middlewares/multer');

// Create a specialized multer config for property batches
const batchUpload = upload;

// ============ PUBLIC ROUTES (No authentication required) ============
// These routes are for users to view batches
router.get('/location/:location', propertyBatchController.getBatchesByLocation);

// ============ PROTECTED ROUTES (Authentication required) ============
// Apply authentication middleware to all following routes
router.use(protect);

// ============ USER ROUTES (All authenticated users) ============
// Users can only GET active batches
router.get('/', propertyBatchController.getAllBatches); // Users see only active batches

// ============ ADMIN ONLY ROUTES ============
// Only admin/superadmin can create, update, delete batches
router.post('/',
  authorize('admin', 'superadmin'), // Only admin can create
  batchUpload.single('image'),
  propertyBatchController.createBatch
);

// Get batch by ID (users can view, admin can view all)
router.get('/:id', propertyBatchController.getBatch);

// Update batch (admin only)
router.put('/:id',
  authorize('admin', 'superadmin'), // Only admin can update
  batchUpload.single('image'),
  propertyBatchController.updateBatch
);

// Delete batch (admin only)
router.delete('/:id',
  authorize('admin', 'superadmin'), // Only admin can delete
  propertyBatchController.deleteBatch
);

// Add/remove property units (admin only)
router.route('/:id/add-unit')
  .post(
    authorize('admin', 'superadmin'),
    propertyBatchController.addPropertyUnit
  );

router.route('/:id/remove-unit')
  .post(
    authorize('admin', 'superadmin'),
    propertyBatchController.removePropertyUnit
  );

// Toggle active status (admin only)
router.route('/:id/toggle-active')
  .patch(
    authorize('admin', 'superadmin'),
    propertyBatchController.toggleActiveStatus
  );

// Admin can get all batches including inactive ones (with special query param)
router.get('/admin/all',
  authorize('admin', 'superadmin'),
  async (req, res, next) => {
    req.query.showAll = true; // Flag to show all batches
    next();
  },
  propertyBatchController.getAllBatches
);

// Admin can get batches by user
router.get('/admin/user/:userId',
  authorize('admin', 'superadmin'),
  async (req, res, next) => {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }
    req.query.createdBy = userId;
    req.query.showAll = true; // Show all batches for this user
    next();
  },
  propertyBatchController.getAllBatches
);

module.exports = router;