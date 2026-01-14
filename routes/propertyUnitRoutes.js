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
const {
  likePropertyUnit,
  unlikePropertyUnit,
  getLikedProperties,
  checkIfLiked,
  getLikeCount,
  toggleLike
} = require("../controllers/likeControllerunit");
const { protect, authorize } = require("../middleware/authMiddleware");
const upload = require("../middlewares/multer");

// Public routes
router.get('/featured', getFeaturedPropertyUnits);
router.get("/", getPropertyUnits);
router.get("/:id", getPropertyUnitById);


router.get('/likes/count/:propertyId', getLikeCount);
router.get('/likes/check/:propertyId', protect, checkIfLiked);
router.get('/likes', protect, getLikedProperties);
router.post('/likes/:propertyId', protect, likePropertyUnit);
router.delete('/likes/:propertyId', protect, unlikePropertyUnit);
router.post('/likes/toggle/:propertyId', protect, toggleLike);
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