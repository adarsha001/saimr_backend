const Property = require("../models/Property");
const upload = require("../middlewares/multer");
const cloudinary = require("../config/cloudinary");
// Create new property
const createProperty = async (req, res) => {
  try {
    const {
      title,
      description,
      content,
      price,
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

    // Upload images to Cloudinary
    const uploadedImages = [];
    for (let file of req.files) {
      const result = await cloudinary.uploader.upload(file.path, {
        folder: "properties",
      });
      uploadedImages.push({
        url: result.secure_url,
        public_id: result.public_id,
      });
    }

    // Parse nested objects
    const parsedAttributes = attributes ? JSON.parse(attributes) : {};
    const parsedNearby = nearby ? JSON.parse(nearby) : {};
    const parsedCoordinates = coordinates ? JSON.parse(coordinates) : {};
    const parsedDistanceKey = distanceKey ? JSON.parse(distanceKey) : [];
    const parsedFeatures = features ? JSON.parse(features) : [];

    const newProperty = new Property({
      title,
      description,
      content,
      price,
      images: uploadedImages,
      city,
      propertyLocation,
      coordinates: parsedCoordinates,
      mapUrl,
      category,
      isFeatured,
      forSale,
      isVerified,
      attributes: parsedAttributes,
      distanceKey: parsedDistanceKey,
      features: parsedFeatures,
      nearby: parsedNearby,
   
    });

    await newProperty.save();
    res.status(201).json({
      success: true,
      message: "Property added successfully!",
      property: newProperty,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error adding property", error });
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
