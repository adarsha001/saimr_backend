const express = require('express');
const router = express.Router();
const propertyBatchController = require('../controllers/propertyBatchController');
const { protect, authorize } = require('../middleware/authMiddleware');
const upload = require('../middlewares/multer'); // Import your existing multer config
const mongoose = require('mongoose');

// Create a specialized multer config for property batches with file size limit
const batchUpload = upload; // Use your existing multer config

// If you need to add specific file filter or limits, you can create a new instance:
// const batchUpload = multer({
//   storage: multer.diskStorage({
//     filename: (req, file, cb) => {
//       cb(null, Date.now() + path.extname(file.originalname));
//     },
//   }),
//   fileFilter: (req, file, cb) => {
//     // Accept images only
//     if (file.mimetype.startsWith('image/')) {
//       cb(null, true);
//     } else {
//       cb(new Error('Not an image! Please upload only images.'), false);
//     }
//   },
//   limits: {
//     fileSize: 5 * 1024 * 1024 // 5MB limit
//   }
// });

// All routes require authentication
router.use(protect);

// ============ MAIN CRUD ROUTES ============
router.route('/')
  .post(
    batchUpload.single('image'), // Single image upload
    propertyBatchController.createBatch
  )
  .get(propertyBatchController.getAllBatches);

router.route('/:id')
  .get(propertyBatchController.getBatch)
  .put(
    batchUpload.single('image'), // Optional image update
    propertyBatchController.updateBatch
  )
  .delete(propertyBatchController.deleteBatch);

// ============ PROPERTY UNIT MANAGEMENT ROUTES ============
router.route('/:id/add-unit')
  .post(propertyBatchController.addPropertyUnit);

router.route('/:id/remove-unit')
  .post(propertyBatchController.removePropertyUnit);

// ============ STATUS MANAGEMENT ROUTES ============
router.route('/:id/toggle-active')
  .patch(propertyBatchController.toggleActiveStatus);

// ============ PUBLIC/SPECIAL ROUTES ============
// Public route (no authentication required)
router.get('/location/:location', propertyBatchController.getBatchesByLocation);

// ============ ADMIN ONLY ROUTES ============
// Admin can get all batches including inactive ones
router.get('/',
  authorize('admin', 'superadmin'),
  async (req, res, next) => {
    req.query.isActive = 'false'; // Override to show all
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
    next();
  },
  propertyBatchController.getAllBatches
);

module.exports = router;