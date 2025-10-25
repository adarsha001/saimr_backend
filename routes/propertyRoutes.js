const express = require("express");
const { createProperty, getProperties, getPropertyById } = require("../controllers/propertyController");
const upload = require("../middlewares/multer");
const cloudinary = require("../config/cloudinary");
const router = express.Router();


// ✅ Add new property


// Add new property
router.post("/", upload.array("images", 10), createProperty);

// Get all properties
router.get("/", getProperties);

// Get single property
router.get("/:id", getPropertyById);

module.exports = router;
