// controllers/userController.js
const User = require('../models/user');
const Property = require('../models/property');
const Enquiry = require('../models/enquiries');
const cloudinary = require('../config/cloudinary');
const fs = require('fs');
const Agent = require('../models/Agent');
const bcrypt = require('bcryptjs');
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
// controllers/userController.js

// @desc    Update user profile and handle agent status change
// @route   PUT /api/users/profile
// @access  Private
// controllers/userController.js

// controllers/userController.js

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
      notifications,
      // Password fields
      currentPassword,
      newPassword,
      confirmNewPassword
    } = req.body;

    // Get current user
    const user = await User.findById(userId).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Track if user type is changing to agent
    const isChangingToAgent = userType === 'agent' && user.userType !== 'agent';

    // ==================== PASSWORD UPDATE LOGIC ====================
    let passwordUpdated = false;
    
    // Handle password update for Google Auth users (set password for first time)
    if (user.isGoogleAuth && newPassword) {
      // Google Auth users don't have a password initially
      // They can set a password without providing current password
      
      // Validate new password
      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'New password must be at least 6 characters long'
        });
      }

      // Check if new password matches confirm password
      if (newPassword !== confirmNewPassword) {
        return res.status(400).json({
          success: false,
          message: 'New password and confirm password do not match'
        });
      }

      // Set the new password
      user.password = newPassword;
      passwordUpdated = true;
    }
    // Handle password update for normal users (require current password)
    else if (newPassword || confirmNewPassword || currentPassword) {
      // Validate that all password fields are provided
      if (!currentPassword || !newPassword || !confirmNewPassword) {
        return res.status(400).json({
          success: false,
          message: 'Please provide current password, new password, and confirm new password to update password'
        });
      }

      // Verify current password
      const isPasswordValid = await user.comparePassword(currentPassword);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }

      // Validate new password length
      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'New password must be at least 6 characters long'
        });
      }

      // Check if new password matches confirm password
      if (newPassword !== confirmNewPassword) {
        return res.status(400).json({
          success: false,
          message: 'New password and confirm password do not match'
        });
      }

      // Check if new password is different from current password
      if (newPassword === currentPassword) {
        return res.status(400).json({
          success: false,
          message: 'New password must be different from current password'
        });
      }

      // Set the new password
      user.password = newPassword;
      passwordUpdated = true;
    }

    // ==================== VALIDATIONS ====================
    // Validate phone number
    const phoneRegex = /^[6-9]\d{9}$/;
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (!phoneRegex.test(cleanPhone)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid 10-digit Indian phone number'
      });
    }

    // Validate Google auth users phone number update
    if (user.isGoogleAuth && cleanPhone === '1234567890') {
      return res.status(400).json({
        success: false,
        message: 'Please update your phone number from the default value'
      });
    }

    // ==================== PREPARE UPDATE DATA ====================
    let updateData = {
      name: name?.trim(),
      lastName: lastName?.trim(),
      phoneNumber: cleanPhone,
      userType: userType || user.userType,
      alternativePhoneNumber: alternativePhoneNumber ? alternativePhoneNumber.replace(/\D/g, '') : '',
      company: company?.trim(),
      languages: Array.isArray(languages) ? languages : (languages ? languages.split(',').map(l => l.trim()) : []),
      officeAddress: officeAddress || {},
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      gender: gender || '',
      occupation: occupation?.trim(),
      preferredLocation: preferredLocation?.trim(),
      about: about?.trim(),
      interests: Array.isArray(interests) ? interests : (interests ? interests.split(',').map(i => i.trim()) : []),
      website: website?.trim(),
      specialization: Array.isArray(specialization) ? specialization : (specialization ? specialization.split(',').map(s => s.trim()) : []),
      contactPreferences: contactPreferences || {
        phone: true,
        email: true,
        whatsapp: true,
        sms: false
      },
      socialMedia: socialMedia || {
        facebook: '',
        twitter: '',
        linkedin: '',
        instagram: ''
      },
      notifications: notifications || {
        emailNotifications: true,
        propertyAlerts: true,
        priceDropAlerts: true,
        newPropertyAlerts: true
      }
    };

    // Handle email update if provided and changed
    if (gmail && gmail !== user.gmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(gmail)) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid email address'
        });
      }

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

    // Save user first if password was updated
    if (passwordUpdated) {
      await user.save();
    }

    // Update user with the prepared data
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    // ==================== AGENT-SPECIFIC LOGIC ====================
    // Handle agent-specific logic if user changed to agent
    if (isChangingToAgent) {
      // Check if agent profile already exists
      const existingAgent = await Agent.findOne({ user: userId });
      
      if (!existingAgent) {
        // Update user with agent approval status - but DON'T open modal automatically
        // Just update the status, frontend will handle modal opening
        updatedUser.agentApproval = {
          status: 'pending',
          appliedAt: new Date()
        };
        await updatedUser.save();
        
        // Return response - frontend will open modal when user explicitly clicks to apply
        return res.status(200).json({
          success: true,
          message: 'Profile updated to agent. Please complete your agent registration.',
          requiresAgentApplication: true,
          passwordUpdated: passwordUpdated,
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
            agentApproval: updatedUser.agentApproval
          }
        });
      } else {
        // Agent profile already exists
        return res.status(200).json({
          success: true,
          message: 'Profile updated successfully',
          requiresAgentApplication: false,
          passwordUpdated: passwordUpdated,
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
            agentApproval: updatedUser.agentApproval,
            agentProfile: existingAgent._id
          }
        });
      }
    }

    // ==================== NORMAL PROFILE UPDATE RESPONSE ====================
    res.status(200).json({
      success: true,
      message: passwordUpdated ? 'Profile updated successfully. Password has been changed.' : 'Profile updated successfully',
      requiresAgentApplication: false,
      passwordUpdated: passwordUpdated,
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
        isVerified: updatedUser.isVerified
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

// Separate route for password change only
const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword, confirmNewPassword } = req.body;

    // Get user with password
    const user = await User.findById(userId).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Handle Google Auth users (set password for first time)
    if (user.isGoogleAuth) {
      // Google Auth users don't need current password to set a new one
      if (!newPassword || !confirmNewPassword) {
        return res.status(400).json({
          success: false,
          message: 'Please provide new password and confirm password'
        });
      }

      // Validate new password
      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'New password must be at least 6 characters long'
        });
      }

      // Check if passwords match
      if (newPassword !== confirmNewPassword) {
        return res.status(400).json({
          success: false,
          message: 'New password and confirm password do not match'
        });
      }

      // Set the new password
      user.password = newPassword;
      await user.save();

      return res.status(200).json({
        success: true,
        message: 'Password set successfully! You can now login with password.'
      });
    }

    // Handle normal users (require current password)
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide current password, new password, and confirm new password'
      });
    }

    // Verify current password
    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Validate new password
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long'
      });
    }

    // Check if passwords match
    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password and confirm password do not match'
      });
    }

    // Check if new password is different from current
    if (newPassword === currentPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from current password'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({
      success: false,
      message: 'Error changing password',
      error: error.message
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


const applyForAgentStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const { referralCode } = req.body;

    console.log('=== APPLY FOR AGENT START ===');
    console.log('User ID:', userId);
    console.log('Referral Code:', referralCode);

    // Get user details
    const user = await User.findById(userId);
    if (!user) {
      console.log('User not found');
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log('User found:', user.email, 'User type:', user.userType);

    // Check if user already has an agent profile
    const existingAgent = await Agent.findOne({ user: userId });
    if (existingAgent) {
      console.log('Existing agent profile found');
      return res.status(400).json({
        success: false,
        message: 'You already have an agent profile',
        data: {
          agentId: existingAgent.agentId,
          referralCode: existingAgent.referralCode
        }
      });
    }

    // Check if user type is agent
    if (user.userType !== 'agent') {
      console.log('User type is not agent:', user.userType);
      return res.status(400).json({
        success: false,
        message: 'Please set your user type to "agent" first'
      });
    }

    // Process referral if provided (OPTIONAL)
    let referredByAgent = null;
    let referringAgentData = null;
    
    if (referralCode && referralCode.trim() !== '') {
      console.log('Looking for referring agent with code:', referralCode);
      const referringAgent = await Agent.findOne({ referralCode: referralCode })
        .populate('user', 'name email');
      
      if (referringAgent) {
        referredByAgent = referringAgent._id;
        referringAgentData = {
          name: referringAgent.name,
          agentId: referringAgent.agentId,
          referralCode: referringAgent.referralCode
        };
        
        console.log('Referring agent found:', referringAgent.agentId);
        
        // Add referral to the referring agent
        await referringAgent.addReferral(userId, null);
      } else {
        console.log('Invalid referral code provided, continuing without referral');
      }
    }

    // Create agent profile - let pre-save hook generate IDs
    console.log('Creating agent profile...');
    
    const agentData = {
      user: userId,
      name: user.name,
      email: user.gmail,
      phoneNumber: user.phoneNumber,
      referredBy: referredByAgent,
      isActive: true,
      company: user.company || '',
      officeAddress: user.officeAddress || {},
      specializationAreas: user.specialization || []
    };

    console.log('Agent data:', JSON.stringify(agentData, null, 2));

    const agent = new Agent(agentData);
    await agent.save();
    
    console.log('Agent created successfully:', {
      id: agent._id,
      agentId: agent.agentId,
      referralCode: agent.referralCode
    });

    // Update user with agent profile reference
    user.agentProfile = agent._id;
    user.agentApproval = {
      status: 'approved',
      appliedAt: new Date(),
      reviewedAt: new Date()
    };
    await user.save();

    console.log('User updated with agent profile');
    console.log('=== APPLY FOR AGENT SUCCESS ===');

    res.status(201).json({
      success: true,
      message: 'Agent profile created successfully!',
      data: {
        agentId: agent.agentId,
        referralCode: agent.referralCode,
        referredBy: referringAgentData,
        agentDetails: {
          id: agent._id,
          name: agent.name,
          email: agent.email,
          phoneNumber: agent.phoneNumber
        }
      }
    });
  } catch (error) {
    console.error('=== APPLY FOR AGENT ERROR ===');
    console.error('Error:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    res.status(500).json({
      success: false,
      message: 'Error creating agent profile',
      error: error.message
    });
  }
};

