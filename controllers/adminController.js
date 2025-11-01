const Property = require('../models/property');
const User = require('../models/user'); 
// In adminController.js - Add this import at the top
const ClickAnalytics = require('../models/ClickAnalytics');
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

// ✅ Get all users with their liked properties
exports.getAllUsersWithLikes = async (req, res) => {
  try {
    console.log('🔍 Fetching all users with liked properties');
    
    const { page = 1, limit = 10, search } = req.query;

    // Build filter object
    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
        { gmail: { $regex: search, $options: 'i' } },
        { userType: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(filter)
      .select('-password') // Exclude password
      .populate({
        path: 'likedProperties.property',
        select: 'title city price images category approvalStatus isVerified',
        populate: {
          path: 'createdBy',
          select: 'name username'
        }
      })
      .populate({
        path: 'postedProperties.property',
        select: 'title city price images category approvalStatus',
        match: { approvalStatus: { $in: ['approved', 'pending'] } } // Only get active properties
      })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(filter);

    // Transform the data to include counts and relevant information
    const transformedUsers = users.map(user => ({
      _id: user._id,
      username: user.username,
      name: user.name,
      lastName: user.lastName,
      userType: user.userType,
      isAdmin: user.isAdmin,
      gmail: user.gmail,
      phoneNumber: user.phoneNumber,
      likedPropertiesCount: user.likedProperties.length,
      postedPropertiesCount: user.postedProperties.length,
      likedProperties: user.likedProperties.map(like => ({
        _id: like.property?._id,
        title: like.property?.title,
        city: like.property?.city,
        price: like.property?.price,
        category: like.property?.category,
        approvalStatus: like.property?.approvalStatus,
        isVerified: like.property?.isVerified,
        image: like.property?.images?.[0]?.url,
        likedAt: like.likedAt,
        createdBy: like.property?.createdBy
      })).filter(like => like._id), // Filter out null properties
      postedProperties: user.postedProperties.map(post => ({
        _id: post.property?._id,
        title: post.property?.title,
        city: post.property?.city,
        price: post.property?.price,
        category: post.property?.category,
        approvalStatus: post.property?.approvalStatus,
        postedAt: post.postedAt,
        status: post.status
      })).filter(post => post._id), // Filter out null properties
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }));

    res.status(200).json({
      success: true,
      users: transformedUsers,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    console.error('❌ Error fetching users with likes:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error fetching users",
      error: error.message 
    });
  }
};

// ✅ Get user details by ID with full property information
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid user ID format" 
      });
    }

    const user = await User.findById(id)
      .select('-password')
      .populate({
        path: 'likedProperties.property',
        select: 'title description city propertyLocation price images category approvalStatus isFeatured isVerified attributes features nearby createdAt',
        populate: {
          path: 'createdBy',
          select: 'name username gmail phoneNumber'
        }
      })
      .populate({
        path: 'postedProperties.property',
        select: 'title description city propertyLocation price images category approvalStatus isFeatured isVerified attributes features nearby createdAt',
        populate: {
          path: 'createdBy',
          select: 'name username gmail phoneNumber'
        }
      });

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: "User not found" 
      });
    }

    res.status(200).json({
      success: true,
      user: {
        _id: user._id,
        username: user.username,
        name: user.name,
        lastName: user.lastName,
        userType: user.userType,
        isAdmin: user.isAdmin,
        gmail: user.gmail,
        phoneNumber: user.phoneNumber,
        likedProperties: user.likedProperties.map(like => ({
          ...like.property?.toObject(),
          likedAt: like.likedAt
        })).filter(like => like._id),
        postedProperties: user.postedProperties.map(post => ({
          ...post.property?.toObject(),
          postedAt: post.postedAt,
          status: post.status
        })).filter(post => post._id),
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    console.error('❌ Error fetching user details:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error fetching user details",
      error: error.message 
    });
  }
};
// ✅ Debug version of getAllProperties
exports.getAllProperties = async (req, res) => {
  try {
    console.log('🔍 getAllProperties route hit');
    
    const {
      page = 1,
      limit = 10,
      search,
      category,
      city,
      approvalStatus,
      isFeatured,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    console.log('📨 Query parameters:', {
      page, limit, search, category, city, approvalStatus, isFeatured, sortBy, sortOrder
    });

    // Build filter - START EMPTY to see all properties
    const filter = {};
    
    console.log('🔍 Initial empty filter');

    // Get ALL properties first to see what exists
    const allProperties = await Property.find({})
      .populate('createdBy', 'name username')
      .limit(5); // Just get a few to see

    console.log('📊 Sample properties in database:');
    allProperties.forEach(prop => {
      console.log(`- ${prop.title} | ${prop.approvalStatus} | ${prop.isFeatured} | ${prop.category}`);
    });

    // Only add filters if they are provided and not empty
    if (search && search.trim() !== '') {
      filter.title = { $regex: search, $options: 'i' };
      console.log(`🔍 Added search filter: ${search}`);
    }
    
    if (category && category.trim() !== '') {
      filter.category = category;
      console.log(`🔍 Added category filter: ${category}`);
    }
    
    if (approvalStatus && approvalStatus.trim() !== '') {
      filter.approvalStatus = approvalStatus;
      console.log(`🔍 Added approvalStatus filter: ${approvalStatus}`);
    }
    
    if (isFeatured && isFeatured.trim() !== '') {
      filter.isFeatured = isFeatured === 'true';
      console.log(`🔍 Added isFeatured filter: ${isFeatured}`);
    }

    console.log('🎯 Final filter being applied:', JSON.stringify(filter, null, 2));

    // Convert to numbers
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Simple sort
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    console.log(`📊 Finding properties with filter...`);
    
    const properties = await Property.find(filter)
      .populate('createdBy', 'name username gmail phoneNumber')
      .sort(sortOptions)
      .limit(limitNum)
      .skip(skip);

    const total = await Property.countDocuments(filter);

    console.log(`✅ Found ${properties.length} properties out of ${total} total`);

    // Get counts for different statuses
    const pendingCount = await Property.countDocuments({ approvalStatus: 'pending' });
    const approvedCount = await Property.countDocuments({ approvalStatus: 'approved' });
    const rejectedCount = await Property.countDocuments({ approvalStatus: 'rejected' });
    const featuredCount = await Property.countDocuments({ isFeatured: true });
    const totalCount = await Property.countDocuments({});

    console.log('📈 Database counts:', {
      pending: pendingCount,
      approved: approvedCount,
      rejected: rejectedCount,
      featured: featuredCount,
      total: totalCount
    });

    res.status(200).json({
      success: true,
      properties,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      total,
      counts: {
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
        featured: featuredCount,
        total: totalCount
      }
    });

  } catch (error) {
    console.error('❌ Error in getAllProperties:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      success: false, 
      message: "Error fetching properties: " + error.message,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};
// ✅ Update property order/priority
exports.updatePropertyOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { displayOrder, isFeatured } = req.body;

    console.log('🔄 Updating property order:', { id, displayOrder, isFeatured });

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid property ID format" 
      });
    }

    const updateData = {};
    if (displayOrder !== undefined) updateData.displayOrder = parseInt(displayOrder);
    if (isFeatured !== undefined) updateData.isFeatured = isFeatured;

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
      message: "Property updated successfully",
      property
    });
  } catch (error) {
    console.error('❌ Error updating property order:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error updating property",
      error: error.message 
    });
  }
};

