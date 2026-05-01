const PropertyUnit = require("../models/PropertyUnit");
const mongoose = require("mongoose");

// Get all properties created by the logged-in user
exports.getUserProperties = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, listingType, propertyType, availability } = req.query;

    const query = { createdBy: userId };
    
    if (listingType) query.listingType = listingType;
    if (propertyType) query.propertyType = propertyType;
    if (availability) query.availability = availability;

    const properties = await PropertyUnit.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('createdBy', 'name email');

    const total = await PropertyUnit.countDocuments(query);

    res.status(200).json({
      success: true,
      properties,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get single property by ID (with ownership check)
exports.getPropertyById = async (req, res) => {
  try {
    const property = await PropertyUnit.findById(req.params.id)
      .populate('createdBy', 'name email');

    if (!property) {
      return res.status(404).json({ success: false, message: "Property not found" });
    }

    // Check if user owns the property
    if (property.createdBy._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    res.status(200).json({ success: true, property });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update property
exports.updateProperty = async (req, res) => {
  try {
    const property = await PropertyUnit.findById(req.params.id);

    if (!property) {
      return res.status(404).json({ success: false, message: "Property not found" });
    }

    // Check ownership
    if (property.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: "You can only update your own properties" });
    }

    // Update fields
    const allowedUpdates = [
      'title', 'description', 'images', 'city', 'address', 'mapUrl',
      'locationNearby', 'propertyType', 'unitTypes', 'buildingDetails',
      'unitFeatures', 'commonSpecifications', 'availability', 'listingType',
      'ownerDetails', 'legalDetails', 'viewingSchedule', 'contactPreference'
    ];

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        property[field] = req.body[field];
      }
    });

    await property.save();

    res.status(200).json({
      success: true,
      message: "Property updated successfully",
      property
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete property
exports.deleteProperty = async (req, res) => {
  try {
    const property = await PropertyUnit.findById(req.params.id);

    if (!property) {
      return res.status(404).json({ success: false, message: "Property not found" });
    }

    // Check ownership
    if (property.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: "You can only delete your own properties" });
    }

    await property.deleteOne();

    res.status(200).json({
      success: true,
      message: "Property deleted successfully"
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update property status (available/sold/rented etc.)
exports.updatePropertyStatus = async (req, res) => {
  try {
    const { availability } = req.body;
    const property = await PropertyUnit.findById(req.params.id);

    if (!property) {
      return res.status(404).json({ success: false, message: "Property not found" });
    }

    if (property.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    property.availability = availability;
    await property.save();

    res.status(200).json({
      success: true,
      message: "Property status updated successfully",
      property
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Bulk delete properties
exports.bulkDeleteProperties = async (req, res) => {
  try {
    const { propertyIds } = req.body;
    const userId = req.user.id;

    const result = await PropertyUnit.deleteMany({
      _id: { $in: propertyIds },
      createdBy: userId
    });

    res.status(200).json({
      success: true,
      message: `${result.deletedCount} properties deleted successfully`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};