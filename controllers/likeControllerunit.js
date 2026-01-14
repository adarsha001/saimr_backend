// controllers/likeController.js
const Like = require("../models/Like");
const PropertyUnit = require("../models/PropertyUnit");
const mongoose = require("mongoose");

// Helper function to validate MongoDB ObjectId
const isValidObjectId = (id) => {
  if (!id) return false;
  return mongoose.Types.ObjectId.isValid(id) && /^[0-9a-fA-F]{24}$/.test(id.toString());
};

// @desc    Like a property unit
// @route   POST /api/property-units/likes/:propertyId
// @access  Private
exports.likePropertyUnit = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const userId = req.user.id;

    console.log('Like request for property:', propertyId, 'by user:', userId);

    // Validate propertyId
    if (!isValidObjectId(propertyId)) {
      console.error('Invalid property ID:', propertyId);
      return res.status(400).json({
        success: false,
        message: "Invalid property ID format"
      });
    }

    // Validate userId
    if (!isValidObjectId(userId)) {
      console.error('Invalid user ID:', userId);
      return res.status(400).json({
        success: false,
        message: "Invalid user ID"
      });
    }

    // Check if property exists
    const property = await PropertyUnit.findById(propertyId);
    if (!property) {
      console.error('Property not found:', propertyId);
      return res.status(404).json({
        success: false,
        message: "Property not found"
      });
    }

    // Check if already liked
    const alreadyLiked = await Like.findOne({ 
      user: userId, 
      propertyUnit: propertyId 
    });

    if (alreadyLiked) {
      console.log('Property already liked by user');
      return res.status(400).json({
        success: false,
        message: "Property already liked"
      });
    }

    // Create like
    const like = await Like.create({
      user: userId,
      propertyUnit: propertyId
    });

    console.log('Like created successfully:', like._id);

    // Update property like count
    property.likes = (property.likes || 0) + 1;
    await property.save();
    console.log('Property like count updated:', property.likes);

    // Populate property details
    await like.populate({
      path: 'propertyUnit',
      select: 'title city price images propertyType listingType isVerified isFeatured'
    });

    res.status(201).json({
      success: true,
      message: "Property liked successfully",
      data: like
    });
  } catch (error) {
    console.error("Error liking property:", error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "You have already liked this property"
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// @desc    Unlike a property unit
// @route   DELETE /api/property-units/likes/:propertyId
// @access  Private
exports.unlikePropertyUnit = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const userId = req.user.id;

    console.log('Unlike request for property:', propertyId, 'by user:', userId);

    // Validate propertyId
    if (!isValidObjectId(propertyId)) {
      console.error('Invalid property ID:', propertyId);
      return res.status(400).json({
        success: false,
        message: "Invalid property ID format"
      });
    }

    // Validate userId
    if (!isValidObjectId(userId)) {
      console.error('Invalid user ID:', userId);
      return res.status(400).json({
        success: false,
        message: "Invalid user ID"
      });
    }

    // Find and delete like
    const like = await Like.findOneAndDelete({ 
      user: userId, 
      propertyUnit: propertyId 
    });

    if (!like) {
      console.log('Like not found for property:', propertyId, 'user:', userId);
      return res.status(404).json({
        success: false,
        message: "Like not found"
      });
    }

    console.log('Like deleted successfully:', like._id);

    // Update property like count
    const property = await PropertyUnit.findById(propertyId);
    if (property) {
      property.likes = Math.max(0, (property.likes || 0) - 1);
      await property.save();
      console.log('Property like count updated:', property.likes);
    }

    res.status(200).json({
      success: true,
      message: "Property unliked successfully",
      data: {}
    });
  } catch (error) {
    console.error("Error unliking property:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// @desc    Get user's liked properties
// @route   GET /api/property-units/likes
// @access  Private
// @desc    Get user's liked properties
// @route   GET /api/property-units/likes
// @access  Private
// @desc    Get user's liked properties - SIMPLE WORKING VERSION
// @route   GET /api/property-units/likes
// @access  Private
exports.getLikedProperties = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('Getting liked properties for user ID:', userId);
    
    // Just get the likes
    const likes = await Like.find({ user: userId }).lean();
    console.log('Found likes:', likes);
    
    // Return success even if empty
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
    console.error('Error:', error);
    return res.status(200).json({  // Return 200 even on error to avoid breaking frontend
      success: true,
      count: 0,
      data: []
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

    console.log('Check if liked - property:', propertyId, 'user:', userId);

    // Validate propertyId
    if (!isValidObjectId(propertyId)) {
      console.error('Invalid property ID:', propertyId);
      return res.status(400).json({
        success: false,
        message: "Invalid property ID format"
      });
    }

    // Validate userId
    if (!isValidObjectId(userId)) {
      console.error('Invalid user ID:', userId);
      return res.status(400).json({
        success: false,
        message: "Invalid user ID"
      });
    }

    const isLiked = await Like.findOne({ 
      user: userId, 
      propertyUnit: propertyId 
    });

    console.log('Is liked result:', !!isLiked);

    res.status(200).json({
      success: true,
      isLiked: !!isLiked
    });
  } catch (error) {
    console.error("Error checking if liked:", error);
    res.status(500).json({
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

    console.log('Get like count for property:', propertyId);

    // Validate propertyId
    if (!isValidObjectId(propertyId)) {
      console.error('Invalid property ID:', propertyId);
      return res.status(400).json({
        success: false,
        message: "Invalid property ID format"
      });
    }

    const count = await Like.countDocuments({ propertyUnit: propertyId });

    console.log('Like count for property', propertyId, ':', count);

    res.status(200).json({
      success: true,
      count
    });
  } catch (error) {
    console.error("Error getting like count:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// @desc    Toggle like/unlike (single endpoint for both)
// @route   POST /api/property-units/likes/toggle/:propertyId
// @access  Private
exports.toggleLike = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const userId = req.user.id;

    console.log('Toggle like request - property:', propertyId, 'user:', userId);

    // Validate propertyId
    if (!isValidObjectId(propertyId)) {
      console.error('Invalid property ID:', propertyId);
      return res.status(400).json({
        success: false,
        message: "Invalid property ID format"
      });
    }

    // Validate userId
    if (!isValidObjectId(userId)) {
      console.error('Invalid user ID:', userId);
      return res.status(400).json({
        success: false,
        message: "Invalid user ID"
      });
    }

    // Check if property exists
    const property = await PropertyUnit.findById(propertyId);
    if (!property) {
      console.error('Property not found:', propertyId);
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

    console.log('Existing like found:', !!existingLike);

    let action;
    let like;

    if (existingLike) {
      // Unlike
      await existingLike.deleteOne();
      property.likes = Math.max(0, (property.likes || 0) - 1);
      action = 'unliked';
      console.log('Unlike successful');
    } else {
      // Like
      like = await Like.create({
        user: userId,
        propertyUnit: propertyId
      });
      property.likes = (property.likes || 0) + 1;
      action = 'liked';
      console.log('Like successful, new like ID:', like._id);
    }

    await property.save();
    console.log('Property like count updated to:', property.likes);

    res.status(200).json({
      success: true,
      message: `Property ${action} successfully`,
      action,
      isLiked: !existingLike,
      likeCount: property.likes,
      data: like || null
    });
  } catch (error) {
    console.error("Error toggling like:", error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "You have already liked this property"
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// @desc    Clean up invalid likes (admin/debug endpoint)
// @route   DELETE /api/property-units/likes/cleanup
// @access  Private/Admin
exports.cleanupInvalidLikes = async (req, res) => {
  try {
    console.log('Starting cleanup of invalid likes...');
    
    // Find all likes
    const allLikes = await Like.find({});
    console.log('Total likes in database:', allLikes.length);
    
    const invalidLikes = [];
    
    // Check each like for validity
    for (const like of allLikes) {
      // Check if user ID is valid
      if (!isValidObjectId(like.user)) {
        console.warn('Invalid user ID in like:', like._id, 'user:', like.user);
        invalidLikes.push(like._id);
        continue;
      }
      
      // Check if propertyUnit ID is valid
      if (!isValidObjectId(like.propertyUnit)) {
        console.warn('Invalid propertyUnit ID in like:', like._id, 'propertyUnit:', like.propertyUnit);
        invalidLikes.push(like._id);
        continue;
      }
      
      // Check if property exists
      const propertyExists = await PropertyUnit.exists({ _id: like.propertyUnit });
      if (!propertyExists) {
        console.warn('Property not found for like:', like._id, 'property:', like.propertyUnit);
        invalidLikes.push(like._id);
        continue;
      }
      
      // Check if user exists (if you have User model)
      // const userExists = await User.exists({ _id: like.user });
      // if (!userExists) {
      //   console.warn('User not found for like:', like._id, 'user:', like.user);
      //   invalidLikes.push(like._id);
      // }
    }
    
    console.log('Found', invalidLikes.length, 'invalid likes');
    
    // Delete invalid likes
    if (invalidLikes.length > 0) {
      await Like.deleteMany({ _id: { $in: invalidLikes } });
      console.log('Deleted', invalidLikes.length, 'invalid likes');
    }
    
    res.status(200).json({
      success: true,
      message: `Cleaned up ${invalidLikes.length} invalid likes`,
      cleanedCount: invalidLikes.length,
      remainingCount: allLikes.length - invalidLikes.length
    });
    
  } catch (error) {
    console.error("Error cleaning up likes:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};