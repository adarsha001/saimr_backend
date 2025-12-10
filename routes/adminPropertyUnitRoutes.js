const express = require("express");
const router = express.Router();
const {
  getAllPropertyUnits,
  getPropertyUnitByIdAdmin,
  createPropertyUnitAdmin,
  updatePropertyUnitAdmin,
  deletePropertyUnitAdmin,
  updateApprovalStatus,
  toggleFeatured,
  toggleVerified,
  getPropertyUnitStats,
  bulkUpdatePropertyUnits,
  bulkDeletePropertyUnits,updateDisplayOrders,updateSingleDisplayOrder
} = require("../controllers/adminPropertyUnitController");

const { protect, authorize } = require("../middleware/authMiddleware");
const upload = require("../middlewares/multer");

// Apply protection and authorization middleware
router.use(protect);
router.use(authorize("admin"));

// Admin routes
router.get("/", getAllPropertyUnits);
router.get("/stats", getPropertyUnitStats);
router.get("/:id", getPropertyUnitByIdAdmin);
router.post("/", upload.array("images", 10), createPropertyUnitAdmin);
router.put("/:id", upload.array("images", 10), updatePropertyUnitAdmin);
router.delete("/:id", deletePropertyUnitAdmin);
router.put("/:id/approval", updateApprovalStatus);
router.put("/:id/toggle-featured", toggleFeatured);
router.put("/:id/toggle-verified", toggleVerified);
router.put("/bulk/update", bulkUpdatePropertyUnits);
router.delete("/bulk/delete", bulkDeletePropertyUnits);
router.put(
  '/display-orders/update',

updateDisplayOrders
);

// Update single display order
router.put(
  '/:id/display-order',

 updateSingleDisplayOrder
);

module.exports = router;