const PropertyUnit = require("../models/PropertyUnit");
const User = require("../models/user");
const cloudinary = require("../config/cloudinary");
const mongoose = require('mongoose');

// ✅ Get all property units (Admin only)
const getAllPropertyUnits = async (req, res) => {
  try {
    const {
      search,
      city,
      propertyType,
      approvalStatus,
      isFeatured,
      isVerified,
      availability,
      listingType,
      createdBy,
      page = 1,
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter
    const filter = {};

    // Search filter
    if (search && search.trim() !== '') {
      const searchRegex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { title: searchRegex },
        { description: searchRegex },
        { address: searchRegex },
        { city: searchRegex },
        { 'buildingDetails.name': searchRegex },
        { unitNumber: searchRegex }
      ];
    }

    // Apply filters
    if (city && city.trim() !== '') {
      filter.city = new RegExp(city.trim(), 'i');
    }
    
    if (propertyType && propertyType.trim() !== '') {
      filter.propertyType = propertyType.trim();
    }
    
    if (approvalStatus && approvalStatus.trim() !== '') {
      filter.approvalStatus = approvalStatus.trim();
    }
    
    if (isFeatured !== undefined && isFeatured !== '') {
      filter.isFeatured = isFeatured === 'true';
    }
    
    if (isVerified !== undefined && isVerified !== '') {
      filter.isVerified = isVerified === 'true';
    }
    
    if (availability && availability.trim() !== '') {
      filter.availability = availability.trim();
    }
    
    if (listingType && listingType.trim() !== '') {
      filter.listingType = listingType.trim();
    }
    
    if (createdBy && createdBy.trim() !== '') {
      filter.createdBy = createdBy.trim();
    }

    // Calculate pagination
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(Math.max(1, parseInt(limit) || 50), 200);
    const skip = (pageNum - 1) * limitNum;

    // Build sort object
    let sort = {};
    
    const allowedSortFields = {
      'createdAt': 'createdAt',
      'updatedAt': 'updatedAt',
      'title': 'title',
      'city': 'city',
      'price': 'price',
      'displayOrder': 'displayOrder',
      'viewCount': 'viewCount',
      'approvalStatus': 'approvalStatus',
      'isFeatured': 'isFeatured',
      'isVerified': 'isVerified'
    };

    const sortField = allowedSortFields[sortBy] || 'createdAt';
    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    
    sort[sortField] = sortDirection;

    // Execute query
    const query = PropertyUnit.find(filter);
    
    if (Object.keys(sort).length > 0) {
      query.sort(sort);
    }
    
    const propertyUnits = await query
      .skip(skip)
      .limit(limitNum)
      .populate('createdBy', 'name email phoneNumber avatar userType')
      .populate('parentProperty', 'name title images')
      .lean();

    // Get total count
    const total = await PropertyUnit.countDocuments(filter);

    // Get stats for filters
    const cities = await PropertyUnit.distinct('city').sort();
    const propertyTypes = await PropertyUnit.distinct('propertyType').sort();
    const approvalStatuses = await PropertyUnit.distinct('approvalStatus').sort();

    res.status(200).json({
      success: true,
      count: propertyUnits.length,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      data: propertyUnits,
      filters: {
        cities,
        propertyTypes,
        approvalStatuses
      }
    });

  } catch (error) {
    console.error('Get all property units error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching property units',
      error: error.message
    });
  }
};

// ✅ Get property unit by ID (Admin)
const getPropertyUnitByIdAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid property unit ID"
      });
    }

    const propertyUnit = await PropertyUnit.findById(id)
      .populate('createdBy', 'name email phoneNumber avatar userType')
      .populate('parentProperty', 'name title images')
      .lean();

    if (!propertyUnit) {
      return res.status(404).json({
        success: false,
        message: "Property unit not found"
      });
    }

    res.status(200).json({
      success: true,
      data: propertyUnit
    });

  } catch (error) {
    console.error('Get property unit by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching property unit',
      error: error.message
    });
  }
};

