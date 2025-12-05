const User = require('../models/user');
const Property = require('../models/property');

// Like a property
const likeProperty = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const userId = req.user.id;

    console.log(`User ${userId} liking property ${propertyId}`);

    // Check if property exists
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Find user and check if already liked
    const user = await User.findById(userId);
    
    // Check if already liked
    const alreadyLiked = user.likedProperties.some(
      item => item.property.toString() === propertyId
    );

    if (alreadyLiked) {
      return res.status(400).json({
        success: false,
        message: 'Property already liked'
      });
    }

    // Add to liked properties - CORRECTED
    user.likedProperties.push({
      property: propertyId,
      likedAt: new Date()
    });
    
    await user.save();

    console.log(`Property ${propertyId} added to user ${userId}'s favorites`);

    res.status(200).json({
      success: true,
      message: 'Property added to favorites',
      likedProperties: user.likedProperties
    });
  } catch (error) {
    console.error('Error in likeProperty:', error);
    res.status(500).json({
      success: false,
      message: 'Error liking property',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Unlike a property
const unlikeProperty = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const userId = req.user.id;

    console.log(`User ${userId} unliking property ${propertyId}`);

    const user = await User.findById(userId);
    
    // Check if property is liked
    const initialLength = user.likedProperties.length;
    user.likedProperties = user.likedProperties.filter(
      item => item.property.toString() !== propertyId
    );

    // If no change, property wasn't liked
    if (user.likedProperties.length === initialLength) {
      return res.status(400).json({
        success: false,
        message: 'Property not in favorites'
      });
    }

    await user.save();

    console.log(`Property ${propertyId} removed from user ${userId}'s favorites`);

    res.status(200).json({
      success: true,
      message: 'Property removed from favorites',
      likedProperties: user.likedProperties
    });
  } catch (error) {
    console.error('Error in unlikeProperty:', error);
    res.status(500).json({
      success: false,
      message: 'Error unliking property',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Check if property is liked by user
const checkIfLiked = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const userId = req.user.id;

    const user = await User.findById(userId);
    const isLiked = user.likedProperties.some(
      item => item.property.toString() === propertyId
    );

    res.status(200).json({
      success: true,
      isLiked
    });
  } catch (error) {
    console.error('Error in checkIfLiked:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking like status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Toggle like/unlike
const toggleLike = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const userId = req.user.id;

    console.log(`User ${userId} toggling like for property ${propertyId}`);

    const user = await User.findById(userId);
    const property = await Property.findById(propertyId);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Check if already liked
    const likedIndex = user.likedProperties.findIndex(
      item => item.property.toString() === propertyId
    );

    if (likedIndex !== -1) {
      // Unlike: Remove from array
      user.likedProperties.splice(likedIndex, 1);
      await user.save();
      
      console.log(`Property ${propertyId} unliked by user ${userId}`);
      
      res.status(200).json({
        success: true,
        message: 'Property removed from favorites',
        isLiked: false
      });
    } else {
      // Like: Add to array
      user.likedProperties.push({
        property: propertyId,
        likedAt: new Date()
      });
      await user.save();
      
      console.log(`Property ${propertyId} liked by user ${userId}`);
      
      res.status(200).json({
        success: true,
        message: 'Property added to favorites',
        isLiked: true
      });
    }
  } catch (error) {
    console.error('Error in toggleLike:', error);
    res.status(500).json({
      success: false,
      message: 'Error toggling like',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get user's liked properties
const getLikedProperties = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId)
      .populate({
        path: 'likedProperties.property',
        select: 'title price city category images propertyLocation attributes isVerified isFeatured approvalStatus'
      });

    // Filter out null properties (in case a property was deleted)
    const validLikedProperties = user.likedProperties.filter(
      item => item.property !== null
    );

    res.status(200).json({
      success: true,
      likedProperties: validLikedProperties
    });
  } catch (error) {
    console.error('Error in getLikedProperties:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching liked properties',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  likeProperty,
  unlikeProperty,
  checkIfLiked,
  toggleLike,
  getLikedProperties
};