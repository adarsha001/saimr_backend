// propertyUnitRoutes.js
const express = require("express");
const router = express.Router();
const {
  createPropertyUnit,
  getPropertyUnits,
  getPropertyUnitById,
  updatePropertyUnit,
  deletePropertyUnit,
  getFeaturedPropertyUnits,
  createPropertyUnitN8n,
  getAllPropertyUnitsNoPagination
} = require("../controllers/propertyUnitController");
const likeController = require("../controllers/likeControllerunit");
const { protect, authorize } = require("../middleware/authMiddleware");
const upload = require("../middlewares/multer");

// IMPORT THE PropertyBatch MODEL
const PropertyBatch = require("../models/PropertyBatch");

// Public routes
router.get('/featured', getFeaturedPropertyUnits);
router.get("/", getPropertyUnits);
router.get("/:id", getPropertyUnitById);

// Protected routes that don't require property ID
router.get('/all', protect, getAllPropertyUnitsNoPagination);
router.get('/likes', protect, likeController.getLikedProperties);
router.get('/likes/check/:propertyId', protect, likeController.checkIfLiked);
router.get('/likes/count/:propertyId', likeController.getLikeCount);
router.post('/likes/toggle/:propertyId', protect, likeController.toggleLike);

// ADD THE BATCH ROUTE HERE - Before the protect middleware that applies to all subsequent routes
// This route needs to be BEFORE router.use(protect) if you want it to be protected
// Or you can keep it after, both work as long as it's defined
router.get("/:propertyId/batches", protect, async (req, res) => {
  try {
    const { propertyId } = req.params;
    const batches = await PropertyBatch.find({
      propertyUnits: propertyId,
      isActive: true
    }).select("batchName locationName batchType stats.viewStats");
    
    res.status(200).json({
      success: true,
      count: batches.length,
      data: batches
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Apply protect middleware to all routes below this line
router.use(protect);

// CRUD operations (these require authentication)
router.post("/", upload.array("images", 10), createPropertyUnit);
router.post("/n8n", upload.array("images", 10), createPropertyUnitN8n);
router.put("/:id", upload.array("images", 10), updatePropertyUnit);
router.delete("/:id", deletePropertyUnit);

module.exports = router;