// ✅ Bulk update properties (verify, feature, etc.)
exports.bulkUpdateProperties = async (req, res) => {
  try {
    const { propertyIds, action, value, reason } = req.body;

    console.log('🔄 Bulk updating properties:', { propertyIds, action, value, reason });

    if (!propertyIds || !Array.isArray(propertyIds) || propertyIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: "No property IDs provided" 
      });
    }

    if (!['approvalStatus', 'isFeatured'].includes(action)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid action" 
      });
    }

    const updateData = {};
    if (action === 'approvalStatus') {
      if (!['pending', 'approved', 'rejected'].includes(value)) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid approval status" 
        });
      }
      updateData.approvalStatus = value;
      if (value === 'rejected') {
        updateData.rejectionReason = reason || "No reason provided";
      } else {
        updateData.rejectionReason = "";
      }
    } else if (action === 'isFeatured') {
      updateData.isFeatured = value === 'true' || value === true;
    }

    const result = await Property.updateMany(
      { _id: { $in: propertyIds } },
      updateData,
      { runValidators: true }
    );

    // Get updated properties
    const updatedProperties = await Property.find({ _id: { $in: propertyIds } })
      .populate('createdBy', 'name username gmail phoneNumber');

    res.status(200).json({
      success: true,
      message: `Successfully updated ${result.modifiedCount} properties`,
      updatedCount: result.modifiedCount,
      properties: updatedProperties
    });
  } catch (error) {
    console.error('❌ Error in bulk update:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error updating properties",
      error: error.message 
    });
  }
};

