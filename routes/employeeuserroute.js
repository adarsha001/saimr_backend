const express = require("express");
const router = express.Router();
const upload = require("../middlewares/multer");
// Change this line - use employee auth middleware instead
const { protectEmployee, authorizeEmployee } = require("../middleware/employeeAuthMiddleware");
const {
  register,
  login,
  logout,
  getProfile,
  updateProfile,
  getAllEmployees,
  getEmployeeById,
  getTodayRecord,
  getEmployeeStats,
  addWorkItem,
  uploadWorkItemImage,
  completeWorkItem,
  updateWorkItem,
  deleteWorkItem,
  getTodayWorkItems,
  updateDailySummary
} = require("../controllers/employeeuser");

// Public routes
router.post("/register", upload.single("userImage"), register);
router.post("/login", login);

// Protected routes (Employee self-service) - Now using protectEmployee
router.post("/logout", protectEmployee, logout);
router.get("/profile", protectEmployee, getProfile);
router.put("/profile", protectEmployee, upload.single("userImage"), updateProfile);
router.get("/today-record", protectEmployee, getTodayRecord);
router.get("/stats", protectEmployee, getEmployeeStats);

// Work Items Routes
router.get("/today-work-items", protectEmployee, getTodayWorkItems);
router.post("/add-work-item", protectEmployee, addWorkItem);
router.post("/upload-work-image", protectEmployee, upload.single("workImage"), uploadWorkItemImage);
router.put("/complete-work-item", protectEmployee, completeWorkItem);
router.put("/update-work-item", protectEmployee, updateWorkItem);
router.delete("/delete-work-item", protectEmployee, deleteWorkItem);
router.put("/update-daily-summary", protectEmployee, updateDailySummary);

// Admin only routes
router.get("/employees", protectEmployee, authorizeEmployee("admin"), getAllEmployees);
router.get("/employees/:id", protectEmployee, authorizeEmployee("admin"), getEmployeeById);

module.exports = router;