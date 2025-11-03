const express = require("express");
const { createProperty, getProperties, getPropertyById, getPropertiesByUser } = require("../controllers/propertyController");
const { protect } = require("../middleware/authMiddleware"); // Import auth middleware
const upload = require("../middlewares/multer");
const router = express.Router();

// Public routes - no authentication required
router.get("/", getProperties);
router.get("/:id", getPropertyById);

// Protected routes - require authentication
router.post("/", upload.array("images", 10), createProperty);
router.use(protect); // This applies to all routes below
router.get('/my-properties', getPropertiesByUser);

module.exports = router;