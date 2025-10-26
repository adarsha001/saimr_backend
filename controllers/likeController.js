const User = require('../models/user');
const Property = require('../models/property');

// Like a property
const likeProperty = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const userId = req.user.id;

    // Check if property exists
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

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

    // Add to liked properties
    await user.addToLikedProperties(propertyId);

    res.status(200).json({
      success: true,
      message: 'Property added to favorites',
      likedProperties: user.likedProperties
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error liking property'
    });
  }
};

// Unlike a property
const unlikeProperty = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const userId = req.user.id;

    const user = await User.findById(userId);
    
    // Check if property is liked
    const isLiked = user.likedProperties.some(
      item => item.property.toString() === propertyId
    );

    if (!isLiked) {
      return res.status(400).json({
        success: false,
        message: 'Property not in favorites'
      });
    }

    // Remove from liked properties
    await user.removeFromLikedProperties(propertyId);

    res.status(200).json({
      success: true,
      message: 'Property removed from favorites',
      likedProperties: user.likedProperties
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error unliking property'
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
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error checking like status'
    });
  }
};

// Toggle like/unlike
const toggleLike = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const userId = req.user.id;

    const user = await User.findById(userId);
    const property = await Property.findById(propertyId);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    const isLiked = user.likedProperties.some(
      item => item.property.toString() === propertyId
    );

    if (isLiked) {
      await user.removeFromLikedProperties(propertyId);
      res.status(200).json({
        success: true,
        message: 'Property removed from favorites',
        isLiked: false
      });
    } else {
      await user.addToLikedProperties(propertyId);
      res.status(200).json({
        success: true,
        message: 'Property added to favorites',
        isLiked: true
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error toggling like'
    });
  }
};

module.exports = {
  likeProperty,
  unlikeProperty,
  checkIfLiked,
  toggleLike
};