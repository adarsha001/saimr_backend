const User = require('../models/user');
const Property = require('../models/property');
const Enquiry = require('../models/enquiries');

// Get complete user profile with properties and enquiries
const getUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user with populated liked and posted properties
    const user = await User.findById(userId)
      .select('-password')
      .populate({
        path: 'likedProperties.property',
        match: { approvalStatus: 'approved' },
        select: 'title price city category images propertyLocation attributes isVerified isFeatured createdAt approvalStatus'
      })
      .populate({
        path: 'postedProperties.property',
        select: 'title price city category images propertyLocation attributes isVerified isFeatured createdAt approvalStatus rejectionReason'
      });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Filter out null properties from liked properties
    const validLikedProperties = user.likedProperties.filter(
      item => item.property !== null && item.property.approvalStatus === 'approved'
    );

    // Calculate property statistics based on approvalStatus
    const propertyStats = {
      total: user.postedProperties.length,
      approved: user.postedProperties.filter(p => p.property?.approvalStatus === 'approved').length,
      pending: user.postedProperties.filter(p => p.property?.approvalStatus === 'pending').length,
      rejected: user.postedProperties.filter(p => p.property?.approvalStatus === 'rejected').length
    };

    res.json({
      success: true,
      user: {
        ...user.toObject(),
        likedProperties: validLikedProperties,
        postedProperties: user.postedProperties,
        propertyStats
      }
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user profile'
    });
  }
};

// Get user's enquiries
const getUserEnquiries = async (req, res) => {
  try {
    const userId = req.user.id;

    const enquiries = await Enquiry.find({ user: userId })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      enquiries
    });
  } catch (error) {
    console.error('Error fetching user enquiries:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user enquiries'
    });
  }
};

// Update user profile
const updateUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, lastName, phoneNumber, gmail, userType } = req.body;

    // Validate required fields
    if (!name || !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Name and phone number are required'
      });
    }

    // Check if email is already taken by another user
    if (gmail) {
      const existingUser = await User.findOne({ 
        gmail: gmail.toLowerCase(),
        _id: { $ne: userId }
      });
      
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email is already taken'
        });
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        name: name.trim(),
        lastName: lastName?.trim(),
        phoneNumber: phoneNumber.trim(),
        userType: userType,
        ...(gmail && { gmail: gmail.toLowerCase().trim() })
      },
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: `Validation error: ${errors.join(', ')}`
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error updating profile'
    });
  }
};

// Delete user account
const deleteUserAccount = async (req, res) => {
  try {
    const userId = req.user.id;

    // Delete user's properties
    await Property.deleteMany({ createdBy: userId });

    // Delete user's enquiries
    await Enquiry.deleteMany({ user: userId });

    // Delete user account
    await User.findByIdAndDelete(userId);

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user account:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting account'
    });
  }
};

// Get only liked properties
const getLikedProperties = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId)
      .populate({
        path: 'likedProperties.property',
        match: { approvalStatus: 'approved' },
        select: 'title price city category images propertyLocation attributes isVerified isFeatured'
      });

    const validLikedProperties = user.likedProperties.filter(
      item => item.property !== null
    );

    res.json({
      success: true,
      likedProperties: validLikedProperties
    });
  } catch (error) {
    console.error('Error fetching liked properties:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching liked properties'
    });
  }
};

// Get only posted properties with approval status
const getPostedProperties = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId)
      .populate({
        path: 'postedProperties.property',
        select: 'title price city category images propertyLocation attributes isVerified isFeatured approvalStatus rejectionReason createdAt'
      });

    res.json({
      success: true,
      postedProperties: user.postedProperties
    });
  } catch (error) {
    console.error('Error fetching posted properties:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching posted properties'
    });
  }
};

module.exports = {
  getUserProfile,
  getUserEnquiries,
  updateUserProfile,
  deleteUserAccount,
  getLikedProperties,
  getPostedProperties
};