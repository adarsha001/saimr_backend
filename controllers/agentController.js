const Property = require("../models/property");
const User = require("../models/user");

// Admin creates property with all fields
exports.createPropertyByAdmin = async (req, res) => {
  try {
    const {
      title,
      description,
      content,
      images,
      city,
      propertyLocation,
      coordinates,
      price,
      mapUrl,
      category,
      approvalStatus,
      displayOrder,
      forSale,
      isFeatured,
      isVerified,
      rejectionReason,
      agentDetails,
      attributes,
      distanceKey,
      features,
      nearby
    } = req.body;

    // Validate required fields
    if (!title || !city || !propertyLocation || !price || !category) {
      return res.status(400).json({
        success: false,
        message: "Required fields are missing: title, city, propertyLocation, price, category"
      });
    }

    // Validate category enum
    const validCategories = ["Outright", "Commercial", "Farmland", "JD/JV"];
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category. Must be one of: Outright, Commercial, Farmland, JD/JV"
      });
    }

    // Create property with all fields
    const property = new Property({
      title,
      description: description || "",
      content: content || "",
      images: images || [],
      city,
      propertyLocation,
      coordinates: coordinates || {},
      price,
      mapUrl: mapUrl || "",
      category,
      approvalStatus: approvalStatus || "approved", // Auto-approve admin properties
      displayOrder: displayOrder || 0,
      forSale: forSale !== undefined ? forSale : true,
      isFeatured: isFeatured || false,
      isVerified: isVerified || false,
      rejectionReason: rejectionReason || "",
      agentDetails: agentDetails || {},
      attributes: {
        square: attributes?.square || "",
        propertyLabel: attributes?.propertyLabel || "",
        leaseDuration: attributes?.leaseDuration || "",
        typeOfJV: attributes?.typeOfJV || "",
        expectedROI: attributes?.expectedROI || null,
        irrigationAvailable: attributes?.irrigationAvailable || false,
        facing: attributes?.facing || "",
        roadWidth: attributes?.roadWidth || null,
        waterSource: attributes?.waterSource || "",
        soilType: attributes?.soilType || "",
        legalClearance: attributes?.legalClearance || false,
      },
      distanceKey: distanceKey || [],
      features: features || [],
      nearby: {
        Highway: nearby?.Highway || null,
        Airport: nearby?.Airport || null,
        BusStop: nearby?.BusStop || null,
        Metro: nearby?.Metro || null,
        CityCenter: nearby?.CityCenter || null,
        IndustrialArea: nearby?.IndustrialArea || null,
      },
      createdBy: req.user.id, // Admin user ID
    });

    await property.save();

    // Populate the property with creator details
    await property.populate('createdBy', 'name username userType');

    res.status(201).json({
      success: true,
      message: "Property created successfully",
      data: property
    });

  } catch (error) {
    console.error("Error creating property:", error);
    res.status(500).json({
      success: false,
      message: "Error creating property",
      error: error.message
    });
  }
};

// Update property with all fields
exports.updatePropertyByAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      content,
      images,
      city,
      propertyLocation,
      coordinates,
      price,
      mapUrl,
      category,
      approvalStatus,
      displayOrder,
      forSale,
      isFeatured,
      isVerified,
      rejectionReason,
      agentDetails,
      attributes,
      distanceKey,
      features,
      nearby
    } = req.body;

    // Build update object
    const updateData = {};
    
    // Basic fields
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (content !== undefined) updateData.content = content;
    if (images !== undefined) updateData.images = images;
    if (city !== undefined) updateData.city = city;
    if (propertyLocation !== undefined) updateData.propertyLocation = propertyLocation;
    if (coordinates !== undefined) updateData.coordinates = coordinates;
    if (price !== undefined) updateData.price = price;
    if (mapUrl !== undefined) updateData.mapUrl = mapUrl;
    if (category !== undefined) updateData.category = category;
    if (approvalStatus !== undefined) updateData.approvalStatus = approvalStatus;
    if (displayOrder !== undefined) updateData.displayOrder = displayOrder;
    if (forSale !== undefined) updateData.forSale = forSale;
    if (isFeatured !== undefined) updateData.isFeatured = isFeatured;
    if (isVerified !== undefined) updateData.isVerified = isVerified;
    if (rejectionReason !== undefined) updateData.rejectionReason = rejectionReason;
    
    // Agent details
    if (agentDetails !== undefined) {
      updateData.agentDetails = agentDetails;
    }
    
    // Attributes
    if (attributes !== undefined) {
      updateData.attributes = attributes;
    }
    
    // Arrays
    if (distanceKey !== undefined) updateData.distanceKey = distanceKey;
    if (features !== undefined) updateData.features = features;
    
    // Nearby
    if (nearby !== undefined) {
      updateData.nearby = nearby;
    }

    const property = await Property.findByIdAndUpdate(
      id,
      { $set: updateData },
      { 
        new: true, 
        runValidators: true,
        context: 'query'
      }
    ).populate('createdBy', 'name username userType');

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found"
      });
    }

    res.json({
      success: true,
      message: "Property updated successfully",
      data: property
    });

  } catch (error) {
    console.error("Error updating property:", error);
    res.status(500).json({
      success: false,
      message: "Error updating property",
      error: error.message
    });
  }
};

