// backend/routes/adminRoutes.js
const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  getAllEmployees,
  getEmployeeById,
  getEmployeeRecordsByDateRange,
  getAdminDashboardStats,
  updateEmployeeStatus
} = require("../controllers/adminEmployeeController");

// Admin routes - using protect for authentication and authorize for admin role
// Only users with 'admin' role can access these routes
router.get("/dashboard-stats", protect, authorize("admin"), getAdminDashboardStats);
router.get("/employees", protect, authorize("admin"), getAllEmployees);
router.get("/employees/:id", protect, authorize("admin"), getEmployeeById);
router.get("/employees/:id/records", protect, authorize("admin"), getEmployeeRecordsByDateRange);
router.put("/employees/:id/status", protect, authorize("admin"), updateEmployeeStatus);

module.exports = router;