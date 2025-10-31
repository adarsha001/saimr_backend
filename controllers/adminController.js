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