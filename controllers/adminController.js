const Property = require('../models/property');

// ✅ Get all pending properties for review
exports.getPendingProperties = async (req, res) => {
  try {
    console.log('🔍 Fetching pending properties');
    const properties = await Property.find({ approvalStatus: 'pending' })
      .populate("createdBy", "name userType gmail phoneNumber");
    
    console.log(`📋 Found ${properties.length} pending properties`);
    res.status(200).json({ success: true, properties });
  } catch (error) {
    console.error('❌ Error fetching pending properties:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error fetching properties",
      error: error.message 
    });
  }
};

// ✅ Approve property
exports.approveProperty = async (req, res) => {
  try {
    console.log('🔍 approveProperty called with ID:', req.params.id);
    
    // Validate ID format
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid property ID format" 
      });
    }

    const property = await Property.findByIdAndUpdate(
      req.params.id,
      { 
        approvalStatus: "approved",
        rejectionReason: "", // Clear any previous rejection reason
        isVerified: true // Keep for backward compatibility
      },
      { new: true, runValidators: true }
    ).populate("createdBy", "name userType gmail phoneNumber");
    
    if (!property) {
      console.log('❌ Property not found with ID:', req.params.id);
      return res.status(404).json({ 
        success: false, 
        message: "Property not found" 
      });
    }

    console.log('✅ Property approved successfully:', property._id);
    
    res.status(200).json({ 
      success: true, 
      message: "Property approved successfully", 
      property 
    });
  } catch (error) {
    console.error('❌ Error in approveProperty:', error);
    console.error('❌ Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ 
      success: false, 
      message: "Error approving property",
      error: error.message 
    });
  }
};

// ✅ Reject property
exports.rejectProperty = async (req, res) => {
  try {
    console.log('🔍 rejectProperty called with ID:', req.params.id);
    const { reason } = req.body;

    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid property ID format" 
      });
    }

    const property = await Property.findByIdAndUpdate(
      req.params.id,
      { 
        approvalStatus: "rejected",
        rejectionReason: reason || "No reason provided",
        isVerified: false // Keep for backward compatibility
      },
      { new: true }
    ).populate("createdBy", "name userType gmail phoneNumber");
    
    if (!property) {
      return res.status(404).json({ 
        success: false, 
        message: "Property not found" 
      });
    }

    res.status(200).json({ 
      success: true, 
      message: "Property rejected", 
      property 
    });
  } catch (error) {
    console.error('❌ Error in rejectProperty:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error rejecting property",
      error: error.message 
    });
  }
};

// ✅ Toggle featured property
exports.toggleFeatured = async (req, res) => {
  try {
    console.log('🔍 toggleFeatured called with ID:', req.params.id);
    
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid property ID format" 
      });
    }

    const property = await Property.findById(req.params.id);
    if (!property) {
      return res.status(404).json({ 
        success: false, 
        message: "Property not found" 
      });
    }

    // Only allow featuring approved properties
    if (property.approvalStatus !== "approved") {
      return res.status(400).json({
        success: false,
        message: "Only approved properties can be featured"
      });
    }

    property.isFeatured = !property.isFeatured;
    await property.save();

    res.status(200).json({
      success: true,
      message: `Property ${property.isFeatured ? "marked as featured" : "removed from featured"}`,
      property
    });
  } catch (error) {
    console.error('❌ Error in toggleFeatured:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error toggling featured property",
      error: error.message 
    });
  }
};

// ✅ Get properties by approval status (for admin dashboard)
exports.getPropertiesByStatus = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    // Validate status
    const validStatuses = ["pending", "approved", "rejected"];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const filter = status ? { approvalStatus: status } : {};
    
    const properties = await Property.find(filter)
      .populate("createdBy", "name userType gmail phoneNumber")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Property.countDocuments(filter);

    res.status(200).json({
      success: true,
      properties,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    console.error('❌ Error in getPropertiesByStatus:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error fetching properties",
      error: error.message 
    });
  }
};