// ✅ Get property statistics for dashboard
exports.getPropertyStats = async (req, res) => {
  try {
    const totalProperties = await Property.countDocuments();
    const pendingProperties = await Property.countDocuments({ approvalStatus: 'pending' });
    const approvedProperties = await Property.countDocuments({ approvalStatus: 'approved' });
    const featuredProperties = await Property.countDocuments({ isFeatured: true });
    
    // Properties by category
    const propertiesByCategory = await Property.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      }
    ]);

    // Properties by city
    const propertiesByCity = await Property.aggregate([
      {
        $group: {
          _id: '$city',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Recent activity (last 7 days)
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const recentProperties = await Property.countDocuments({
      createdAt: { $gte: oneWeekAgo }
    });

    res.status(200).json({
      success: true,
      stats: {
        total: totalProperties,
        pending: pendingProperties,
        approved: approvedProperties,
        featured: featuredProperties,
        recent: recentProperties,
        byCategory: propertiesByCategory,
        byCity: propertiesByCity
      }
    });
  } catch (error) {
    console.error('❌ Error fetching property stats:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error fetching statistics",
      error: error.message 
    });
  }
};

// ✅ Get all users with their liked properties (make sure this exists)
exports.getAllUsersWithLikes = async (req, res) => {
  try {
    console.log('🔍 Fetching all users with liked properties');
    
    const { page = 1, limit = 10, search } = req.query;

    // Build filter object
    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
        { gmail: { $regex: search, $options: 'i' } },
        { userType: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(filter)
      .select('-password')
      .populate({
        path: 'likedProperties.property',
        select: 'title city price images category approvalStatus isVerified',
        model: 'Property'
      })
      .populate({
        path: 'postedProperties.property',
        select: 'title city price images category approvalStatus',
        model: 'Property'
      })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(filter);

    // Transform the data
    const transformedUsers = users.map(user => ({
      _id: user._id,
      username: user.username,
      name: user.name,
      lastName: user.lastName,
      userType: user.userType,
      isAdmin: user.isAdmin,
      gmail: user.gmail,
      phoneNumber: user.phoneNumber,
      likedPropertiesCount: user.likedProperties.length,
      postedPropertiesCount: user.postedProperties.length,
      likedProperties: user.likedProperties.map(like => ({
        _id: like.property?._id,
        title: like.property?.title,
        city: like.property?.city,
        price: like.property?.price,
        category: like.property?.category,
        approvalStatus: like.property?.approvalStatus,
        isVerified: like.property?.isVerified,
        image: like.property?.images?.[0]?.url,
        likedAt: like.likedAt,
        createdBy: like.property?.createdBy
      })).filter(like => like._id),
      postedProperties: user.postedProperties.map(post => ({
        _id: post.property?._id,
        title: post.property?.title,
        city: post.property?.city,
        price: post.property?.price,
        category: post.property?.category,
        approvalStatus: post.property?.approvalStatus,
        postedAt: post.postedAt,
        status: post.status
      })).filter(post => post._id),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }));

    res.status(200).json({
      success: true,
      users: transformedUsers,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    console.error('❌ Error fetching users with likes:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error fetching users",
      error: error.message 
    });
  }
};

// ✅ Get user by ID (make sure this exists)
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid user ID format" 
      });
    }

    const user = await User.findById(id)
      .select('-password')
      .populate({
        path: 'likedProperties.property',
        select: 'title description city propertyLocation price images category approvalStatus isFeatured isVerified attributes features nearby createdAt',
        model: 'Property'
      })
      .populate({
        path: 'postedProperties.property',
        select: 'title description city propertyLocation price images category approvalStatus isFeatured isVerified attributes features nearby createdAt',
        model: 'Property'
      });

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: "User not found" 
      });
    }

    res.status(200).json({
      success: true,
      user: {
        _id: user._id,
        username: user.username,
        name: user.name,
        lastName: user.lastName,
        userType: user.userType,
        isAdmin: user.isAdmin,
        gmail: user.gmail,
        phoneNumber: user.phoneNumber,
        likedProperties: user.likedProperties.map(like => ({
          ...like.property?.toObject(),
          likedAt: like.likedAt
        })).filter(like => like._id),
        postedProperties: user.postedProperties.map(post => ({
          ...post.property?.toObject(),
          postedAt: post.postedAt,
          status: post.status
        })).filter(post => post._id),
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    console.error('❌ Error fetching user details:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error fetching user details",
      error: error.message 
    });
  }
};

