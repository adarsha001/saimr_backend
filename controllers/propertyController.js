const Property = require("../models/Property");

// Create new property
const createProperty = async (req, res) => {
  try {
    const {
      title,
      description,
      content,
      images,
      city,
      propertyLocation,
      coordinates,
      mapUrl,
      category,
      isFeatured,
      forSale,
      isVerified,
      attributes,
      distanceKey,
      features,
      nearby,
    } = req.body;

    // Validate required fields
    if (!title || !city || !propertyLocation || !category) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const newProperty = new Property({
      title,
      description,
      content,
      images,
      city,
      propertyLocation,
      coordinates,
      mapUrl,
      category,
      isFeatured: isFeatured || false,
      forSale: forSale !== undefined ? forSale : true,
      isVerified: isVerified || false,
      attributes,
      distanceKey,
      features,
      nearby,
      // createdBy: req.user?._id, // optional auth
    });

    const savedProperty = await newProperty.save();
    res.status(201).json(savedProperty);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error", error });
  }
};

// Get all properties
const getProperties = async (req, res) => {
  try {
    const properties = await Property.find().sort({ createdAt: -1 });
    res.status(200).json(properties);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error", error });
  }
};

// Get single property by ID
const getPropertyById = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }
    res.status(200).json(property);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error", error });
  }
};

module.exports = { createProperty, getProperties, getPropertyById };
