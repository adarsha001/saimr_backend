const Property = require("../models/property");
const upload = require("../middlewares/multer");
const cloudinary = require("../config/cloudinary");

// Create new property
const createProperty = async (req, res) => {
  try {
    console.log('User making request:', req.user); // Debug log
    
    // Check if user is authenticated
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated. Please login to add property.'
      });
    }

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

    // Check required fields
    if (!title || !city || !propertyLocation || !price || !category) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: title, city, propertyLocation, price, category'
      });
    }

    // Upload images to Cloudinary
    const uploadedImages = [];
    if (req.files && req.files.length > 0) {
      for (let file of req.files) {
        try {
          const result = await cloudinary.uploader.upload(file.path, {
            folder: "properties",
          });
          uploadedImages.push({
            url: result.secure_url,
            public_id: result.public_id,
          });
        } catch (uploadError) {
          console.error('Cloudinary upload error:', uploadError);
          return res.status(500).json({
            success: false,
            message: 'Error uploading images to Cloudinary'
          });
        }
      }
    } else {
      return res.status(400).json({
        success: false,
        message: 'At least one image is required'
      });
    }

    // Parse nested objects with error handling
    let parsedAttributes = {};
    let parsedNearby = {};
    let parsedCoordinates = {};
    let parsedDistanceKey = [];
    let parsedFeatures = [];

    try {
      parsedAttributes = attributes ? JSON.parse(attributes) : {};
      parsedNearby = nearby ? JSON.parse(nearby) : {};
      parsedCoordinates = coordinates ? JSON.parse(coordinates) : {};
      parsedDistanceKey = distanceKey ? JSON.parse(distanceKey) : [];
      parsedFeatures = features ? JSON.parse(features) : [];
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return res.status(400).json({
        success: false,
        message: 'Invalid JSON format in one of the fields'
      });
    }

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
      isFeatured: isFeatured === 'true' || isFeatured === true,
      forSale: forSale === 'true' || forSale === true,
      isVerified: isVerified === 'true' || isVerified === true,
      createdBy: req.user._id,
      attributes: parsedAttributes,
      distanceKey: parsedDistanceKey,
      features: parsedFeatures,
      nearby: parsedNearby,
    });

    await newProperty.save();
    
    // Populate with correct field names
    await newProperty.populate('createdBy', 'name username gmail phoneNumber');

    res.status(201).json({
      success: true,
      message: "Property added successfully!",
      property: newProperty,
    });
  } catch (error) {
    console.error('Property creation error:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error adding property",
      error: error.message 
    });
  }
};

// Get all properties
const getProperties = async (req, res) => {
  try {
    const properties = await Property.find()
      .populate('createdBy', 'name username gmail phoneNumber') // Use correct field names
      .sort({ createdAt: -1 });
    res.status(200).json(properties);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error", error });
  }
};

// Get single property by ID
const getPropertyById = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id)
      .populate('createdBy', 'name username gmail phoneNumber'); // Use correct field names
    
    console.log('Property with populated createdBy:', {
      name: property?.createdBy?.name,
      gmail: property?.createdBy?.gmail,
      phoneNumber: property?.createdBy?.phoneNumber
    });
    
    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }
    res.status(200).json(property);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error", error });
  }
};

// Get properties by user
const getPropertiesByUser = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const properties = await Property.find({ createdBy: req.user._id })
      .populate('createdBy', 'name username gmail phoneNumber') // Update here too
      .sort({ createdAt: -1 });
    res.status(200).json(properties);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error", error });
  }
};

module.exports = { 
  createProperty, 
  getProperties, 
  getPropertyById, 
  getPropertiesByUser 
};