// ✅ Update property details (Admin only)
exports.updateProperty = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🔄 Admin updating property:', id);

    // Validate ID format
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid property ID format" 
      });
    }

    // Find the property first
    const existingProperty = await Property.findById(id);
    if (!existingProperty) {
      return res.status(404).json({ 
        success: false, 
        message: "Property not found" 
      });
    }

    // Define allowed fields that admin can update
    const allowedUpdates = {
      basic: [
        'title', 'description', 'content', 'city', 'propertyLocation', 
        'coordinates', 'price', 'mapUrl', 'category', 'displayOrder',
        'forSale', 'isFeatured', 'isVerified', 'approvalStatus', 'rejectionReason'
      ],
      attributes: [
        'square', 'propertyLabel', 'leaseDuration', 'typeOfJV', 'expectedROI',
        'irrigationAvailable', 'facing', 'roadWidth', 'waterSource', 'soilType',
        'legalClearance'
      ],
      arrays: ['features', 'distanceKey'],
      objects: ['nearby', 'images']
    };

    // Build update object
    const updateData = {};
    
    // Update basic fields
    allowedUpdates.basic.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    // Update attributes
    if (req.body.attributes) {
      updateData.attributes = { ...existingProperty.attributes._doc };
      allowedUpdates.attributes.forEach(field => {
        if (req.body.attributes[field] !== undefined) {
          updateData.attributes[field] = req.body.attributes[field];
        }
      });
    }

    // Update arrays
    allowedUpdates.arrays.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    // Update nearby distances
    if (req.body.nearby) {
      updateData.nearby = { ...existingProperty.nearby._doc };
      Object.keys(req.body.nearby).forEach(key => {
        if (req.body.nearby[key] !== undefined) {
          updateData.nearby[key] = req.body.nearby[key];
        }
      });
    }

    // Update images (with validation)
    if (req.body.images) {
      if (!Array.isArray(req.body.images)) {
        return res.status(400).json({
          success: false,
          message: 'Images must be an array'
        });
      }
      
      // Validate each image has required fields
      const invalidImages = req.body.images.filter(img => !img.url);
      if (invalidImages.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'All images must have a URL'
        });
      }
      
      updateData.images = req.body.images;
    }

    // Validate category-specific fields
    if (updateData.category) {
      const validationError = validateCategorySpecificFields(updateData, existingProperty);
      if (validationError) {
        return res.status(400).json({
          success: false,
          message: validationError
        });
      }
    }

    console.log('📝 Update data:', JSON.stringify(updateData, null, 2));

    // Update the property
    const updatedProperty = await Property.findByIdAndUpdate(
      id,
      { $set: updateData },
      { 
        new: true, 
        runValidators: true 
      }
    ).populate('createdBy', 'name username gmail phoneNumber');

    console.log('✅ Property updated successfully');

    res.status(200).json({
      success: true,
      message: 'Property updated successfully',
      property: updatedProperty
    });

  } catch (error) {
    console.error('❌ Error updating property:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors
      });
    }
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid property ID'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error updating property',
      error: error.message
    });
  }
};

