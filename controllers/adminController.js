const Property = require('../models/property');
const User = require('../models/user'); 
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
const Click = require('../models/Click');
const ClickLog = require('../models/ClickLog');

// Get comprehensive click analytics
exports.getClickAnalytics = async (req, res) => {
  try {
    const { timeframe = '7d', itemType, page = 1, limit = 50 } = req.query;
    
    // Calculate date range based on timeframe
    const dateRange = calculateDateRange(timeframe);
    let dateFilter = {};
    
    if (dateRange.startDate) {
      dateFilter.lastClicked = { $gte: dateRange.startDate };
    }

    // Build query
    let query = { ...dateFilter };
    if (itemType) query.itemType = itemType;

    // Get click statistics with pagination
    const skip = (page - 1) * limit;
    const clicks = await Click.find(query)
      .sort({ clickCount: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const totalClicks = await Click.countDocuments(query);

    // Get summary statistics
    const totalSummary = await Click.aggregate([
      { $match: query },
      { 
        $group: {
          _id: null,
          totalClicks: { $sum: '$clickCount' },
          uniqueItems: { $sum: 1 },
          avgClicksPerItem: { $avg: '$clickCount' }
        }
      }
    ]);

    // Get clicks by type
    const clicksByType = await Click.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$itemType',
          totalClicks: { $sum: '$clickCount' },
          itemsCount: { $sum: 1 }
        }
      },
      { $sort: { totalClicks: -1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        clicks,
        summary: totalSummary[0] || { totalClicks: 0, uniqueItems: 0, avgClicksPerItem: 0 },
        clicksByType,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalClicks / limit),
          totalItems: totalClicks,
          itemsPerPage: parseInt(limit)
        },
        timeframe: {
          value: timeframe,
          ...dateRange
        }
      }
    });

  } catch (error) {
    console.error('Error fetching click analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching click analytics',
      error: error.message
    });
  }
};

// Get click statistics grouped by type
exports.getClickStatsByType = async (req, res) => {
  try {
    const { timeframe = '30d' } = req.query;
    const dateRange = calculateDateRange(timeframe);
    
    let matchStage = {};
    if (dateRange.startDate) {
      matchStage.lastClicked = { $gte: dateRange.startDate };
    }

    const stats = await Click.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$itemType',
          totalClicks: { $sum: '$clickCount' },
          uniqueItems: { $sum: 1 },
          mostClicked: { $max: '$clickCount' },
          leastClicked: { $min: '$clickCount' },
          avgClicks: { $avg: '$clickCount' }
        }
      },
      {
        $project: {
          itemType: '$_id',
          totalClicks: 1,
          uniqueItems: 1,
          mostClicked: 1,
          leastClicked: 1,
          avgClicks: { $round: ['$avgClicks', 2] }
        }
      },
      { $sort: { totalClicks: -1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        stats,
        timeframe: {
          value: timeframe,
          ...dateRange
        }
      }
    });

  } catch (error) {
    console.error('Error fetching click stats by type:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching click statistics by type',
      error: error.message
    });
  }
};

// Get most popular clicks
exports.getPopularClicks = async (req, res) => {
  try {
    const { limit = 10, timeframe = '30d', itemType } = req.query;
    const dateRange = calculateDateRange(timeframe);
    
    let query = {};
    if (dateRange.startDate) {
      query.lastClicked = { $gte: dateRange.startDate };
    }
    if (itemType) {
      query.itemType = itemType;
    }

    const popularClicks = await Click.find(query)
      .sort({ clickCount: -1 })
      .limit(parseInt(limit))
      .select('itemType itemValue clickCount firstClicked lastClicked displayName');

    res.status(200).json({
      success: true,
      data: {
        popularClicks,
        timeframe: {
          value: timeframe,
          ...dateRange
        }
      }
    });

  } catch (error) {
    console.error('Error fetching popular clicks:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching popular clicks',
      error: error.message
    });
  }
};

// Export click data as CSV/JSON
exports.exportClickData = async (req, res) => {
  try {
    const { format = 'json', timeframe = 'all', itemType } = req.query;
    const dateRange = calculateDateRange(timeframe);
    
    let query = {};
    if (dateRange.startDate) {
      query.lastClicked = { $gte: dateRange.startDate };
    }
    if (itemType) {
      query.itemType = itemType;
    }

    const clicks = await Click.find(query)
      .sort({ clickCount: -1 })
      .select('itemType itemValue clickCount firstClicked lastClicked displayName');

    if (format === 'csv') {
      // Convert to CSV
      const csvData = convertToCSV(clicks);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=click-analytics-${new Date().toISOString().split('T')[0]}.csv`);
      return res.send(csvData);
    }

    // Default JSON response
    res.status(200).json({
      success: true,
      data: clicks,
      exportInfo: {
        format,
        timeframe,
        exportedAt: new Date().toISOString(),
        totalRecords: clicks.length
      }
    });

  } catch (error) {
    console.error('Error exporting click data:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting click data',
      error: error.message
    });
  }
};

// Get click trends over time
exports.getClickTrends = async (req, res) => {
  try {
    const { timeframe = '30d', groupBy = 'day' } = req.query;
    const dateRange = calculateDateRange(timeframe);
    
    const trends = await ClickLog.aggregate([
      {
        $match: {
          timestamp: { 
            $gte: dateRange.startDate || new Date('2020-01-01'),
            $lte: dateRange.endDate || new Date() 
          }
        }
      },
      {
        $group: {
          _id: {
            date: {
              $dateToString: { 
                format: groupBy === 'day' ? '%Y-%m-%d' : '%Y-%m', 
                date: '$timestamp' 
              }
            },
            itemType: '$itemType'
          },
          clicks: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.date',
          clicksByType: {
            $push: {
              itemType: '$_id.itemType',
              clicks: '$clicks'
            }
          },
          totalClicks: { $sum: '$clicks' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        trends,
        timeframe: {
          value: timeframe,
          ...dateRange
        },
        groupBy
      }
    });

  } catch (error) {
    console.error('Error fetching click trends:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching click trends',
      error: error.message
    });
  }
};

// Helper function to calculate date ranges
exports.calculateDateRange = (timeframe) => {
  const now = new Date();
  let startDate = null;
  let endDate = now;

  switch (timeframe) {
    case '24h':
      startDate = new Date(now.setDate(now.getDate() - 1));
      break;
    case '7d':
      startDate = new Date(now.setDate(now.getDate() - 7));
      break;
    case '30d':
      startDate = new Date(now.setDate(now.getDate() - 30));
      break;
    case '90d':
      startDate = new Date(now.setDate(now.getDate() - 90));
      break;
    case '1y':
      startDate = new Date(now.setFullYear(now.getFullYear() - 1));
      break;
    case 'all':
    default:
      startDate = null;
  }

  return { startDate, endDate };
};

// Helper function to convert data to CSV
exports.convertToCSV = (data) => {
  if (!data.length) return '';
  
  const headers = Object.keys(data[0]._doc).filter(key => 
    !['_id', '__v'].includes(key)
  );
  
  const csvHeaders = headers.join(',');
  const csvRows = data.map(item => {
    return headers.map(header => {
      const value = item[header];
      if (value instanceof Date) {
        return value.toISOString();
      }
      return `"${String(value || '').replace(/"/g, '""')}"`;
    }).join(',');
  });
  
  return [csvHeaders, ...csvRows].join('\n');
};

