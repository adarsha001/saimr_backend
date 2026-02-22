// routes/carouselRoutes.js
const express = require('express');
const router = express.Router();
const upload = require('../middlewares/multer'); // Your multer configuration

// Import controller functions
const {
  createCarouselImage,
  getCarouselImages,
  getCarouselImageById,
  updateCarouselImage,
  deleteCarouselImage,
  getMainBanners,
  getImagesByPropertyType,
  getRandomImages,
  trackClick,
  updateDisplayOrder
} = require('../controllers/carouselController');

const { protect, admin, authorize } = require('../middleware/authMiddleware');

// Custom middleware to handle multiple file fields with your upload configuration
const uploadFields = (req, res, next) => {
  // Create a multer instance with your config that handles multiple fields
  const uploadHandler = upload.fields([
    { name: 'desktopImage', maxCount: 1 },
    { name: 'mobileImage', maxCount: 1 }
  ]);
  
  uploadHandler(req, res, function(err) {
    if (err) {
      return res.status(400).json({
        success: false,
        message: 'File upload error',
        error: err.message
      });
    }
    next();
  });
};

// ============ PUBLIC ROUTES (No authentication required) ============

// Get all carousel images with filters
router.get('/images', getCarouselImages);

// Get single carousel image by ID
router.get('/images/:id', getCarouselImageById);

// Get main banner images
router.get('/main-banners', getMainBanners);

// Get images by property type
router.get('/by-property-type', getImagesByPropertyType);

// Get random images
router.get('/random', getRandomImages);

// Track click on carousel image
router.post('/track-click/:id', trackClick);

// ============ PROTECTED ROUTES (Authentication required) ============

// All routes below this line require authentication


// ============ ADMIN ONLY ROUTES ============

// Create new carousel image (admin only)
    router.post('/create',   protect,
    authorize('admin', 'superadmin'), uploadFields, createCarouselImage);

    // Update carousel image (admin only)
    router.put('/update/:id',   protect,
    authorize('admin', 'superadmin'),  uploadFields, updateCarouselImage);

    // Delete carousel image (admin only)
    router.delete('/delete/:id',   protect,
    authorize('admin', 'superadmin'),  deleteCarouselImage);

    // Bulk update display order (admin only)
    router.post('/update-order',   protect,
    authorize('admin', 'superadmin'),  updateDisplayOrder);

module.exports = router;