// ✅ Partial update for specific fields (Admin only)
exports.patchProperty = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    console.log('🔧 Patching property:', id, 'with updates:', updates);

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid property ID format" 
      });
    }

    // Remove restricted fields
    const restrictedFields = ['_id', 'createdBy', 'createdAt'];
    restrictedFields.forEach(field => delete updates[field]);

    // If updating approvalStatus to rejected, require rejectionReason
    if (updates.approvalStatus === 'rejected' && !updates.rejectionReason) {
      updates.rejectionReason = "No reason provided";
    }

    // If updating approvalStatus to approved, clear rejectionReason
    if (updates.approvalStatus === 'approved') {
      updates.rejectionReason = "";
      updates.isVerified = true;
    }

    const property = await Property.findByIdAndUpdate(
      id,
      { $set: updates },
      { 
        new: true, 
        runValidators: true 
      }
    ).populate('createdBy', 'name username gmail phoneNumber');

    if (!property) {
      return res.status(404).json({ 
        success: false, 
        message: "Property not found" 
      });
    }

    res.status(200).json({
      success: true,
      message: 'Property updated successfully',
      property
    });

  } catch (error) {
    console.error('❌ Error patching property:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error updating property',
      error: error.message
    });
  }
};

// Helper function to validate category-specific fields
function validateCategorySpecificFields(updateData, existingProperty) {
  const category = updateData.category || existingProperty.category;
  
  switch (category) {
    case 'JD/JV':
      if (updateData.attributes && !updateData.attributes.typeOfJV) {
        return 'JD/JV properties require typeOfJV field';
      }
      break;
      
    case 'Farmland':
      if (updateData.attributes && updateData.attributes.irrigationAvailable === undefined) {
        return 'Farmland properties require irrigationAvailable field';
      }
      break;
      
    case 'Commercial':
      if (updateData.attributes && !updateData.attributes.expectedROI) {
        return 'Commercial properties require expectedROI field';
      }
      break;
      
    case 'Outright':
      if (updateData.attributes && updateData.attributes.legalClearance === undefined) {
        return 'Outright properties require legalClearance field';
      }
      break;
  }
  
  return null;
}
// Click Analytics Functions
exports.getClickAnalytics = async (req, res) => {
  try {
    const { timeframe = '7d', type, propertyId } = req.query;
    
    // Calculate date range
    const dateRange = calculateDateRange(timeframe);
    
    // Build match query
    const matchQuery = {
      timestamp: { $gte: dateRange.start, $lte: dateRange.end }
    };
    
    if (type) matchQuery.itemType = type;
    if (propertyId) matchQuery.propertyId = propertyId;

    // Get summary stats
    const summary = await ClickAnalytics.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalClicks: { $sum: 1 },
          uniqueItems: { $addToSet: '$itemValue' },
          uniqueUsers: { $addToSet: '$userId' },
          uniqueSessions: { $addToSet: '$sessionId' }
        }
      },
      {
        $project: {
          totalClicks: 1,
          uniqueItemsCount: { $size: '$uniqueItems' },
          uniqueUsersCount: { $size: '$uniqueUsers' },
          uniqueSessionsCount: { $size: '$uniqueSessions' },
          avgClicksPerItem: { $divide: ['$totalClicks', { $size: '$uniqueItems' }] }
        }
      }
    ]);

    // Get clicks by type
    const clicksByType = await ClickAnalytics.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$itemType',
          totalClicks: { $sum: 1 },
          itemsCount: { $addToSet: '$itemValue' },
          mostClicked: { 
            $first: {
              $arrayElemAt: [
                {
                  $slice: [
                    {
                      $getField: {
                        field: 'v',
                        input: {
                          $max: {
                            $map: {
                              input: { $objectToArray: '$counts' },
                              as: 'item',
                              in: { k: '$$item.k', v: '$$item.v' }
                            }
                          }
                        }
                      }
                    },
                    0
                  ]
                },
                0
              ]
            }
          }
        }
      },
      {
        $project: {
          itemType: '$_id',
          totalClicks: 1,
          itemsCount: { $size: '$itemsCount' },
          mostClicked: '$mostClicked.k',
          avgClicks: { $divide: ['$totalClicks', { $size: '$itemsCount' }] }
        }
      },
      { $sort: { totalClicks: -1 } }
    ]);

    // Get popular clicks