// @desc    Check if user has agent profile
// @route   GET /api/users/check-agent-status
// @access  Private
const checkAgentStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const agent = await Agent.findOne({ user: userId })
      .populate('referredBy', 'name agentId referralCode');
    
    if (agent) {
      // Return only the agent data - NO URL LINKS
      return res.status(200).json({
        success: true,
        hasAgentProfile: true,
        data: {
          agentId: agent.agentId,
          referralCode: agent.referralCode,
          referralCount: agent.referralCount,
          rewards: agent.rewards,
          referredBy: agent.referredBy,
          createdAt: agent.createdAt
        }
      });
    }
    
    res.status(200).json({
      success: true,
      hasAgentProfile: false
    });
  } catch (error) {
    console.error('Check agent status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking agent status'
    });
  }
};


exports.applyForAgentStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const { referralCode } = req.body;

    // Get user details
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user already has an agent profile
    const existingAgent = await Agent.findOne({ user: userId });
    if (existingAgent) {
      return res.status(400).json({
        success: false,
        message: 'You already have an agent profile',
        data: {
          agentId: existingAgent.agentId,
          referralCode: existingAgent.referralCode
        }
      });
    }

    // Check if user type is agent
    if (user.userType !== 'agent') {
      return res.status(400).json({
        success: false,
        message: 'Please set your user type to "agent" first'
      });
    }

    // Process referral if provided (OPTIONAL - no error if invalid)
    let referredByAgent = null;
    let referringAgentData = null;
    
    if (referralCode && referralCode.trim() !== '') {
      const referringAgent = await Agent.findOne({ referralCode: referralCode })
        .populate('user', 'name email');
      
      if (referringAgent) {
        referredByAgent = referringAgent._id;
        referringAgentData = {
          name: referringAgent.name,
          agentId: referringAgent.agentId,
          referralCode: referringAgent.referralCode
        };
        
        // Add referral to the referring agent
        await referringAgent.addReferral(userId, null);
      }
      // If referral code is invalid, just ignore it - don't block agent creation
    }

    // Create agent profile
    const agent = await Agent.create({
      user: userId,
      name: user.name,
      email: user.gmail,
      phoneNumber: user.phoneNumber,
      referredBy: referredByAgent,
      isActive: true,
      company: user.company,
      officeAddress: user.officeAddress,
      specializationAreas: user.specialization || []
    });

    // Update user with agent profile reference
    user.agentProfile = agent._id;
    user.agentApproval = {
      status: 'approved',
      appliedAt: new Date(),
      reviewedAt: new Date()
    };
    await user.save();

    res.status(201).json({
      success: true,
      message: 'Agent profile created successfully!',
      data: {
        agentId: agent.agentId,
        referralCode: agent.referralCode,
        referredBy: referringAgentData,
        agentDetails: {
          id: agent._id,
          name: agent.name,
          email: agent.email,
          phoneNumber: agent.phoneNumber
        }
      }
    });
  } catch (error) {
    console.error('Apply for agent status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating agent profile',
      error: error.message
    });
  }
};

