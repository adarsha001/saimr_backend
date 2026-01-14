// controllers/likeController.js
const Like = require("../models/Like");
const PropertyUnit = require("../models/PropertyUnit");
const mongoose = require("mongoose");

// @desc    Like a property unit
// @route   POST /api/likes/:propertyId
// @access  Private
exports.likePropertyUnit = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const userId = req.user.id;

    // Validate propertyId
    if (!mongoose.Types.ObjectId.isValid(propertyId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid property ID"
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
    const alreadyLiked = await Like.findOne({ 
      user: userId, 
      propertyUnit: propertyId 
    });

    if (alreadyLiked) {
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

    // Populate property details
    await like.populate({
      path: 'propertyUnit',
      select: 'title city price images propertyType listingType isVerified isFeatured'
    });

    // Update property like count
    property.likes = (property.likes || 0) + 1;
    await property.save();

    res.status(201).json({
      success: true,
      message: "Property liked successfully",
      data: like
    });
  } catch (error) {
    console.error("Error liking property:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// @desc    Unlike a property unit
// @route   DELETE /api/likes/:propertyId
// @access  Private
exports.unlikePropertyUnit = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const userId = req.user.id;

    // Validate propertyId
    if (!mongoose.Types.ObjectId.isValid(propertyId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid property ID"
      });
    }

    // Find and delete like
    const like = await Like.findOneAndDelete({ 
      user: userId, 
      propertyUnit: propertyId 
    });

    if (!like) {
      return res.status(404).json({
        success: false,
        message: "Like not found"
      });
    }

    // Update property like count
    const property = await PropertyUnit.findById(propertyId);
    if (property) {
      property.likes = Math.max(0, (property.likes || 0) - 1);
      await property.save();
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
// @route   GET /api/likes
// @access  Private
exports.getLikedProperties = async (req, res) => {
  try {
    const userId = req.user.id;

    const likes = await Like.find({ user: userId })
      .populate({
        path: 'propertyUnit',
        select: 'title city price images propertyType listingType specifications buildingDetails isVerified isFeatured approvalStatus availability createdAt',
        populate: {
          path: 'createdBy',
          select: 'name email phone'
        }
      })
      .sort('-createdAt');

    // Extract property units from likes
    const likedProperties = likes.map(like => like.propertyUnit).filter(Boolean);

    res.status(200).json({
      success: true,
      count: likedProperties.length,
      data: likedProperties
    });
  } catch (error) {
    console.error("Error getting liked properties:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// @desc    Check if a property is liked by user
// @route   GET /api/likes/check/:propertyId
// @access  Private
exports.checkIfLiked = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const userId = req.user.id;

    // Validate propertyId
    if (!mongoose.Types.ObjectId.isValid(propertyId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid property ID"
      });
    }

    const isLiked = await Like.findOne({ 
      user: userId, 
      propertyUnit: propertyId 
    });

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
// @route   GET /api/likes/count/:propertyId
// @access  Public
exports.getLikeCount = async (req, res) => {
  try {
    const { propertyId } = req.params;

    // Validate propertyId
    if (!mongoose.Types.ObjectId.isValid(propertyId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid property ID"
      });
    }

    const count = await Like.countDocuments({ propertyUnit: propertyId });

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
// @route   POST /api/likes/toggle/:propertyId
// @access  Private
exports.toggleLike = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const userId = req.user.id;

    // Validate propertyId
    if (!mongoose.Types.ObjectId.isValid(propertyId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid property ID"
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

    let action;
    let like;

    if (existingLike) {
      // Unlike
      await existingLike.deleteOne();
      property.likes = Math.max(0, (property.likes || 0) - 1);
      action = 'unliked';
    } else {
      // Like
      like = await Like.create({
        user: userId,
        propertyUnit: propertyId
      });
      property.likes = (property.likes || 0) + 1;
      action = 'liked';
    }

    await property.save();

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
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};