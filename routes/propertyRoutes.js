const express = require("express");
const { createProperty, getProperties, getPropertyById } = require("../controllers/propertyController");

const router = express.Router();

// Add new property
router.post("/", createProperty);

// Get all properties
router.get("/", getProperties);

// Get single property
router.get("/:id", getPropertyById);

module.exports = router;
