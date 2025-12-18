const express = require("express");
const router = express.Router();
const {
  createPropertyUnit,
  getPropertyUnits,
  getPropertyUnitById,
  updatePropertyUnit,
  deletePropertyUnit,
  bulkUpdateDisplayOrders,
  bulkUpdatePropertyUnits,
  bulkDeletePropertyUnits
} = require("../controllers/propertyUnitController");
const { protect, authorize } = require("../middleware/authMiddleware");
const upload = require("../middlewares/multer");

// Public routes
router.get("/", getPropertyUnits);
router.get("/:id", getPropertyUnitById);

// Protected routes
router.use(protect);

// Create property unit - EXACTLY like your existing route
router.post("/", upload.array("images", 10), createPropertyUnit);

// Update property unit
router.put("/:id", upload.array("images", 10), updatePropertyUnit);

// Delete property unit
router.delete("/:id", deletePropertyUnit);

router.put('/bulk/display-orders',  bulkUpdateDisplayOrders);
router.put('/bulk/update',  bulkUpdatePropertyUnits);
router.delete('/bulk/delete',  bulkDeletePropertyUnits);
router.put('/bulk/approval-status',  bulkUpdatePropertyUnits); 


module.exports = router;