// Get properties with agent details and all fields
exports.getPropertiesWithAgents = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      city,
      hasAgent = false,
      approvalStatus,
      forSale,
      isFeatured,
      isVerified,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const filter = {};
    
    // Build filter object
    if (category) filter.category = category;
    if (city) filter.city = new RegExp(city, 'i');
    if (approvalStatus) filter.approvalStatus = approvalStatus;
    if (forSale !== undefined) filter.forSale = forSale === 'true';
    if (isFeatured !== undefined) filter.isFeatured = isFeatured === 'true';
    if (isVerified !== undefined) filter.isVerified = isVerified === 'true';
    
    if (hasAgent === 'true') {
      filter['agentDetails.name'] = { $exists: true, $ne: '' };
    }

    // Build sort object
    const sort = {};
    if (sortBy === 'displayOrder') {
      sort.displayOrder = -1;
      sort.createdAt = -1;
    } else if (sortBy === 'price') {
      sort.price = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'title') {
      sort.title = sortOrder === 'asc' ? 1 : -1;
    } else {
      sort.createdAt = sortOrder === 'asc' ? 1 : -1;
    }

    const properties = await Property.find(filter)
      .populate('createdBy', 'name username userType email phoneNumber')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Property.countDocuments(filter);

    res.json({
      success: true,
      data: properties,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalProperties: total,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error("Error fetching properties:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching properties",
      error: error.message
    });
  }
};

// Get single property by ID with all details
exports.getPropertyById = async (req, res) => {
  try {
    const { id } = req.params;

    const property = await Property.findById(id)
      .populate('createdBy', 'name username userType email phoneNumber');

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found"
      });
    }

    res.json({
      success: true,
      data: property
    });

  } catch (error) {
    console.error("Error fetching property:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching property",
      error: error.message
    });
  }
};

// Delete property by admin
exports.deletePropertyByAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const property = await Property.findByIdAndDelete(id);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found"
      });
    }

    res.json({
      success: true,
      message: "Property deleted successfully",
      data: property
    });

  } catch (error) {
    console.error("Error deleting property:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting property",
      error: error.message
    });
  }
};

// Bulk update properties (for features, approval status, etc.)
exports.bulkUpdateProperties = async (req, res) => {
  try {
    const { ids, updateData } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Property IDs are required"
      });
    }

    const result = await Property.updateMany(
      { _id: { $in: ids } },
      { $set: updateData }
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} properties updated successfully`,
      data: {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount
      }
    });

  } catch (error) {
    console.error("Error in bulk update:", error);
    res.status(500).json({
      success: false,
      message: "Error updating properties",
      error: error.message
    });
  }
};

// Get property statistics for admin dashboard
exports.getPropertyStats = async (req, res) => {
  try {
    const stats = await Property.aggregate([
      {
        $group: {
          _id: null,
          totalProperties: { $sum: 1 },
          totalApproved: { 
            $sum: { $cond: [{ $eq: ["$approvalStatus", "approved"] }, 1, 0] } 
          },
          totalPending: { 
            $sum: { $cond: [{ $eq: ["$approvalStatus", "pending"] }, 1, 0] } 
          },
          totalRejected: { 
            $sum: { $cond: [{ $eq: ["$approvalStatus", "rejected"] }, 1, 0] } 
          },
          totalFeatured: { 
            $sum: { $cond: ["$isFeatured", 1, 0] } 
          },
          totalVerified: { 
            $sum: { $cond: ["$isVerified", 1, 0] } 
          },
          totalWithAgents: {
            $sum: { 
              $cond: [
                { $and: [
                  { $ifNull: ["$agentDetails.name", false] },
                  { $ne: ["$agentDetails.name", ""] }
                ]}, 
                1, 0 
              ] 
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          totalProperties: 1,
          totalApproved: 1,
          totalPending: 1,
          totalRejected: 1,
          totalFeatured: 1,
          totalVerified: 1,
          totalWithAgents: 1
        }
      }
    ]);

    const categoryStats = await Property.aggregate([
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        overall: stats[0] || {},
        byCategory: categoryStats
      }
    });

  } catch (error) {
    console.error("Error fetching property stats:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching property statistics",
      error: error.message
    });
  }
};