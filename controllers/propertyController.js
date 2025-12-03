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
      approvalStatus, // Will be overridden based on user role
      isFeatured,     // Will be overridden based on user role
      isVerified,     // Will be overridden based on user role
      forSale,
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

    // SECURITY: Determine sensitive fields based on user role
    const isAdminUser = req.user.isAdmin || req.user.userType === 'superadmin' || req.user.userType === 'admin';
    
    let finalApprovalStatus = "pending"; // Default for regular users
    let finalIsFeatured = false; // Default for regular users
    let finalIsVerified = false; // Default for regular users

    // Only allow admin users to set these sensitive fields
    if (isAdminUser) {
      // Admin can set approvalStatus
      if (approvalStatus && ["pending", "approved", "rejected"].includes(approvalStatus)) {
        finalApprovalStatus = approvalStatus;
      }
      
      // Admin can set isFeatured
      if (isFeatured !== undefined) {
        finalIsFeatured = isFeatured === 'true' || isFeatured === true;
      }
      
      // Admin can set isVerified
      if (isVerified !== undefined) {
        finalIsVerified = isVerified === 'true' || isVerified === true;
      }
    }
    // For non-admin users, always use default values regardless of what they send
    else {
      finalApprovalStatus = "pending";
      finalIsFeatured = false;
      finalIsVerified = false;
      
      // Log attempted security breach
      if (approvalStatus === "approved" || isFeatured === true || isFeatured === 'true' || isVerified === true || isVerified === 'true') {
        console.warn(`Security Alert: User ${req.user._id} attempted to set privileged fields without authorization`);
      }
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
      if (!parsedAttributes.square) {
        return res.status(400).json({
          success: false,
          message: 'Square footage is required for Farmland properties'
        });
      }
    }

    if (category === "JD/JV") {
      if (!parsedAttributes.typeOfJV) {
        return res.status(400).json({
          success: false,
          message: 'Type of JV is required for JD/JV properties'
        });
      }
    }

    // Create new property with SECURED fields
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
      approvalStatus: finalApprovalStatus, // Secured value
      isFeatured: finalIsFeatured,         // Secured value
      isVerified: finalIsVerified,         // Secured value
      forSale: forSale === 'true' || forSale === true,
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
    const successMessage = finalApprovalStatus === "approved" 
      ? "Property added successfully and approved! It is now live on the platform."
      : "Property added successfully! It will be visible after admin approval.";

    res.status(201).json({
      success: true,
      message: successMessage,
      property: {
        ...newProperty.toObject(),
        // Don't send sensitive info about what was attempted vs what was set
      },
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

// controllers/propertyController.js


const createPropertyn = async (req, res) => {
  try {
    let uploadedImages = [];

    // 1️⃣ If Cloudinary URLs already exist in JSON
    if (req.body.images && Array.isArray(req.body.images) && req.body.images.length > 0) {
      uploadedImages = req.body.images.map(img => ({
        url: img.url,
        public_id: img.public_id || null,
      }));
    }

    // 2️⃣ If actual files are uploaded (for fallback)
    else if (req.files && req.files.length > 0) {
      for (let file of req.files) {
        const result = await cloudinary.uploader.upload(file.path, {
          folder: "properties",
        });
        uploadedImages.push({
          url: result.secure_url,
          public_id: result.public_id,
        });
      }
    }

    // 3️⃣ Error if nothing is provided
    else {
      return res.status(400).json({
        success: false,
        message: "At least one image is required (either URL or file)",
      });
    }

    // 4️⃣ Get createdBy value
    // If user is authenticated → req.user._id
    // If no auth (like from n8n) → req.body.createdBy
    const createdBy = req.user?._id || req.body.createdBy;

    if (!createdBy) {
      return res.status(400).json({
        success: false,
        message: "Missing required field: createdBy",
      });
    }

    // 5️⃣ Create property
    const newProperty = await Property.create({
      title: req.body.title,
      description: req.body.description,
      content: req.body.content,
      city: req.body.city,
      propertyLocation: req.body.propertyLocation,
      price: req.body.price,
      category: req.body.category,
      attributes: req.body.attributes,
      features: req.body.features,
      nearby: req.body.nearby,
      images: uploadedImages,
      approvalStatus: req.body.approvalStatus || "pending",
      forSale: req.body.forSale ?? true,
      isFeatured: req.body.isFeatured ?? false,
      isVerified: req.body.isVerified ?? false,
      createdBy, // ✅ Required field
    });

    res.status(201).json({
      success: true,
      message: "Property created successfully",
      data: newProperty,
    });
  } catch (error) {
    console.error("Error creating property:", error);
    res.status(500).json({
      success: false,
      message: "Server error while creating property",
      error: error.message,
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
      website = "cleartitle", // Default to cleartitle (parent)
      page = 1,
      limit = 1000,
      sortBy = 'displayOrder',
      sortOrder = 'asc',
      search
    } = req.query;

    // Build filter object - only show approved properties
    const filter = { approvalStatus: 'approved' };
    
    // 🌐 WEBSITE FILTERING LOGIC - SIMPLIFIED
    if (website === "cleartitle") {
      // Cleartitle shows properties with "cleartitle" or "both" in websiteAssignment
      filter.websiteAssignment = { $in: ["cleartitle", "both"] };
    } else if (website === "saimr") {
      // Saimr shows properties with "saimr" or "both" in websiteAssignment
      filter.websiteAssignment = { $in: ["saimr", "both"] };
    }
    
    // Apply other filters
    if (category) filter.category = category;
    if (city) filter.city = { $regex: city, $options: 'i' };
    if (forSale) filter.forSale = forSale === 'true';
    if (isFeatured) filter.isFeatured = isFeatured === 'true';
    if (isVerified) filter.isVerified = isVerified === 'true';
    
    // Search functionality
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
        { city: { $regex: search, $options: 'i' } },
        { propertyLocation: { $regex: search, $options: 'i' } },
        { "attributes.propertyLabel": { $regex: search, $options: 'i' } }
      ];
    }
    
    // Price filter
    if (minPrice || maxPrice) {
      filter.price = { 
        $not: { $eq: "Price on Request" },
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
      total,
      website // Return which website filter was applied
    });
  } catch (error) {
    console.error("Error fetching properties:", error);
    res.status(500).json({ 
      success: false,
      message: "Server Error", 
      error: error.message 
    });
  }
};
// controllers/adminController.js

// Assign properties to websites (bulk)
// Assign properties to websites (bulk) - SIMPLIFIED
const assignPropertiesToWebsites = async (req, res) => {
  try {
    const { propertyIds, websites, action } = req.body;
    
    if (!propertyIds || !Array.isArray(propertyIds) || propertyIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please select at least one property"
      });
    }

    if (!websites || !Array.isArray(websites) || websites.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please select at least one website"
      });
    }

    // Validate websites are valid
    const validWebsites = ["cleartitle", "saimr", "both"];
    const invalidWebsites = websites.filter(w => !validWebsites.includes(w));
    if (invalidWebsites.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid website(s): ${invalidWebsites.join(', ')}. Valid options: cleartitle, saimr, both`
      });
    }

    let updateQuery = {};
    
    // Determine update based on action
    if (action === "assign") {
      // Add websites to assignment, but handle "both" specially
      if (websites.includes("both")) {
        // If assigning "both", set to ["both"]
        updateQuery = { websiteAssignment: ["both"] };
      } else {
        // Add websites, but if adding both cleartitle and saimr, set to "both"
        if (websites.includes("cleartitle") && websites.includes("saimr")) {
          updateQuery = { websiteAssignment: ["both"] };
        } else {
          updateQuery = { $addToSet: { websiteAssignment: { $each: websites } } };
        }
      }
    } else if (action === "remove") {
      // Remove websites from assignment
      if (websites.includes("both")) {
        // If removing "both", remove both websites
        updateQuery = { 
          $pull: { 
            websiteAssignment: { $in: ["both", "cleartitle", "saimr"] } 
          } 
        };
      } else {
        updateQuery = { $pullAll: { websiteAssignment: websites } };
      }
    } else if (action === "replace") {
      // Replace with new websites
      if (websites.includes("both") || (websites.includes("cleartitle") && websites.includes("saimr"))) {
        // If both websites are selected, use "both"
        updateQuery = { websiteAssignment: ["both"] };
      } else {
        updateQuery = { websiteAssignment: websites };
      }
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid action. Use 'assign', 'remove', or 'replace'"
      });
    }

    // Update properties
    const result = await Property.updateMany(
      { _id: { $in: propertyIds } },
      updateQuery
    );

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} properties updated successfully`,
      data: {
        modifiedCount: result.modifiedCount,
        websites: websites,
        action: action
      }
    });
  } catch (error) {
    console.error("Error assigning properties to websites:", error);
    res.status(500).json({
      success: false,
      message: "Error updating website assignments",
      error: error.message
    });
  }
};

