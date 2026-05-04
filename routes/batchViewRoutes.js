// routes/batchViewRoutes.js
const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  recordPropertyView,
  getBatchAnalytics,
  getUserBatches,
  getAllBatches,
  getBatchById,
  getCompanyAnalytics,
  deleteBatch,
  toggleBatchStatus,
  getBatchPropertyClickStats,
  getBatchUserClickStats,
  exportBatchAnalytics
} = require("../controllers/batchViewController");

// ============= PUBLIC/LOGGED IN ROUTES =============
// Record view when user clicks property
router.post("/property/:propertyId/view", protect, recordPropertyView);

// Get batch analytics (owner or admin)
router.get("/batch/:batchId/analytics", protect, getBatchAnalytics);

// Get user's own batches
router.get("/user/my-batches", protect, getUserBatches);

// ============= ADMIN ONLY ROUTES =============
// Get all batches
router.get("/admin/all", protect, authorize("admin", "superadmin"), getAllBatches);

// Get batch by ID
router.get("/admin/batch/:batchId", protect, authorize("admin", "superadmin"), getBatchById);

// Get company-wide analytics
router.get("/admin/company-analytics", protect, authorize("admin", "superadmin"), getCompanyAnalytics);

// Get property click stats for a batch
router.get("/admin/batch/:batchId/property-clicks", protect, authorize("admin", "superadmin"), getBatchPropertyClickStats);

// Get user click stats for a batch
router.get("/admin/batch/:batchId/user-clicks", protect, authorize("admin", "superadmin"), getBatchUserClickStats);

// Export batch analytics
router.get("/admin/batch/:batchId/export", protect, authorize("admin", "superadmin"), exportBatchAnalytics);

// Delete batch
router.delete("/admin/batches/:batchId", protect, authorize("admin", "superadmin"), deleteBatch);

// Toggle batch active status
router.patch("/admin/batch/:batchId/toggle", protect, authorize("admin", "superadmin"), toggleBatchStatus);

module.exports = router;