exports.popularClicks = await ClickAnalytics.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            itemType: '$itemType',
            itemValue: '$itemValue',
            displayName: '$displayName'
          },
          clickCount: { $sum: 1 },
          lastClicked: { $max: '$timestamp' }
        }
      },
      {
        $project: {
          _id: 1,
          itemType: '$_id.itemType',
          itemValue: '$_id.itemValue',
          displayName: '$_id.displayName',
          clickCount: 1,
          lastClicked: 1
        }
      },
      { $sort: { clickCount: -1 } },
      { $limit: 20 }
    ]);

    // Get daily trends
    const dailyTrends = await ClickAnalytics.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$timestamp'
            }
          },
          clicks: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' }
        }
      },
      {
        $project: {
          date: '$_id',
          clicks: 1,
          uniqueUsers: { $size: '$uniqueUsers' }
        }
      },
      { $sort: { date: 1 } }
    ]);

    res.json({
      success: true,
      data: {
        summary: summary[0] || {
          totalClicks: 0,
          uniqueItemsCount: 0,
          uniqueUsersCount: 0,
          uniqueSessionsCount: 0,
          avgClicksPerItem: 0
        },
        clicksByType,
        popularClicks,
        dailyTrends,
        timeframe,
        dateRange
      }
    });

  } catch (error) {
    console.error('Get click analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch click analytics'
    });
  }
};

exports.getClickStatsByType = async (req, res) => {
  try {
    const { timeframe = '30d' } = req.query;
    const dateRange = calculateDateRange(timeframe);

    const stats = await ClickAnalytics.aggregate([
      { 
        $match: { 
          timestamp: { $gte: dateRange.start, $lte: dateRange.end } 
        } 
      },
      {
        $group: {
          _id: '$itemType',
          totalClicks: { $sum: 1 },
          uniqueItems: { $addToSet: '$itemValue' },
          topItems: {
            $push: {
              itemValue: '$itemValue',
              displayName: '$displayName'
            }
          }
        }
      },
      {
        $project: {
          itemType: '$_id',
          totalClicks: 1,
          itemsCount: { $size: '$uniqueItems' },
          topItems: {
            $slice: [
              {
                $map: {
                  input: '$topItems',
                  as: 'item',
                  in: {
                    itemValue: '$$item.itemValue',
                    displayName: '$$item.displayName',
                    count: {
                      $size: {
                        $filter: {
                          input: '$topItems',
                          as: 'i',
                          cond: { $eq: ['$$i.itemValue', '$$item.itemValue'] }
                        }
                      }
                    }
                  }
                }
              },
              0,
              5
            ]
          },
          avgClicksPerItem: { $divide: ['$totalClicks', { $size: '$uniqueItems' }] }
        }
      },
      { $sort: { totalClicks: -1 } }
    ]);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Get click stats by type error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch click stats by type'
    });
  }
};

exports.getPopularClicks = async (req, res) => {
  try {
    const { timeframe = '7d', limit = 10 } = req.query;
    const dateRange = calculateDateRange(timeframe);

    const popularClicks = await ClickAnalytics.aggregate([
      { 
        $match: { 
          timestamp: { $gte: dateRange.start, $lte: dateRange.end } 
        } 
      },
      {
        $group: {
          _id: {
            itemType: '$itemType',
            itemValue: '$itemValue',
            displayName: '$displayName'
          },
          clickCount: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' },
          lastClicked: { $max: '$timestamp' },
          firstClicked: { $min: '$timestamp' }
        }
      },
      {
        $project: {
          itemType: '$_id.itemType',
          itemValue: '$_id.itemValue',
          displayName: '$_id.displayName',
          clickCount: 1,
          uniqueUsersCount: { $size: '$uniqueUsers' },
          lastClicked: 1,
          firstClicked: 1
        }
      },
      { $sort: { clickCount: -1 } },
      { $limit: parseInt(limit) }
    ]);

    res.json({
      success: true,
      data: popularClicks
    });

  } catch (error) {
    console.error('Get popular clicks error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch popular clicks'
    });
  }
};