// ✅ Get property unit stats
const getPropertyUnitStats = async (req, res) => {
  try {
    const total = await PropertyUnit.countDocuments({});
    const approved = await PropertyUnit.countDocuments({ approvalStatus: 'approved' });
    const pending = await PropertyUnit.countDocuments({ approvalStatus: 'pending' });
    const rejected = await PropertyUnit.countDocuments({ approvalStatus: 'rejected' });
    const featured = await PropertyUnit.countDocuments({ isFeatured: true });
    const verified = await PropertyUnit.countDocuments({ isVerified: true });
    
    // Count by property type
    const propertyTypeStats = await PropertyUnit.aggregate([
      { $group: { _id: '$propertyType', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    // Count by city
    const cityStats = await PropertyUnit.aggregate([
      { $match: { city: { $ne: null, $ne: '' } } },
      { $group: { _id: '$city', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    
    // Recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentAdded = await PropertyUnit.countDocuments({
      createdAt: { $gte: sevenDaysAgo }
    });

    res.status(200).json({
      success: true,
      data: {
        total,
        approved,
        pending,
        rejected,
        featured,
        verified,
        propertyTypeStats,
        cityStats,
        recentAdded
      }
    });

  } catch (error) {
    console.error('Get property unit stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching stats',
      error: error.message
    });
  }
};

// ✅ Create property unit (Admin)
const createPropertyUnitAdmin = async (req, res) => {
  try {
    // This is similar to your existing createPropertyUnit function
    // but with admin privileges
    const { ...data } = req.body;
    
    // Admin can set all fields directly
    const propertyUnit = new PropertyUnit({
      ...data,
      createdBy: req.user._id
    });

    await propertyUnit.save();

    res.status(201).json({
      success: true,
      message: 'Property unit created successfully',
      data: propertyUnit
    });

  } catch (error) {
    console.error('Create property unit admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating property unit',
      error: error.message
    });
  }
};

// ✅ Update property unit (Admin)
const updatePropertyUnitAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const propertyUnit = await PropertyUnit.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
    .populate('createdBy', 'name email phoneNumber')
    .populate('parentProperty', 'title');

    if (!propertyUnit) {
      return res.status(404).json({
        success: false,
        message: 'Property unit not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Property unit updated successfully',
      data: propertyUnit
    });

  } catch (error) {
    console.error('Update property unit admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating property unit',
      error: error.message
    });
  }
};

// ✅ Delete property unit (Admin)
const deletePropertyUnitAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const propertyUnit = await PropertyUnit.findById(id);
    if (!propertyUnit) {
      return res.status(404).json({
        success: false,
        message: 'Property unit not found'
      });
    }

    // Delete images from Cloudinary
    if (propertyUnit.images && propertyUnit.images.length > 0) {
      for (const image of propertyUnit.images) {
        if (image.public_id) {
          try {
            await cloudinary.uploader.destroy(image.public_id);
          } catch (cloudinaryError) {
            console.error('Error deleting image from Cloudinary:', cloudinaryError);
          }
        }
      }
    }

    await PropertyUnit.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Property unit deleted successfully'
    });

  } catch (error) {
    console.error('Delete property unit admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting property unit',
      error: error.message
    });
  }
};

// ✅ Update approval status
const updateApprovalStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { approvalStatus, rejectionReason } = req.body;

    if (!['pending', 'approved', 'rejected'].includes(approvalStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid approval status'
      });
    }

    const updateData = { approvalStatus };
    
    if (approvalStatus === 'rejected' && rejectionReason) {
      updateData.rejectionReason = rejectionReason;
    } else if (approvalStatus !== 'rejected') {
      updateData.rejectionReason = '';
    }

    const propertyUnit = await PropertyUnit.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    if (!propertyUnit) {
      return res.status(404).json({
        success: false,
        message: 'Property unit not found'
      });
    }

    res.status(200).json({
      success: true,
      message: `Property unit ${approvalStatus} successfully`,
      data: propertyUnit
    });

  } catch (error) {
    console.error('Update approval status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating approval status',
      error: error.message
    });
  }
};

// ✅ Toggle featured
const toggleFeatured = async (req, res) => {
  try {
    const { id } = req.params;
    
    const propertyUnit = await PropertyUnit.findById(id);
    if (!propertyUnit) {
      return res.status(404).json({
        success: false,
        message: 'Property unit not found'
      });
    }

    propertyUnit.isFeatured = !propertyUnit.isFeatured;
    await propertyUnit.save();

    res.status(200).json({
      success: true,
      message: `Property unit ${propertyUnit.isFeatured ? 'featured' : 'unfeatured'} successfully`,
      data: propertyUnit
    });

  } catch (error) {
    console.error('Toggle featured error:', error);
    res.status(500).json({
      success: false,
      message: 'Error toggling featured status',
      error: error.message
    });
  }
};

