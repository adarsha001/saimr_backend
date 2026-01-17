const express = require("express");
const router = express.Router();
const {
  createPropertyUnit,
  getPropertyUnits,
  getPropertyUnitById,
  updatePropertyUnit,
  deletePropertyUnit,
getFeaturedPropertyUnits,
createPropertyUnitN8n
} = require("../controllers/propertyUnitController");
const likeController = require("../controllers/likeControllerunit")
const { protect, authorize } = require("../middleware/authMiddleware");
const upload = require("../middlewares/multer");

// Public routes
router.get('/featured', getFeaturedPropertyUnits);
router.get("/", getPropertyUnits);
router.get("/:id", getPropertyUnitById);


router.get('/likes', protect, likeController.getLikedProperties);

// Check if a property is liked by current user
router.get('/likes/check/:propertyId', protect, likeController.checkIfLiked); 

// Get like count for a property
router.get('/likes/count/:propertyId', likeController.getLikeCount);

// Toggle like/unlike (single endpoint for both actions)
router.post('/likes/toggle/:propertyId', protect, likeController.toggleLike);

// Protected routes
router.use(protect);

// Create property unit - EXACTLY like your existing route
router.post("/", upload.array("images", 10), createPropertyUnit);
router.post("/n8n", upload.array("images", 10), createPropertyUnitN8n);


// Update property unit
router.put("/:id", upload.array("images", 10), updatePropertyUnit);

// Delete property unit
router.delete("/:id", deletePropertyUnit);

// router.put('/bulk/display-orders',  bulkUpdateDisplayOrders);
// router.put('/bulk/update',  bulkUpdatePropertyUnits);
// router.delete('/bulk/delete',  bulkDeletePropertyUnits);
// router.put('/bulk/approval-status',  bulkUpdatePropertyUnits); 


module.exports = router;