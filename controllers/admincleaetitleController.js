const mongoose = require('mongoose');
const User = require('../models/user');
const PropertyUnit = mongoose.model('PropertyUnit');

// Get single user by ID with posted properties
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid user ID format" 
      });
    }

    console.log("Fetching user:", id);

    // Get the user
    const user = await User.findById(id).select('-password');
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: "User not found" 
      });
    }

    console.log('User found:', user.username);
    console.log('Posted properties count in DB:', user.postedProperties?.length || 0);

    // Get all property IDs from postedProperties
    const propertyIds = user.postedProperties.map(item => item.property);
    console.log('Property IDs to fetch:', propertyIds.length);
    
    let populatedPostedProperties = [];
    
    if (propertyIds.length > 0) {
      // Fetch properties from PropertyUnit collection
      const properties = await PropertyUnit.find({
        _id: { $in: propertyIds }
      }).lean();
      
      console.log('Properties found in PropertyUnit:', properties.length);
      
      // Create a map for quick lookup
      const propertyMap = new Map();
      properties.forEach(prop => {
        propertyMap.set(prop._id.toString(), prop);
      });
      
      // Build the postedProperties array with populated data
      populatedPostedProperties = user.postedProperties
        .map(postItem => {
          const propertyId = postItem.property.toString();
          const propertyData = propertyMap.get(propertyId);
          
          if (!propertyData) {
            console.log(`⚠️ Property not found for ID: ${propertyId}`);
            return null;
          }
          
          return {
            _id: postItem._id,
            postedAt: postItem.postedAt,
            status: postItem.status,
            property: {
              _id: propertyData._id,
              title: propertyData.title || 'Untitled',
              description: propertyData.description,
              city: propertyData.city,
              address: propertyData.address,
              priceRange: propertyData.priceRange,
              propertyType: propertyData.propertyType,
              approvalStatus: propertyData.approvalStatus,
              isFeatured: propertyData.isFeatured,
              isVerified: propertyData.isVerified,
              images: propertyData.images || [],
              createdAt: propertyData.createdAt
            }
          };
        })
        .filter(item => item !== null);
    }

    console.log('Successfully populated properties:', populatedPostedProperties.length);

    // Send response
    const responseData = {
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
        alternativePhoneNumber: user.alternativePhoneNumber,
        googleId: user.googleId,
        isGoogleAuth: user.isGoogleAuth,
        avatar: user.avatar,
        emailVerified: user.emailVerified,
        lastLogin: user.lastLogin,
        company: user.company,
        languages: user.languages,
        officeAddress: user.officeAddress,
        dateOfBirth: user.dateOfBirth,
        occupation: user.occupation,
        preferredLocation: user.preferredLocation,
        contactPreferences: user.contactPreferences,
        specialization: user.specialization,
        website: user.website,
        socialMedia: user.socialMedia,
        sourceWebsite: user.sourceWebsite,
        websiteLogins: user.websiteLogins,
        
        // Only posted properties
        postedPropertiesCount: populatedPostedProperties.length,
        postedProperties: populatedPostedProperties,
        
        notifications: user.notifications,
        isVerified: user.isVerified,
        verificationDate: user.verificationDate,
        about: user.about,
        interests: user.interests,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        agentApproval: user.agentApproval,
        agentProfile: user.agentProfile
      }
    };
    
    console.log('Sending response with', responseData.user.postedPropertiesCount, 'properties');
    res.status(200).json(responseData);
    
  } catch (error) {
    console.error('❌ Error fetching user details:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error fetching user details",
      error: error.message 
    });
  }
};

// Get all users with their posted properties
exports.getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;

    // Build filter object
    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
        { gmail: { $regex: search, $options: 'i' } }
      ];
    }

    // Get users with pagination
    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(filter);
    
    // For each user, fetch their posted properties
    const usersWithProperties = await Promise.all(users.map(async (user) => {
      const userObj = user.toObject();
      
      // Get property IDs from postedProperties
      const propertyIds = userObj.postedProperties?.map(item => item.property) || [];
      
      if (propertyIds.length === 0) {
        return {
          ...userObj,
          postedProperties: [],
          postedPropertiesCount: 0
        };
      }
      
      // Fetch properties from PropertyUnit collection
      const properties = await PropertyUnit.find({
        _id: { $in: propertyIds }
      }).select('title city address priceRange propertyType approvalStatus images createdAt')
        .lean();
      
      // Create map for quick lookup
      const propertyMap = new Map();
      properties.forEach(prop => {
        propertyMap.set(prop._id.toString(), prop);
      });
      
      // Populate postedProperties
      const populatedProperties = userObj.postedProperties
        .map(postItem => {
          const propertyData = propertyMap.get(postItem.property?.toString());
          if (!propertyData) return null;
          
          return {
            _id: postItem._id,
            postedAt: postItem.postedAt,
            status: postItem.status,
            property: {
              _id: propertyData._id,
              title: propertyData.title,
              city: propertyData.city,
              address: propertyData.address,
              priceRange: propertyData.priceRange,
              propertyType: propertyData.propertyType,
              approvalStatus: propertyData.approvalStatus,
              images: propertyData.images || [],
              createdAt: propertyData.createdAt
            }
          };
        })
        .filter(item => item !== null);
      
      return {
        _id: userObj._id,
        username: userObj.username,
        name: userObj.name,
        lastName: userObj.lastName,
        userType: userObj.userType,
        isAdmin: userObj.isAdmin,
        gmail: userObj.gmail,
        phoneNumber: userObj.phoneNumber,
        avatar: userObj.avatar,
        sourceWebsite: userObj.sourceWebsite,
        postedPropertiesCount: populatedProperties.length,
        postedProperties: populatedProperties,
        createdAt: userObj.createdAt,
        lastLogin: userObj.lastLogin
      };
    }));

    res.status(200).json({
      success: true,
      users: usersWithProperties,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
    
  } catch (error) {
    console.error('❌ Error fetching users:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error fetching users",
      error: error.message 
    });
  }
};