// ✅ Toggle verified
const toggleVerified = async (req, res) => {
  try {
    const { id } = req.params;
    
    const propertyUnit = await PropertyUnit.findById(id);
    if (!propertyUnit) {
      return res.status(404).json({
        success: false,
        message: 'Property unit not found'
      });
    }

    propertyUnit.isVerified = !propertyUnit.isVerified;
    await propertyUnit.save();

    res.status(200).json({
      success: true,
      message: `Property unit ${propertyUnit.isVerified ? 'verified' : 'unverified'} successfully`,
      data: propertyUnit
    });

  } catch (error) {
    console.error('Toggle verified error:', error);
    res.status(500).json({
      success: false,
      message: 'Error toggling verified status',
      error: error.message
    });
  }
};

// ✅ Bulk update property units
const bulkUpdatePropertyUnits = async (req, res) => {
  try {
    const { ids, ...updateData } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Property IDs array is required'
      });
    }

    const updates = ids.map(id => ({
      updateOne: {
        filter: { _id: id },
        update: { $set: updateData }
      }
    }));

    const result = await PropertyUnit.bulkWrite(updates);

    res.status(200).json({
      success: true,
      message: `Updated ${result.modifiedCount} properties`,
      modifiedCount: result.modifiedCount
    });

  } catch (error) {
    console.error('Bulk update error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating properties',
      error: error.message
    });
  }
};

// ✅ Bulk delete property units
const bulkDeletePropertyUnits = async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Property IDs array is required'
      });
    }

    // Get properties to delete images from Cloudinary
    const properties = await PropertyUnit.find({ _id: { $in: ids } });
    
    // Delete images from Cloudinary
    for (const property of properties) {
      if (property.images && property.images.length > 0) {
        for (const image of property.images) {
          if (image.public_id) {
            try {
              await cloudinary.uploader.destroy(image.public_id);
            } catch (cloudinaryError) {
              console.error('Error deleting image from Cloudinary:', cloudinaryError);
            }
          }
        }
      }
    }

    const result = await PropertyUnit.deleteMany({ _id: { $in: ids } });

    res.status(200).json({
      success: true,
      message: `Deleted ${result.deletedCount} properties`,
      deletedCount: result.deletedCount
    });

  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting properties',
      error: error.message
    });
  }
};

// ✅ Update display orders
const updateDisplayOrders = async (req, res) => {
  try {
    const { displayOrders } = req.body;
    
    if (!Array.isArray(displayOrders) || displayOrders.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Display orders array is required'
      });
    }

    const updates = displayOrders.map(order => ({
      updateOne: {
        filter: { _id: order.id },
        update: { $set: { displayOrder: order.displayOrder } }
      }
    }));

    const result = await PropertyUnit.bulkWrite(updates);

    res.status(200).json({
      success: true,
      message: `Display orders updated for ${result.modifiedCount} properties`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Update display orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating display orders',
      error: error.message
    });
  }
};

// ✅ Update single display order
const updateSingleDisplayOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { displayOrder } = req.body;

    if (displayOrder === undefined || displayOrder === null) {
      return res.status(400).json({
        success: false,
        message: 'Display order is required'
      });
    }

    const propertyUnit = await PropertyUnit.findByIdAndUpdate(
      id,
      { displayOrder: parseInt(displayOrder) },
      { new: true }
    );

    if (!propertyUnit) {
      return res.status(404).json({
        success: false,
        message: 'Property unit not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Display order updated successfully',
      data: propertyUnit
    });
  } catch (error) {
    console.error('Update single display order error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating display order',
      error: error.message
    });
  }
};

module.exports = {
  getAllPropertyUnits,
  getPropertyUnitByIdAdmin,
  createPropertyUnitAdmin,
  updatePropertyUnitAdmin,
  deletePropertyUnitAdmin,
  updateApprovalStatus,
  toggleFeatured,
  toggleVerified,
  getPropertyUnitStats,
  bulkUpdatePropertyUnits,
  bulkDeletePropertyUnits,
  updateDisplayOrders,
  updateSingleDisplayOrder
};