exports.exportClickData = async (req, res) => {
  try {
    const { timeframe = '30d', format = 'json' } = req.query;
    const dateRange = calculateDateRange(timeframe);

    const clicks = await ClickAnalytics.find({
      timestamp: { $gte: dateRange.start, $lte: dateRange.end }
    })
    .populate('userId', 'name email')
    .populate('propertyId', 'title price')
    .sort({ timestamp: -1 });

    if (format === 'csv') {
      // Convert to CSV
      const csvData = convertToCSV(clicks);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=click-analytics-${Date.now()}.csv`);
      return res.send(csvData);
    } else {
      res.json({
        success: true,
        data: clicks
      });
    }

  } catch (error) {
    console.error('Export click data error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export click data'
    });
  }
};

exports.getClickTrends = async (req, res) => {
  try {
    const { timeframe = '30d', groupBy = 'day' } = req.query;
    const dateRange = calculateDateRange(timeframe);

    let dateFormat = '%Y-%m-%d';
    if (groupBy === 'week') dateFormat = '%Y-%U';
    if (groupBy === 'month') dateFormat = '%Y-%m';
    if (groupBy === 'hour') dateFormat = '%Y-%m-%d %H:00';

    const trends = await ClickAnalytics.aggregate([
      { 
        $match: { 
          timestamp: { $gte: dateRange.start, $lte: dateRange.end } 
        } 
      },
      {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: dateFormat,
                date: '$timestamp'
              }
            },
            itemType: '$itemType'
          },
          clicks: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' }
        }
      },
      {
        $group: {
          _id: '$_id.date',
          date: { $first: '$_id.date' },
          totalClicks: { $sum: '$clicks' },
          uniqueUsers: { $addToSet: '$uniqueUsers' },
          breakdown: {
            $push: {
              itemType: '$_id.itemType',
              clicks: '$clicks'
            }
          }
        }
      },
      {
        $project: {
          date: 1,
          totalClicks: 1,
          uniqueUsersCount: { $size: { $reduce: {
            input: '$uniqueUsers',
            initialValue: [],
            in: { $setUnion: ['$$value', '$$this'] }
          }}},
          breakdown: 1
        }
      },
      { $sort: { date: 1 } }
    ]);

    res.json({
      success: true,
      data: trends
    });

  } catch (error) {
    console.error('Get click trends error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch click trends'
    });
  }
};

// Helper function to calculate date ranges
// Add this function if it doesn't exist
function calculateDateRange(timeframe) {
  const now = new Date();
  const start = new Date();

  switch (timeframe) {
    case '24h':
      start.setHours(now.getHours() - 24);
      break;
    case '7d':
      start.setDate(now.getDate() - 7);
      break;
    case '30d':
      start.setDate(now.getDate() - 30);
      break;
    case '90d':
      start.setDate(now.getDate() - 90);
      break;
    case '1y':
      start.setFullYear(now.getFullYear() - 1);
      break;
    case 'all':
      start.setFullYear(2020); // Or your app's start year
      break;
    default:
      start.setDate(now.getDate() - 7);
  }

  console.log('📅 Date calculation:', { start, end: now, timeframe });
  return { start, end: now };
}
// Helper function to convert to CSV
function convertToCSV(data) {
  const headers = ['Timestamp', 'Item Type', 'Display Name', 'Item Value', 'User', 'Property', 'Page URL', 'Device', 'Country', 'City'];
  
  const csvRows = [
    headers.join(','),
    ...data.map(item => [
      item.timestamp.toISOString(),
      `"${item.itemType}"`,
      `"${item.displayName}"`,
      `"${item.itemValue}"`,
      item.userId ? `"${item.userId.name || item.userId.email}"` : 'Anonymous',
      item.propertyId ? `"${item.propertyId.title}"` : 'N/A',
      `"${item.pageUrl}"`,
      `"${item.deviceType}"`,
      `"${item.country}"`,
      `"${item.city}"`
    ].join(','))
  ];

  return csvRows.join('\n');
}
// Add this function to your clickController.js
// Enhanced getHourlyDistribution function with better error handling
// Replace your getHourlyDistribution function with this corrected version
exports.getHourlyDistribution = async (req, res) => {
  try {
    const { timeframe = '7d' } = req.query;
    
    console.log('🕒 Fetching hourly distribution for timeframe:', timeframe);
    
    // Calculate date range - FIXED VERSION
    const dateRange = calculateDateRange(timeframe);
    console.log('📅 Date range calculated:', dateRange);
    
    // Build match query - SIMPLIFIED
    const matchQuery = {
      timestamp: { 
        $gte: new Date(dateRange.start), 
        $lte: new Date(dateRange.end) 
      }
    };
    
    console.log('🔍 Match query:', matchQuery);

    // SIMPLIFIED AGGREGATION PIPELINE
    const aggregationPipeline = [
      { 
        $match: matchQuery 
      },
      {
        $group: {
          _id: {
            $hour: "$timestamp"
          },
          clicks: { $sum: 1 },
          uniqueSessions: { $addToSet: "$sessionId" }
        }
      },
      {
        $project: {
          hour: "$_id",
          clicks: 1,
          uniqueSessionsCount: { $size: "$uniqueSessions" },
          _id: 0 // Exclude the _id field
        }
      },
      { 
        $sort: { hour: 1 } 
      }
    ];

    console.log('🔧 Aggregation pipeline:', JSON.stringify(aggregationPipeline, null, 2));

    // Execute aggregation
    const hourlyDistribution = await ClickAnalytics.aggregate(aggregationPipeline);
    console.log('✅ Aggregation result:', hourlyDistribution);

    // Fill in missing hours with zero values
    const completeHourlyData = Array.from({ length: 24 }, (_, hour) => {
      const existingHour = hourlyDistribution.find(item => item.hour === hour);
      
      if (existingHour) {
        return {
          hour: hour,
          hourLabel: `${hour.toString().padStart(2, '0')}:00 - ${hour.toString().padStart(2, '0')}:59`,
          hourFormatted: `${hour.toString().padStart(2, '0')}:00`,
          period: hour < 12 ? 'AM' : 'PM',
          periodLabel: hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : hour < 21 ? 'Evening' : 'Night',
          clicks: existingHour.clicks || 0,
          uniqueSessionsCount: existingHour.uniqueSessionsCount || 0,
          engagementRate: existingHour.uniqueSessionsCount > 0 ? 
            (existingHour.clicks / existingHour.uniqueSessionsCount).toFixed(2) : 0
        };
      } else {
        return {
          hour: hour,
          hourLabel: `${hour.toString().padStart(2, '0')}:00 - ${hour.toString().padStart(2, '0')}:59`,
          hourFormatted: `${hour.toString().padStart(2, '0')}:00`,
          period: hour < 12 ? 'AM' : 'PM',
          periodLabel: hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : hour < 21 ? 'Evening' : 'Night',
          clicks: 0,
          uniqueSessionsCount: 0,
          engagementRate: 0
        };
      }
    });

    // Calculate summary
    const totalClicks = completeHourlyData.reduce((sum, item) => sum + item.clicks, 0);
    const peakHour = completeHourlyData.reduce((max, item) => 
      item.clicks > max.clicks ? item : max, { clicks: 0, hour: 0 }
    );

    res.json({
      success: true,
      data: {
        hourlyDistribution: completeHourlyData,
        timeframe,
        dateRange: {
          start: dateRange.start,
          end: dateRange.end
        },
        summary: {
          totalClicks,
          peakHour: {
            hour: peakHour.hour,
            hourLabel: peakHour.hourFormatted,
            clicks: peakHour.clicks
          },
          averageClicksPerHour: Math.round(totalClicks / 24)
        }
      }
    });

  } catch (error) {
    console.error('❌ Get hourly distribution error:', error);
    console.error('❌ Error stack:', error.stack);
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch hourly distribution',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};