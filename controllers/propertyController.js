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
      approvalStatus, // ADD THIS LINE - receive approvalStatus from frontend
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

    // Validate category
    const validCategories = ["Outright", "Commercial", "Farmland", "JD/JV"];
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: `Invalid category. Must be one of: ${validCategories.join(', ')}`
      });
    }

    // Validate approvalStatus if provided
    if (approvalStatus && !["pending", "approved", "rejected"].includes(approvalStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid approval status'
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
    let parsedApprovalStatus = approvalStatus; // Default to what frontend sends

    try {
      parsedAttributes = attributes ? JSON.parse(attributes) : {};
      parsedNearby = nearby ? JSON.parse(nearby) : {};
      parsedCoordinates = coordinates ? JSON.parse(coordinates) : {};
      parsedDistanceKey = distanceKey ? JSON.parse(distanceKey) : [];
      parsedFeatures = features ? JSON.parse(features) : [];
      
      // Parse approvalStatus if it's sent as string
      if (approvalStatus && typeof approvalStatus === 'string') {
        parsedApprovalStatus = approvalStatus;
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return res.status(400).json({
        success: false,
        message: 'Invalid JSON format in one of the fields'
      });
    }

    // Validate features based on category
    const validFeatures = {
      Commercial: [
        "Conference Room", "CCTV Surveillance", "Power Backup", "Fire Safety",
        "Cafeteria", "Reception Area", "Parking", "Lift(s)"
      ],
      Farmland: [
        "Borewell", "Fencing", "Electricity Connection", "Water Source",
        "Drip Irrigation", "Storage Shed"
      ],
      Outright: [
        "Highway Access", "Legal Assistance", "Joint Development Approved",
        "Investor Friendly", "Gated Boundary"
      ],
      "JD/JV": [
        "Highway Access", "Legal Assistance", "Joint Development Approved",
        "Investor Friendly", "Gated Boundary"
      ]
    };

    // Filter features to only include valid ones for the category
    const categoryFeatures = validFeatures[category] || [];
    const filteredFeatures = parsedFeatures.filter(feature => 
      categoryFeatures.includes(feature)
    );

    // Validate attributes based on category
    if (category === "Farmland") {
      // Farmland specific validations
      if (!parsedAttributes.square) {
        return res.status(400).json({
          success: false,
          message: 'Square footage is required for Farmland properties'
        });
      }
    }

    if (category === "JD/JV") {
      // JD/JV specific validations
      if (!parsedAttributes.typeOfJV) {
        return res.status(400).json({
          success: false,
          message: 'Type of JV is required for JD/JV properties'
        });
      }
    }

    // Create new property with dynamic approvalStatus
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
      approvalStatus: parsedApprovalStatus || "pending", // Use frontend value or default to "pending"
      isFeatured: isFeatured === 'true' || isFeatured === true,
      forSale: forSale === 'true' || forSale === true,
      isVerified: isVerified === 'true' || isVerified === true,
      createdBy: req.user._id,
      attributes: parsedAttributes,
      distanceKey: parsedDistanceKey,
      features: filteredFeatures,
      nearby: parsedNearby,
    });

    await newProperty.save();
    
    // Populate with correct field names
    await newProperty.populate('createdBy', 'name username gmail phoneNumber');

    // Dynamic success message based on approval status
    const successMessage = parsedApprovalStatus === "approved" 
      ? "Property added successfully and approved! It is now live on the platform."
      : "Property added successfully! It will be visible after admin approval.";

    res.status(201).json({
      success: true,
      message: successMessage,
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
const getProperties = async (req, res) => {
  try {
    const {
      category,
      city,
      minPrice,
      maxPrice,
      forSale,
      isFeatured,
      isVerified,
      page = 1,
      limit = 10,
      sortBy = 'displayOrder', // Changed from 'createdAt' to 'displayOrder'
      sortOrder = 'asc' // Changed from 'desc' to 'asc' for display order
    } = req.query;

    // Build filter object - only show approved properties
    const filter = { approvalStatus: 'approved' };
    
    if (category) filter.category = category;
    if (city) filter.city = { $regex: city, $options: 'i' };
    if (forSale) filter.forSale = forSale === 'true';
    if (isFeatured) filter.isFeatured = isFeatured === 'true';
    if (isVerified) filter.isVerified = isVerified === 'true';
    
    // Price filter - handle numeric prices only
    if (minPrice || maxPrice) {
      filter.price = { 
        $not: { $eq: "Price on Request" }, // Exclude "Price on Request" from price range
        ...(minPrice && { $gte: parseFloat(minPrice) }),
        ...(maxPrice && { $lte: parseFloat(maxPrice) })
      };
    }

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const properties = await Property.find(filter)
      .populate('createdBy', 'name username gmail phoneNumber')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Property.countDocuments(filter);

    res.status(200).json({
      success: true,
      properties,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      success: false,
      message: "Server Error", 
      error: error.message 
    });
  }
};
// Get ALL properties (including pending) - FOR ADMIN USE ONLY

// Get single property by ID - only show if approved (unless admin)
const getPropertyById = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id)
      .populate('createdBy', 'name username gmail phoneNumber');
    
    if (!property) {
      return res.status(404).json({ 
        success: false,
        message: "Property not found" 
      });
    }

    // Check if property is approved OR if user is admin
    const isAdmin = req.user && req.user.role === 'admin';
    if (property.approvalStatus !== 'approved' && !isAdmin) {
      return res.status(403).json({ 
        success: false,
        message: "Property not available" 
      });
    }

    res.status(200).json({
      success: true,
      property
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      success: false,
      message: "Server Error", 
      error: error.message 
    });
  }
};

