// controllers/likeController.js (User-based approach)
const User = require("../models/user");
const PropertyUnit = require("../models/PropertyUnit");

// @desc    Toggle like/unlike for a property unit
// @route   POST /api/property-units/likes/toggle/:propertyId
// @access  Private
exports.toggleLike = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const userId = req.user.id;

    console.log(`User ${userId} toggling like for property ${propertyId}`);

    // Basic validation
    if (!propertyId) {
      return res.status(400).json({
        success: false,
        message: "Property ID is required"
      });
    }

    // Check if property exists
    const property = await PropertyUnit.findById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found"
      });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Check if property is already liked
    const likedIndex = user.likedProperties.findIndex(
      item => item.property && item.property.toString() === propertyId
    );

    if (likedIndex !== -1) {
      // Unlike: Remove from array
      user.likedProperties.splice(likedIndex, 1);
      
      // Decrease property like count
      property.likes = Math.max(0, (property.likes || 0) - 1);
      
      await user.save();
      await property.save();
      
      console.log(`✅ Property ${propertyId} unliked by user ${userId}`);
      
      return res.status(200).json({
        success: true,
        message: "Property removed from favorites",
        isLiked: false,
        likeCount: property.likes
      });
    } else {
      // Like: Add to array
      user.likedProperties.push({
        property: propertyId,
        likedAt: new Date()
      });
      
      // Increase property like count
      property.likes = (property.likes || 0) + 1;
      
      await user.save();
      await property.save();
      
      console.log(`✅ Property ${propertyId} liked by user ${userId}`);
      
      return res.status(200).json({
        success: true,
        message: "Property added to favorites",
        isLiked: true,
        likeCount: property.likes
      });
    }
    
  } catch (error) {
    console.error("Error in toggleLike:", error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: "Invalid property ID format"
      });
    }
    
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// @desc    Get user's liked properties
// @route   GET /api/property-units/likes
// @access  Private
exports.getLikedProperties = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    const userId = req.user.id;
    console.log(`Fetching liked properties for user: ${userId}`);

    // Find user and populate liked properties
    const user = await User.findById(userId)
      .populate({
        path: 'likedProperties.property',
        select: 'title city price images propertyType listingType isVerified isFeatured specifications buildingDetails approvalStatus availability',
        match: { approvalStatus: 'approved' } // Only get approved properties
      });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Filter out null properties and format response
    const validProperties = user.likedProperties
      .filter(item => item.property && item.property._id)
      .map(item => ({
        property: item.property,
        likedAt: item.likedAt
      }));

    console.log(`Found ${validProperties.length} liked properties`);

    return res.status(200).json({
      success: true,
      count: validProperties.length,
      data: validProperties.map(item => item.property) // Return just the properties
    });
    
  } catch (error) {
    console.error("Error in getLikedProperties:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// @desc    Check if a property is liked by user
// @route   GET /api/property-units/likes/check/:propertyId
// @access  Private
exports.checkIfLiked = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const userId = req.user.id;

    if (!propertyId) {
      return res.status(400).json({
        success: false,
        message: "Property ID is required"
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const isLiked = user.likedProperties.some(
      item => item.property && item.property.toString() === propertyId
    );

    return res.status(200).json({
      success: true,
      isLiked
    });
    
  } catch (error) {
    console.error("Error in checkIfLiked:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// @desc    Get like count for a property
// @route   GET /api/property-units/likes/count/:propertyId
// @access  Public
exports.getLikeCount = async (req, res) => {
  try {
    const { propertyId } = req.params;

    if (!propertyId) {
      return res.status(400).json({
        success: false,
        message: "Property ID is required"
      });
    }

    // Count users who have this property in their likedProperties
    const count = await User.countDocuments({
      'likedProperties.property': propertyId
    });

    return res.status(200).json({
      success: true,
      count
    });
    
  } catch (error) {
    console.error("Error in getLikeCount:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// @desc    Like a property (separate endpoint for explicit liking)
// @route   POST /api/property-units/likes/:propertyId
// @access  Private
exports.likeProperty = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const userId = req.user.id;

    console.log(`User ${userId} liking property ${propertyId}`);

    if (!propertyId) {
      return res.status(400).json({
        success: false,
        message: "Property ID is required"
      });
    }

    const property = await PropertyUnit.findById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found"
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Check if already liked
    const alreadyLiked = user.likedProperties.some(
      item => item.property && item.property.toString() === propertyId
    );

    if (alreadyLiked) {
      return res.status(400).json({
        success: false,
        message: "Property already liked"
      });
    }

    // Add to liked properties
    user.likedProperties.push({
      property: propertyId,
      likedAt: new Date()
    });

    // Update property like count
    property.likes = (property.likes || 0) + 1;

    await user.save();
    await property.save();

    console.log(`✅ Property ${propertyId} liked by user ${userId}`);

    return res.status(200).json({
      success: true,
      message: "Property added to favorites",
      isLiked: true,
      likeCount: property.likes
    });
    
  } catch (error) {
    console.error("Error in likeProperty:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// @desc    Unlike a property (separate endpoint for explicit unliking)
// @route   DELETE /api/property-units/likes/:propertyId
// @access  Private
exports.unlikeProperty = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const userId = req.user.id;

    console.log(`User ${userId} unliking property ${propertyId}`);

    if (!propertyId) {
      return res.status(400).json({
        success: false,
        message: "Property ID is required"
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Check if property is liked
    const initialLength = user.likedProperties.length;
    user.likedProperties = user.likedProperties.filter(
      item => item.property && item.property.toString() !== propertyId
    );

    if (user.likedProperties.length === initialLength) {
      return res.status(400).json({
        success: false,
        message: "Property not in favorites"
      });
    }

    // Update property like count
    const property = await PropertyUnit.findById(propertyId);
    if (property) {
      property.likes = Math.max(0, (property.likes || 0) - 1);
      await property.save();
    }

    await user.save();

    console.log(`✅ Property ${propertyId} unliked by user ${userId}`);

    return res.status(200).json({
      success: true,
      message: "Property removed from favorites",
      isLiked: false,
      likeCount: property ? property.likes : 0
    });
    
  } catch (error) {
    console.error("Error in unlikeProperty:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};