// @desc    Check if user has agent profile
// @route   GET /api/users/check-agent-status
// @access  Private
exports.checkAgentStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const agent = await Agent.findOne({ user: userId })
      .populate('referredBy', 'name agentId referralCode');
    
    if (agent) {
      return res.status(200).json({
        success: true,
        hasAgentProfile: true,
        data: {
          agentId: agent.agentId,
          referralCode: agent.referralCode,
          referralCount: agent.referralCount,
          rewards: agent.rewards,
          referredBy: agent.referredBy,
          createdAt: agent.createdAt
        }
      });
    }
    
    res.status(200).json({
      success: true,
      hasAgentProfile: false
    });
  } catch (error) {
    console.error('Check agent status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking agent status'
    });
  }
};

// @desc    Get agent profile
// @route   GET /api/agent/profile
// @access  Private
exports.getAgentProfile = async (req, res) => {
  try {
    const agent = await Agent.findOne({ user: req.user.id })
      .populate('user', 'name email phoneNumber username avatar')
      .populate('referredBy', 'name agentId referralCode')
      .populate('referralHistory.referredUser', 'name email')
      .populate('referralHistory.referredAgent', 'name agentId');

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent profile not found'
      });
    }

    res.status(200).json({
      success: true,
      data: agent
    });
  } catch (error) {
    console.error('Get agent profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching agent profile',
      error: error.message
    });
  }
};

