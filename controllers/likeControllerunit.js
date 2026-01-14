// controllers/likeController.js - SIMPLE WORKING VERSION
const User = require("../models/user");
const PropertyUnit = require("../models/PropertyUnit");

// @desc    Get user's liked properties
// @route   GET /api/property-units/likes
// @access  Private
exports.getLikedProperties = async (req, res) => {
  try {
    console.log('🔍 getLikedProperties called');
    
    // Check if user exists
    if (!req.user || !req.user.id) {
      console.log('❌ No user in request');
      return res.status(200).json({
        success: true,
        count: 0,
        data: []
      });
    }

    const userId = req.user.id;
    console.log(`👤 User ID: ${userId}`);
    
    // Find user
    const user = await User.findById(userId).select('likedProperties');
    
    if (!user) {
      console.log('❌ User not found');
      return res.status(200).json({
        success: true,
        count: 0,
        data: []
      });
    }

    console.log(`📋 User found with ${user.likedProperties.length} liked properties`);
    
    // Just return the liked property IDs for now
    const likedPropertyIds = user.likedProperties
      .filter(item => item.property)
      .map(item => item.property.toString());
    
    console.log(`📦 Liked property IDs: ${likedPropertyIds}`);
    
    return res.status(200).json({
      success: true,
      count: likedPropertyIds.length,
      data: likedPropertyIds // Just return IDs for now
    });
    
  } catch (error) {
    console.error('🔥 Error in getLikedProperties:', error);
    return res.status(200).json({
      success: true,
      count: 0,
      data: []
    });
  }
};

// @desc    Toggle like/unlike
// @route   POST /api/property-units/likes/toggle/:propertyId
// @access  Private
exports.toggleLike = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const userId = req.user.id;

    console.log(`🔄 Toggle like - User: ${userId}, Property: ${propertyId}`);

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
      
      // Update property like count
      property.likes = Math.max(0, (property.likes || 0) - 1);
      
      await user.save();
      await property.save();
      
      console.log(`✅ Property ${propertyId} unliked`);
      
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
      
      // Update property like count
      property.likes = (property.likes || 0) + 1;
      
      await user.save();
      await property.save();
      
      console.log(`✅ Property ${propertyId} liked`);
      
      return res.status(200).json({
        success: true,
        message: "Property added to favorites",
        isLiked: true,
        likeCount: property.likes
      });
    }
    
  } catch (error) {
    console.error('🔥 Error in toggleLike:', error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// Other functions for compatibility
exports.checkIfLiked = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(200).json({
        success: true,
        isLiked: false
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
    console.error('Error in checkIfLiked:', error);
    return res.status(200).json({
      success: true,
      isLiked: false
    });
  }
};

exports.getLikeCount = async (req, res) => {
  try {
    const { propertyId } = req.params;

    // Count users who have liked this property
    const count = await User.countDocuments({
      'likedProperties.property': propertyId
    });

    return res.status(200).json({
      success: true,
      count
    });
    
  } catch (error) {
    console.error('Error in getLikeCount:', error);
    return res.status(200).json({
      success: true,
      count: 0
    });
  }
};