// Get properties with website assignment info for admin
// Get properties with website assignment info for admin
const getPropertiesForAdmin = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 1000,
      search,
      website,
      approvalStatus
    } = req.query;

    const filter = {};
    
    // Search filter
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { city: { $regex: search, $options: 'i' } },
        { propertyLocation: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Website filter
    if (website) {
      if (website === "cleartitle") {
        filter.websiteAssignment = { $in: ["cleartitle", "both"] };
      } else if (website === "saimr") {
        filter.websiteAssignment = { $in: ["saimr", "both"] };
      } else if (website === "unassigned") {
        filter.$or = [
          { websiteAssignment: { $exists: false } },
          { websiteAssignment: { $size: 0 } },
          { websiteAssignment: { $eq: [] } }
        ];
      } else if (website === "both") {
        filter.websiteAssignment = "both";
      }
    }
    
    // Approval status filter
    if (approvalStatus) {
      filter.approvalStatus = approvalStatus;
    }

    const properties = await Property.find(filter)
      .select('title city category price approvalStatus websiteAssignment isFeatured displayOrder createdAt images agentDetails.name')
      .populate('createdBy', 'name username')
      .sort({ displayOrder: 1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Property.countDocuments(filter);

    res.status(200).json({
      success: true,
      properties,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
      filters: {
        website: website || 'all',
        search: search || '',
        approvalStatus: approvalStatus || 'all'
      }
    });
  } catch (error) {
    console.error("Error fetching properties for admin:", error);
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
  getProperties, createPropertyn,

  getPropertyById, 
  getPropertiesByUser,
  updatePropertyStatus,
  updateProperty,
  deleteProperty,getPropertiesForAdmin,assignPropertiesToWebsites
};