// @desc    Get agent referral info (code only, no link generation)
// @route   GET /api/agent/referral-info
// @access  Private
exports.getReferralInfo = async (req, res) => {
  try {
    const agent = await Agent.findOne({ user: req.user.id });
    
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent profile not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        referralCode: agent.referralCode,
        referralCount: agent.referralCount,
        rewards: agent.rewards
      }
    });
  } catch (error) {
    console.error('Get referral info error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching referral info',
      error: error.message
    });
  }
};

// @desc    Schedule an appointment (client onboarding)
// @route   POST /api/agent/appointments
// @access  Private (Agent only)
exports.scheduleAppointment = async (req, res) => {
  try {
    const { 
      clientId, 
      propertyId, 
      appointmentDate, 
      appointmentTime,
      notes 
    } = req.body;

    // Validate inputs
    if (!clientId || !propertyId || !appointmentDate || !appointmentTime) {
      return res.status(400).json({
        success: false,
        message: 'Please provide clientId, propertyId, appointmentDate, and appointmentTime'
      });
    }

    // Get agent
    const agent = await Agent.findOne({ user: req.user.id });
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent profile not found'
      });
    }

    // Check if client exists
    const client = await User.findById(clientId);
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    // Check if property exists
    const property = await PropertyUnit.findById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Add appointment
    await agent.addOnboardedClient({
      client: clientId,
      property: propertyId,
      appointmentDate: new Date(appointmentDate),
      appointmentTime,
      notes: notes || '',
      status: 'scheduled'
    });

    res.status(201).json({
      success: true,
      message: 'Appointment scheduled successfully',
      data: {
        client: {
          id: client._id,
          name: client.name,
          email: client.email,
          phone: client.phoneNumber
        },
        property: {
          id: property._id,
          title: property.title,
          address: property.address
        },
        appointmentDate,
        appointmentTime
      }
    });
  } catch (error) {
    console.error('Schedule appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error scheduling appointment',
      error: error.message
    });
  }
};

// @desc    Get all appointments for agent
// @route   GET /api/agent/appointments
// @access  Private
exports.getAppointments = async (req, res) => {
  try {
    const { status, startDate, endDate } = req.query;
    
    const agent = await Agent.findOne({ user: req.user.id })
      .populate({
        path: 'appointments.client',
        select: 'name email phoneNumber'
      })
      .populate({
        path: 'appointments.property',
        select: 'title address city propertyType images'
      });

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent profile not found'
      });
    }

    let appointments = agent.appointments;

    // Filter by status
    if (status) {
      appointments = appointments.filter(apt => apt.status === status);
    }

    // Filter by date range
    if (startDate || endDate) {
      appointments = appointments.filter(apt => {
        const aptDate = new Date(apt.appointmentDate);
        if (startDate && aptDate < new Date(startDate)) return false;
        if (endDate && aptDate > new Date(endDate)) return false;
        return true;
      });
    }

    // Sort by date (newest first)
    appointments.sort((a, b) => b.appointmentDate - a.appointmentDate);

    res.status(200).json({
      success: true,
      count: appointments.length,
      data: appointments
    });
  } catch (error) {
    console.error('Get appointments error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching appointments',
      error: error.message
    });
  }
};

