const express = require("express");
const router = express.Router();
const {
  createPropertyUnit,
  getPropertyUnits,
  // getPropertyUnit,
  updatePropertyUnit,
  deletePropertyUnit
} = require("../controllers/propertyUnitController");
const { protect, authorize } = require("../middleware/authMiddleware");
const upload = require("../middlewares/multer");

// Public routes
router.get("/", getPropertyUnits);
// router.get("/:id", getPropertyUnit);

// Protected routes
router.use(protect);

// Create property unit - EXACTLY like your existing route
router.post("/", upload.array("images", 10), createPropertyUnit);

// Update property unit
router.put("/:id", upload.array("images", 10), updatePropertyUnit);

// Delete property unit
router.delete("/:id", deletePropertyUnit);


module.exports = router;