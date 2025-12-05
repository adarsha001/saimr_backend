// controllers/userController.js
const User = require('../models/user');
const Property = require('../models/property');
const Enquiry = require('../models/enquiries');
const cloudinary = require('../config/cloudinary');
const fs = require('fs');

// Get user profile
// controllers/userController.js - getUserProfile function
const getUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId)
      .select('-password')
      .populate({
        path: 'likedProperties.property',
        select: 'title price city category images propertyLocation attributes isVerified isFeatured approvalStatus createdAt'
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

    // Filter out null properties and only approved properties
    const validLikedProperties = user.likedProperties.filter(
      item => item.property && 
              item.property._id && 
              item.property.approvalStatus === 'approved'
    );

    // Filter posted properties
    const validPostedProperties = user.postedProperties.filter(
      item => item.property && item.property._id
    );

    // Calculate property statistics
    const propertyStats = {
      total: validPostedProperties.length,
      approved: validPostedProperties.filter(p => p.property.approvalStatus === 'approved').length,
      pending: validPostedProperties.filter(p => p.property.approvalStatus === 'pending').length,
      rejected: validPostedProperties.filter(p => p.property.approvalStatus === 'rejected').length
    };

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        lastName: user.lastName,
        username: user.username,
        gmail: user.gmail,
        userType: user.userType,
        phoneNumber: user.phoneNumber,
        alternativePhoneNumber: user.alternativePhoneNumber,
        isAdmin: user.isAdmin,
        isGoogleAuth: user.isGoogleAuth,
        avatar: user.avatar,
        company: user.company,
        languages: user.languages,
        officeAddress: user.officeAddress,
        dateOfBirth: user.dateOfBirth,
        gender: user.gender,
        occupation: user.occupation,
        preferredLocation: user.preferredLocation,
        about: user.about,
        interests: user.interests,
        website: user.website,
        specialization: user.specialization,
        contactPreferences: user.contactPreferences,
        socialMedia: user.socialMedia,
        notifications: user.notifications,
        isVerified: user.isVerified,
        likedProperties: validLikedProperties, // Use filtered liked properties
        postedProperties: validPostedProperties, // Use filtered posted properties
        propertyStats,
        requiresPhoneUpdate: user.isGoogleAuth && user.phoneNumber === '1234567890',
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get user's posted properties with filtering options

// Update user profile
const updateUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      name,
      lastName,
      phoneNumber,
      alternativePhoneNumber,
      gmail,
      userType,
      company,
      languages,
      officeAddress,
      dateOfBirth,
      gender,
      occupation,
      preferredLocation,
      about,
      interests,
      website,
      specialization,
      contactPreferences,
      socialMedia,
      notifications
    } = req.body;

    console.log('Updating profile for user:', userId);

    // Validate required fields
    if (!name || !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Name and phone number are required'
      });
    }

    // Validate phone number format
    const phoneRegex = /^[6-9]\d{9}$/;
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (!phoneRegex.test(cleanPhone)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid 10-digit Indian phone number'
      });
    }

    // Validate alternative phone number if provided
    if (alternativePhoneNumber) {
      const cleanAltPhone = alternativePhoneNumber.replace(/\D/g, '');
      if (!phoneRegex.test(cleanAltPhone)) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid 10-digit Indian phone number for alternative phone'
        });
      }
    }

    // For Google users, check if they're updating from dummy number
    const user = await User.findById(userId);
    if (user.isGoogleAuth && user.phoneNumber === '1234567890' && cleanPhone === '1234567890') {
      return res.status(400).json({
        success: false,
        message: 'Please update your phone number from the default value'
      });
    }

    // Prepare update data
    const updateData = {
      name: name.trim(),
      lastName: lastName?.trim(),
      phoneNumber: cleanPhone,
      userType: userType || user.userType || 'buyer',
      alternativePhoneNumber: alternativePhoneNumber ? alternativePhoneNumber.replace(/\D/g, '') : ''
    };

    // Only update email if provided and different
    if (gmail && gmail !== user.gmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(gmail)) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid email address'
        });
      }

      // Check if email is already taken by another user
      const existingUser = await User.findOne({ 
        gmail: gmail.toLowerCase(),
        _id: { $ne: userId }
      });
      
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email is already taken by another user'
        });
      }
      
      updateData.gmail = gmail.toLowerCase().trim();
    }

    // Update company and business info
    updateData.company = company?.trim();
    updateData.website = website?.trim();
    updateData.occupation = occupation?.trim();
    updateData.preferredLocation = preferredLocation?.trim();
    updateData.about = about?.trim();
    
    // Parse languages
    if (languages) {
      updateData.languages = Array.isArray(languages) 
        ? languages.map(lang => lang.trim()).filter(lang => lang.length > 0)
        : languages.split(',').map(lang => lang.trim()).filter(lang => lang.length > 0);
    }

    // Parse interests
    if (interests) {
      updateData.interests = Array.isArray(interests)
        ? interests.map(interest => interest.trim()).filter(interest => interest.length > 0)
        : interests.split(',').map(interest => interest.trim()).filter(interest => interest.length > 0);
    }

    // Parse specialization
    if (specialization) {
      updateData.specialization = Array.isArray(specialization)
        ? specialization.map(spec => spec.trim()).filter(spec => spec.length > 0)
        : specialization.split(',').map(spec => spec.trim()).filter(spec => spec.length > 0);
    }

    // Update personal info
    if (dateOfBirth) {
      updateData.dateOfBirth = new Date(dateOfBirth);
    }
    updateData.gender = gender;

    // Update contact preferences
    if (contactPreferences) {
      updateData.contactPreferences = {
        phone: contactPreferences.phone || false,
        email: contactPreferences.email || false,
        whatsapp: contactPreferences.whatsapp || false,
        sms: contactPreferences.sms || false
      };
    }

    // Update social media
    if (socialMedia) {
      updateData.socialMedia = {
        facebook: socialMedia.facebook?.trim() || '',
        twitter: socialMedia.twitter?.trim() || '',
        linkedin: socialMedia.linkedin?.trim() || '',
        instagram: socialMedia.instagram?.trim() || ''
      };
    }

    // Update notifications
    if (notifications) {
      updateData.notifications = {
        emailNotifications: notifications.emailNotifications || false,
        propertyAlerts: notifications.propertyAlerts || false,
        priceDropAlerts: notifications.priceDropAlerts || false,
        newPropertyAlerts: notifications.newPropertyAlerts || false
      };
    }

    // Add office address if provided
    if (officeAddress && typeof officeAddress === 'object') {
      updateData.officeAddress = {
        street: officeAddress.street?.trim() || '',
        city: officeAddress.city?.trim() || '',
        state: officeAddress.state?.trim() || '',
        pincode: officeAddress.pincode?.trim() || ''
      };
    }

    // Update user in database
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    console.log('Profile updated successfully for:', updatedUser.email);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        lastName: updatedUser.lastName,
        username: updatedUser.username,
        gmail: updatedUser.gmail,
        userType: updatedUser.userType,
        phoneNumber: updatedUser.phoneNumber,
        alternativePhoneNumber: updatedUser.alternativePhoneNumber,
        isAdmin: updatedUser.isAdmin,
        isGoogleAuth: updatedUser.isGoogleAuth,
        avatar: updatedUser.avatar,
        company: updatedUser.company,
        languages: updatedUser.languages,
        officeAddress: updatedUser.officeAddress,
        dateOfBirth: updatedUser.dateOfBirth,
        gender: updatedUser.gender,
        occupation: updatedUser.occupation,
        preferredLocation: updatedUser.preferredLocation,
        about: updatedUser.about,
        interests: updatedUser.interests,
        website: updatedUser.website,
        specialization: updatedUser.specialization,
        contactPreferences: updatedUser.contactPreferences,
        socialMedia: updatedUser.socialMedia,
        notifications: updatedUser.notifications,
        isVerified: updatedUser.isVerified,
        requiresPhoneUpdate: updatedUser.isGoogleAuth && updatedUser.phoneNumber === '1234567890'
      }
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

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error updating profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Upload avatar to Cloudinary
const uploadAvatar = async (req, res) => {
  try {
    console.log('Avatar upload request received');
    console.log('Request file:', req.file);

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      // Clean up temp file
      if (req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log('User found:', user.email);

    // If user has existing avatar on Cloudinary, delete it
    if (user.avatar && user.avatar.includes('cloudinary')) {
      try {
        const urlParts = user.avatar.split('/');
        const filename = urlParts[urlParts.length - 1];
        const publicId = filename.split('.')[0];
        const folder = 'cleartitle/avatars';
        const fullPublicId = `${folder}/${publicId}`;
        
        await cloudinary.uploader.destroy(fullPublicId);
        console.log('Deleted old Cloudinary avatar:', fullPublicId);
      } catch (cloudinaryError) {
        console.error('Error deleting old Cloudinary avatar:', cloudinaryError);
      }
    }

    // Upload new avatar to Cloudinary
    console.log('Uploading to Cloudinary...');
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'cleartitle/avatars',
      width: 500,
      height: 500,
      crop: 'fill',
      gravity: 'face',
      format: 'jpg',
      quality: 'auto'
    });

    console.log('Cloudinary upload successful:', result.secure_url);

    // Delete the temporary local file
    try {
      if (req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
        console.log('Deleted temporary file:', req.file.path);
      }
    } catch (unlinkError) {
      console.error('Error deleting temp file:', unlinkError);
    }

    // Update user with new avatar URL
    user.avatar = result.secure_url;
    await user.save();

    res.json({
      success: true,
      message: 'Avatar uploaded successfully',
      avatarUrl: result.secure_url
    });
  } catch (error) {
    console.error('Error in uploadAvatar:', error);
    
    // Clean up temp file on error
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('Error cleaning up temp file:', unlinkError);
      }
    }

    res.status(500).json({
      success: false,
      message: 'Error uploading avatar',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get user's enquiries
const getUserEnquiries = async (req, res) => {
  try {
    const userId = req.user.id;

    // Find enquiries for the user
    const enquiries = await Enquiry.find({ user: userId })
      .sort({ createdAt: -1 }); // Removed populate since no property field exists

    // Format the enquiries for response
    const formattedEnquiries = enquiries.map(enquiry => ({
      _id: enquiry._id,
      name: enquiry.name,
      phoneNumber: enquiry.phoneNumber,
      message: enquiry.message,
      status: enquiry.status,
      createdAt: enquiry.createdAt,
      updatedAt: enquiry.updatedAt,
      // Add formatted phone number
      formattedPhone: enquiry.phoneNumber.replace(/\D/g, '').length === 10 
        ? `${enquiry.phoneNumber.replace(/\D/g, '').slice(0, 5)}-${enquiry.phoneNumber.replace(/\D/g, '').slice(5)}`
        : enquiry.phoneNumber,
      // Add status badge class (for frontend)
      statusBadge: getStatusBadge(enquiry.status)
    }));

    res.json({
      success: true,
      enquiries: formattedEnquiries,
      count: enquiries.length,
      stats: {
        total: enquiries.length,
        new: enquiries.filter(e => e.status === 'new').length,
        inProgress: enquiries.filter(e => e.status === 'in-progress').length,
        resolved: enquiries.filter(e => e.status === 'resolved').length,
        closed: enquiries.filter(e => e.status === 'closed').length
      }
    });
  } catch (error) {
    console.error('Error fetching user enquiries:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user enquiries',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Helper function for status badges
const getStatusBadge = (status) => {
  const statusColors = {
    'new': 'bg-blue-100 text-blue-800 border border-blue-200',
    'in-progress': 'bg-yellow-100 text-yellow-800 border border-yellow-200',
    'resolved': 'bg-green-100 text-green-800 border border-green-200',
    'closed': 'bg-gray-100 text-gray-800 border border-gray-200'
  };
  return statusColors[status] || 'bg-gray-100 text-gray-800 border border-gray-200';
};

// Delete user account
const deleteUserAccount = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    // Delete avatar from Cloudinary if exists
    if (user.avatar && user.avatar.includes('cloudinary')) {
      try {
        const urlParts = user.avatar.split('/');
        const filename = urlParts[urlParts.length - 1];
        const publicId = filename.split('.')[0];
        const folder = 'cleartitle/avatars';
        const fullPublicId = `${folder}/${publicId}`;
        
        await cloudinary.uploader.destroy(fullPublicId);
      } catch (cloudinaryError) {
        console.error('Error deleting Cloudinary avatar:', cloudinaryError);
      }
    }

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
      message: 'Error deleting account',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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
      message: 'Error fetching liked properties',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const getPostedProperties = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    // Find user with basic info
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get property IDs from user's postedProperties
    const propertyIds = user.postedProperties.map(item => item.property);

    // Build filter for properties
    const propertyFilter = { _id: { $in: propertyIds } };
    
    // Add status filter if provided
    if (status && status !== 'all') {
      propertyFilter.approvalStatus = status;
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Find properties directly
    const properties = await Property.find(propertyFilter)
      .select('title price city category images propertyLocation attributes isVerified isFeatured approvalStatus rejectionReason createdAt updatedAt')
      .sort(sort);

    // Map properties with user-specific data (postedAt, status)
    const postedProperties = properties.map(property => {
      const userPropertyInfo = user.postedProperties.find(
        item => item.property.toString() === property._id.toString()
      );
      
      return {
        ...property.toObject(),
        postedAt: userPropertyInfo?.postedAt || property.createdAt,
        status: userPropertyInfo?.status || 'active'
      };
    });

    // Calculate statistics
    const stats = {
      total: postedProperties.length,
      approved: postedProperties.filter(p => p.approvalStatus === 'approved').length,
      pending: postedProperties.filter(p => p.approvalStatus === 'pending').length,
      rejected: postedProperties.filter(p => p.approvalStatus === 'rejected').length,
      active: postedProperties.filter(p => p.status === 'active').length,
      sold: postedProperties.filter(p => p.status === 'sold').length,
      rented: postedProperties.filter(p => p.status === 'rented').length,
      expired: postedProperties.filter(p => p.status === 'expired').length,
      draft: postedProperties.filter(p => p.status === 'draft').length
    };

    res.json({
      success: true,
      postedProperties,
      stats,
      count: postedProperties.length
    });
  } catch (error) {
    console.error('Error fetching posted properties:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching posted properties',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};




module.exports = {
  getUserProfile,
  getUserEnquiries,
  updateUserProfile,
  deleteUserAccount,
  getLikedProperties,
  getPostedProperties,
  uploadAvatar,
};