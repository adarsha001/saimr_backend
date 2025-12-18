const express = require("express");
const router = express.Router();

// ✅ Correct import (make sure this matches your controller file)
const adminPropertyUnitController = require("../controllers/adminPropertyUnitController");

const { protect, authorize } = require("../middleware/authMiddleware");
const upload = require("../middlewares/multer"); // Make sure path is correct

// Apply protection and authorization middleware
router.use(protect);
router.use(authorize("admin", "superadmin")); // Allow both admin and superadmin

// Admin routes
router.get("/", adminPropertyUnitController.getAllPropertyUnits);
router.get("/stats", adminPropertyUnitController.getPropertyUnitStats);
router.get("/:id", adminPropertyUnitController.getPropertyUnitByIdAdmin);
router.post("/", upload.array("images", 10), adminPropertyUnitController.createPropertyUnitAdmin);
router.put("/:id", upload.array("images", 10), adminPropertyUnitController.updatePropertyUnitAdmin);
router.delete("/:id", adminPropertyUnitController.deletePropertyUnitAdmin);
router.put("/:id/approval", adminPropertyUnitController.updateApprovalStatus);
router.put("/:id/toggle-featured", adminPropertyUnitController.toggleFeatured);
router.put("/:id/toggle-verified", adminPropertyUnitController.toggleVerified);
router.put("/bulk/update", adminPropertyUnitController.bulkUpdatePropertyUnits);
router.delete("/bulk/delete", adminPropertyUnitController.bulkDeletePropertyUnits);
router.put("/display-orders/update", adminPropertyUnitController.updateDisplayOrders);
router.put("/:id/display-order", adminPropertyUnitController.updateSingleDisplayOrder);

module.exports = router;