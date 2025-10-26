
const User = require('../models/user');

// Get user profile
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('likedProperties.property')
      .populate('postedProperties.property')
      .select('-password');

    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Update user profile
const updateProfile = async (req, res) => {
  try {
    const { name, lastName, phoneNumber, userType } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { name, lastName, phoneNumber, userType },
      { new: true, runValidators: true }
    ).select('-password');

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error updating profile'
    });
  }
};

// Get user's liked properties
const getLikedProperties = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('likedProperties.property')
      .select('likedProperties');

    res.status(200).json({
      success: true,
      likedProperties: user.likedProperties
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error fetching liked properties'
    });
  }
};

// Get user's posted properties
const getPostedProperties = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('postedProperties.property')
      .select('postedProperties');

    res.status(200).json({
      success: true,
      postedProperties: user.postedProperties
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error fetching posted properties'
    });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  getLikedProperties,
  getPostedProperties
};