const User = require('../models/user');
const Property = require('../models/property');

// Like a property
const likeProperty = async (req, res) => {
  try {
    // Check if user exists on request
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const { propertyId } = req.params;
    const userId = req.user.id;

    console.log(`User ${userId} liking property ${propertyId}`);

    // Validate propertyId
    if (!propertyId || propertyId.length !== 24) {
      return res.status(400).json({
        success: false,
        message: 'Invalid property ID'
      });
    }

    // Check if property exists
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Check if already liked
    const alreadyLiked = user.likedProperties.some(
      item => item.property && item.property.toString() === propertyId
    );

    if (alreadyLiked) {
      return res.status(400).json({
        success: false,
        message: 'Property already liked'
      });
    }

    // Add to liked properties
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
    
    // More specific error handling
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid ID format'
      });
    }
    
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
    // Check if user exists on request
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const { propertyId } = req.params;
    const userId = req.user.id;

    console.log(`User ${userId} unliking property ${propertyId}`);

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Check if property is liked
    const initialLength = user.likedProperties.length;
    user.likedProperties = user.likedProperties.filter(
      item => item.property && item.property.toString() !== propertyId
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
    // Check if user exists on request
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const { propertyId } = req.params;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const isLiked = user.likedProperties.some(
      item => item.property && item.property.toString() === propertyId
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
    // Check if user exists on request
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const { propertyId } = req.params;
    const userId = req.user.id;

    console.log(`User ${userId} toggling like for property ${propertyId}`);

    // Validate propertyId
    if (!propertyId || propertyId.length !== 24) {
      return res.status(400).json({
        success: false,
        message: 'Invalid property ID'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Check if already liked
    const likedIndex = user.likedProperties.findIndex(
      item => item.property && item.property.toString() === propertyId
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
      
      res.status(500).json({
        success: true,
        message: 'Property added to favorites',
        isLiked: true
      });
    }
  } catch (error) {
    console.error('Error in toggleLike:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid ID format'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error toggling like',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get user's liked properties
// controllers/likeController.js
const getLikedProperties = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const userId = req.user.id;

    // Find user and populate liked properties
    const user = await User.findById(userId)
      .populate({
        path: 'likedProperties.property',
        select: 'title price city category images propertyLocation attributes isVerified isFeatured approvalStatus'
      });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Filter out null properties and only get approved properties
    const validLikedProperties = user.likedProperties.filter(
      item => item.property && 
              item.property._id && 
              item.property.approvalStatus === 'approved'
    );

    res.status(200).json({
      success: true,
      likedProperties: validLikedProperties,
      count: validLikedProperties.length
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