// @desc    Update appointment status
// @route   PUT /api/agent/appointments/:appointmentId
// @access  Private
exports.updateAppointmentStatus = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { status, feedback, dealValue } = req.body;

    const agent = await Agent.findOne({ user: req.user.id });
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent profile not found'
      });
    }

    const appointment = agent.appointments.id(appointmentId);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Update status
    appointment.status = status;
    
    // Update corresponding onboarded client record
    const clientRecord = agent.onboardedClients.find(
      c => c.client.toString() === appointment.client.toString() && 
           c.property.toString() === appointment.property.toString()
    );
    
    if (clientRecord) {
      clientRecord.status = status;
      
      if (dealValue) {
        clientRecord.dealValue = dealValue;
      }
      
      // Calculate reward (5% of deal value)
      if (status === 'closed' && dealValue) {
        const rewardAmount = dealValue * 0.05;
        clientRecord.rewardEarned = rewardAmount;
        agent.rewards += rewardAmount;
        agent.stats.totalDealValue += dealValue;
        agent.stats.completedVisits += 1;
        agent.stats.conversionRate = (agent.stats.completedVisits / agent.stats.totalAppointments) * 100;
      }
      
      if (feedback) {
        clientRecord.feedback = feedback;
      }
    }

    // Update stats
    if (status === 'cancelled' || status === 'rejected') {
      agent.stats.totalAppointments -= 1;
    }

    await agent.save();

    res.status(200).json({
      success: true,
      message: 'Appointment status updated successfully',
      data: appointment
    });
  } catch (error) {
    console.error('Update appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating appointment',
      error: error.message
    });
  }
};

// @desc    Get referral statistics
// @route   GET /api/agent/referral-stats
// @access  Private
exports.getReferralStats = async (req, res) => {
  try {
    const agent = await Agent.findOne({ user: req.user.id })
      .populate('referralHistory.referredUser', 'name email createdAt')
      .populate('referralHistory.referredAgent', 'name agentId');

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent profile not found'
      });
    }

    const activeReferrals = agent.referralHistory.filter(r => r.status === 'active');
    const convertedReferrals = agent.referralHistory.filter(r => r.status === 'converted');

    res.status(200).json({
      success: true,
      data: {
        totalReferrals: agent.referralCount,
        activeReferrals: activeReferrals.length,
        convertedReferrals: convertedReferrals.length,
        totalRewards: agent.rewards,
        referralHistory: agent.referralHistory,
        referralCode: agent.referralCode
      }
    });
  } catch (error) {
    console.error('Get referral stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching referral statistics',
      error: error.message
    });
  }
};

// @desc    Get agent dashboard stats
// @route   GET /api/agent/dashboard
// @access  Private
exports.getDashboardStats = async (req, res) => {
  try {
    const agent = await Agent.findOne({ user: req.user.id });

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent profile not found'
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const upcomingAppointments = agent.appointments.filter(apt => 
      apt.status === 'scheduled' && new Date(apt.appointmentDate) >= today
    );

    const recentActivities = agent.onboardedClients
      .sort((a, b) => b.visitedAt - a.visitedAt)
      .slice(0, 5);

    res.status(200).json({
      success: true,
      data: {
        stats: {
          totalReferrals: agent.referralCount,
          totalRewards: agent.rewards,
          totalAppointments: agent.stats?.totalAppointments || 0,
          completedVisits: agent.stats?.completedVisits || 0,
          totalDealValue: agent.stats?.totalDealValue || 0,
          conversionRate: agent.stats?.conversionRate || 0,
          clientsCount: agent.clientsCount
        },
        upcomingAppointments: upcomingAppointments.length,
        recentActivities: recentActivities
      }
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard stats',
      error: error.message
    });
  }
};

// @desc    Track referral signup (called during user registration)
// @route   POST /api/agent/track-referral
// @access  Public
exports.trackReferralSignup = async (req, res) => {
  try {
    const { referralCode, userId } = req.body;

    if (!referralCode || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Referral code and user ID are required'
      });
    }

    const agent = await Agent.findOne({ referralCode });
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Invalid referral code'
      });
    }

    await agent.trackReferralSignup(userId);

    res.status(200).json({
      success: true,
      message: 'Referral tracked successfully'
    });
  } catch (error) {
    console.error('Track referral error:', error);
    res.status(500).json({
      success: false,
      message: 'Error tracking referral',
      error: error.message
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
  changePassword,uploadAvatar,applyForAgentStatus,checkAgentStatus
};