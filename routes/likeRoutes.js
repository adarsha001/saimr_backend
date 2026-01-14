const express = require("express");
const router = express.Router();
const {
  likePropertyUnit,
  unlikePropertyUnit,
  getLikedProperties,
  checkIfLiked,
  getLikeCount
} = require("../controllers/likeController");
const { protect } = require("../middleware/authMiddleware");

// All like routes require authentication
router.use(protect);

// Get user's liked properties
router.get("/", getLikedProperties);

// Check if a property is liked by user
router.get("/check/:propertyId", checkIfLiked);

// Get like count for a property
router.get("/count/:propertyId", getLikeCount);

// Like a property
router.post("/:propertyId", likePropertyUnit);

// Unlike a property
router.delete("/:propertyId", unlikePropertyUnit);

module.exports = router;