// Get properties by user - user can see their own properties regardless of status
const getPropertiesByUser = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const { page = 1, limit = 10, approvalStatus } = req.query;

    const filter = { createdBy: req.user._id };
    if (approvalStatus) filter.approvalStatus = approvalStatus;

    const properties = await Property.find(filter)
      .populate('createdBy', 'name username gmail phoneNumber')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Property.countDocuments(filter);

    res.status(200).json({
      success: true,
      properties,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      success: false,
      message: "Server Error", 
      error: error.message 
    });
  }
};

// Update property approval status (Admin only)
const updatePropertyStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { approvalStatus, rejectionReason } = req.body;

    if (!approvalStatus || !["approved", "rejected"].includes(approvalStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Valid approval status (approved/rejected) is required'
      });
    }

    const updateData = { approvalStatus };
    
    if (approvalStatus === "rejected" && rejectionReason) {
      updateData.rejectionReason = rejectionReason;
    } else if (approvalStatus === "approved") {
      updateData.rejectionReason = ""; // Clear rejection reason if approved
    }

    const property = await Property.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name username gmail phoneNumber');

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found"
      });
    }

    res.status(200).json({
      success: true,
      message: `Property ${approvalStatus} successfully`,
      property
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Error updating property status",
      error: error.message
    });
  }
};

// Update property (Owner only)
const updateProperty = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    
    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found"
      });
    }

    // Check if user owns the property or is admin
    if (property.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this property"
      });
    }

    const updates = req.body;
    
    // Handle image updates if new files are uploaded
    if (req.files && req.files.length > 0) {
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
      updates.images = [...property.images, ...uploadedImages];
    }

    // Parse nested objects if they exist
    if (updates.attributes && typeof updates.attributes === 'string') {
      updates.attributes = JSON.parse(updates.attributes);
    }
    if (updates.features && typeof updates.features === 'string') {
      updates.features = JSON.parse(updates.features);
    }
    if (updates.nearby && typeof updates.nearby === 'string') {
      updates.nearby = JSON.parse(updates.nearby);
    }

    // Reset approval status to pending when property is updated
    updates.approvalStatus = 'pending';
    updates.rejectionReason = '';

    const updatedProperty = await Property.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name username gmail phoneNumber');

    res.status(200).json({
      success: true,
      message: "Property updated successfully. It will be reviewed again by admin.",
      property: updatedProperty
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Error updating property",
      error: error.message
    });
  }
};

// Delete property
const deleteProperty = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    
    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found"
      });
    }

    // Check if user owns the property or is admin
    if (property.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this property"
      });
    }

    // Delete images from Cloudinary
    for (let image of property.images) {
      if (image.public_id) {
        await cloudinary.uploader.destroy(image.public_id);
      }
    }

    await Property.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Property deleted successfully"
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Error deleting property",
      error: error.message
    });
  }
};

module.exports = { 
  createProperty, 
  getProperties, 

  getPropertyById, 
  getPropertiesByUser,
  updatePropertyStatus,
  updateProperty,
  deleteProperty
};