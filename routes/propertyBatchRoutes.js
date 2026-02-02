const express = require('express');
const router = express.Router();
const propertyBatchController = require('../controllers/propertyBatchController');
const { protect, authorize } = require('../middleware/authMiddleware');
const upload = require('../middlewares/multer');
const mongoose = require('mongoose');

const batchUpload = upload;

// ============ PUBLIC ROUTES (No authentication required) ============
// Anyone can view batches (READ operations)
router.route('/')
  .get(propertyBatchController.getAllBatches);

router.route('/:id')
  .get(propertyBatchController.getBatch);

// Public route for location-based access
router.get('/location/:location', propertyBatchController.getBatchesByLocation);

// ============ ADMIN ONLY ROUTES (Create/Update/Delete) ============
router.route('/')
  .post(
    protect,
    authorize('admin', 'superadmin'),
    batchUpload.single('image'),
    propertyBatchController.createBatch
  );

router.route('/:id')
  .put(
    protect,
    authorize('admin', 'superadmin'),
    batchUpload.single('image'),
    propertyBatchController.updateBatch
  )
  .delete(
    protect,
    authorize('admin', 'superadmin'),
    propertyBatchController.deleteBatch
  );

// ============ PROPERTY UNIT MANAGEMENT ROUTES ============
router.route('/:id/add-unit')
  .post(
    protect,
    authorize('admin', 'superadmin'),
    propertyBatchController.addPropertyUnit
  );

router.route('/:id/remove-unit')
  .post(
    protect,
    authorize('admin', 'superadmin'),
    propertyBatchController.removePropertyUnit
  );

// ============ STATUS MANAGEMENT ROUTES ============
router.route('/:id/toggle-active')
  .patch(
    protect,
    authorize('admin', 'superadmin'),
    propertyBatchController.toggleActiveStatus
  );

// ============ ADMIN SPECIAL ROUTES ============
router.get('/admin/all',
  protect,
  authorize('admin', 'superadmin'),
  async (req, res, next) => {
    req.query.isActive = 'false';
    next();
  },
  propertyBatchController.getAllBatches
);

router.get('/admin/user/:userId',
  protect,
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
    next();
  },
  propertyBatchController.getAllBatches
);

module.exports = router;