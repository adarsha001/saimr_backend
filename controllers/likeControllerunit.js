// controllers/likeController.js
const Like = require("../models/Like");
const PropertyUnit = require("../models/PropertyUnit");

console.log('=== likeController.js loaded ===');

// @desc    Get user's liked properties
// @route   GET /api/property-units/likes
// @access  Private
exports.getLikedProperties = async (req, res) => {
  console.log('=== getLikedProperties called ===');
  console.log('req.user:', req.user);
  console.log('req.user.id:', req.user?.id);
  
  try {
    if (!req.user || !req.user.id) {
      console.log('No user found in request');
      return res.status(200).json({
        success: true,
        count: 0,
        data: []
      });
    }

    const userId = req.user.id;
    console.log('Getting liked properties for user ID:', userId);
    
    // Just get the likes - NO VALIDATION
    const likes = await Like.find({ user: userId }).lean();
    console.log('Found likes:', likes.length);
    
    // Return success
    return res.status(200).json({
      success: true,
      count: likes.length,
      data: likes.map(like => ({
        likeId: like._id,
        propertyId: like.propertyUnit,
        createdAt: like.createdAt
      }))
    });
    
  } catch (error) {
    console.error('Error in getLikedProperties:', error);
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
  console.log('=== toggleLike called ===');
  console.log('Property ID:', req.params.propertyId);
  console.log('User ID:', req.user?.id);
  
  try {
    const { propertyId } = req.params;
    const userId = req.user.id;

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

    // Check if already liked
    const existingLike = await Like.findOne({
      user: userId,
      propertyUnit: propertyId
    });

    if (existingLike) {
      // Unlike
      await Like.findByIdAndDelete(existingLike._id);
      property.likes = Math.max(0, (property.likes || 0) - 1);
      await property.save();
      
      console.log('Unlike successful');
      return res.status(200).json({
        success: true,
        message: "Property unliked successfully",
        isLiked: false,
        likeCount: property.likes
      });
    } else {
      // Like
      const like = await Like.create({
        user: userId,
        propertyUnit: propertyId
      });
      
      property.likes = (property.likes || 0) + 1;
      await property.save();
      
      console.log('Like successful');
      return res.status(200).json({
        success: true,
        message: "Property liked successfully",
        isLiked: true,
        likeCount: property.likes,
        likeId: like._id
      });
    }
    
  } catch (error) {
    console.error('Error in toggleLike:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Already liked this property"
      });
    }
    
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

    const like = await Like.findOne({
      user: userId,
      propertyUnit: propertyId
    });

    return res.status(200).json({
      success: true,
      isLiked: !!like
    });
    
  } catch (error) {
    console.error("Error checking if liked:", error);
    return res.status(200).json({
      success: true,
      isLiked: false
    });
  }
};

// @desc    Get like count for a property
// @route   GET /api/property-units/likes/count/:propertyId
// @access  Public
exports.getLikeCount = async (req, res) => {
  try {
    const { propertyId } = req.params;

    const count = await Like.countDocuments({ propertyUnit: propertyId });

    return res.status(200).json({
      success: true,
      count
    });
    
  } catch (error) {
    console.error("Error getting like count:", error);
    return res.status(200).json({
      success: true,
      count: 0
    });
  }
};

// Other functions you might not need right now
exports.likePropertyUnit = async (req, res) => {
  console.log('likePropertyUnit called but using toggleLike instead');
  return exports.toggleLike(req, res);
};

exports.unlikePropertyUnit = async (req, res) => {
  console.log('unlikePropertyUnit called but using toggleLike instead');
  return exports.toggleLike(req, res);
};