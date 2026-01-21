// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const validator = require('validator');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters long'],
    maxlength: [40, 'Username cannot exceed 40 characters']
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  userType: {
    type: String,
    required: [true, 'User type is required'],
    enum: ['buyer', 'seller', 'builder', 'developer', 'investor', 'other', 'agent'],
    default: 'buyer'
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  phoneNumber: {
    type: String,
    required: [true, 'Phone number is required'],
    validate: {
      validator: function(v) {
        if (this.isGoogleAuth && v === '1234567890') {
          return true;
        }
        return /^\+?[\d\s\-\(\)]{10,}$/.test(v);
      },
      message: 'Please provide a valid phone number'
    }
  },
  alternativePhoneNumber: {
    type: String,
    validate: {
      validator: function(v) {
        if (!v) return true;
        return /^\+?[\d\s\-\(\)]{10,}$/.test(v);
      },
      message: 'Please provide a valid phone number'
    }
  },
  gmail: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    validate: [validator.isEmail, 'Please provide a valid email address']
  },
  password: {
    type: String,
    minlength: [6, 'Password must be at least 6 characters long'],
    select: false,
    validate: {
      validator: function(v) {
        if (this.isGoogleAuth) return true;
        return v && v.length >= 6;
      },
      message: 'Password is required for non-Google sign-in users'
    }
  },
  
  // Google OAuth Fields
  googleId: {
    type: String,
    unique: true,
    sparse: true
  },
  isGoogleAuth: {
    type: Boolean,
    default: false
  },
  avatar: {
    type: String,
    default: ''
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  lastLogin: {
    type: Date
  },
  
  // Business Information
  company: {
    type: String,
    trim: true
  },
  languages: [{
    type: String,
    trim: true
  }],
  officeAddress: {
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    pincode: { type: String, trim: true }
  },
  
  // Personal Information
  dateOfBirth: {
    type: Date
  },
  occupation: {
    type: String,
    trim: true
  },
  preferredLocation: {
    type: String,
    trim: true
  },
  
  // Contact Preferences
  contactPreferences: {
    phone: { type: Boolean, default: true },
    email: { type: Boolean, default: true },
    whatsapp: { type: Boolean, default: true },
    sms: { type: Boolean, default: false }
  },
  
  specialization: [{
    type: String,
    trim: true
  }],
  website: {
    type: String,
    trim: true
  },
  socialMedia: {
    facebook: { type: String, trim: true },
    twitter: { type: String, trim: true },
    linkedin: { type: String, trim: true },
    instagram: { type: String, trim: true }
  },
  
  // Array of properties liked by the user
  likedProperties: [{
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      required: true
    },
    likedAt: {
      type: Date,
      default: Date.now
    }
  }],
  sourceWebsite: {
    type: String,
    enum: ['saimgroups', 'cleartitle1', 'direct'],
    default: 'direct'
  },

  // Individual website login tracking
  websiteLogins: {
    saimgroups: {
      hasLoggedIn: { type: Boolean, default: false },
      firstLogin: { type: Date },
      lastLogin: { type: Date },
      loginCount: { type: Number, default: 0 }
    },
    cleartitle1: {
      hasLoggedIn: { type: Boolean, default: false },
      firstLogin: { type: Date },
      lastLogin: { type: Date },
      loginCount: { type: Number, default: 0 }
    }
  },

  // Array of properties posted by the user
  postedProperties: [{
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      required: true
    },
    postedAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['active', 'sold', 'rented', 'expired', 'draft'],
      default: 'active'
    }
  }],
  
  // Settings and Preferences
  notifications: {
    emailNotifications: { type: Boolean, default: true },
    propertyAlerts: { type: Boolean, default: true },
    priceDropAlerts: { type: Boolean, default: true },
    newPropertyAlerts: { type: Boolean, default: true }
  },
  
  // Verification
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationDate: {
    type: Date
  },
  
  // Additional Info
  about: {
    type: String,
    trim: true,
    maxlength: [1000, 'About section cannot exceed 1000 characters']
  },
  interests: [{
    type: String,
    trim: true
  }],
  
  // ========== AGENT APPROVAL SYSTEM ==========
  // Agent approval status (only for users with userType 'agent')
  agentApproval: {
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'suspended'],
      default: 'pending'
    },
    appliedAt: {
      type: Date,
      default: null
    },
    reviewedAt: {
      type: Date,
      default: null
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: [500, 'Rejection reason cannot exceed 500 characters']
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Notes cannot exceed 1000 characters']
    }
  },
  
  // Agent profile reference (only for approved agents)
  agentProfile: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent',
    default: null
  },
  // ===========================================
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  if (this.password) {
    this.password = await bcrypt.hash(this.password, 12);
  }
  next();
});

// Middleware to handle agent registration workflow
userSchema.pre('save', async function(next) {
  try {
    // If userType is being set/changed to 'agent'
    if (this.isModified('userType') && this.userType === 'agent') {
      // Set agent approval status to pending if not already approved
      if (!this.agentApproval || this.agentApproval.status !== 'approved') {
        this.agentApproval = this.agentApproval || {};
        this.agentApproval.status = 'pending';
        this.agentApproval.appliedAt = new Date();
      }
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (this.isGoogleAuth) {
    return false;
  }
  return await bcrypt.compare(candidatePassword, this.password);
};

// Get signed JWT token
userSchema.methods.getSignedJwtToken = function() {
  return jwt.sign(
    { 
      id: this._id, 
      username: this.username, 
      userType: this.userType,
      isAdmin: this.isAdmin,
      isGoogleAuth: this.isGoogleAuth,
      sourceWebsite: this.sourceWebsite,
      agentProfile: this.agentProfile,
      agentApprovalStatus: this.userType === 'agent' ? this.agentApproval.status : null
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE }
  );
};

// ========== AGENT APPROVAL METHODS ==========

// Method to check if user is an approved agent
userSchema.methods.isApprovedAgent = function() {
  return this.userType === 'agent' && 
         this.agentApproval.status === 'approved' && 
         this.agentProfile !== null;
};

// Method to check if user is a pending agent
userSchema.methods.isPendingAgent = function() {
  return this.userType === 'agent' && this.agentApproval.status === 'pending';
};

// Method to check if user is a rejected agent
userSchema.methods.isRejectedAgent = function() {
  return this.userType === 'agent' && this.agentApproval.status === 'rejected';
};

// Method to check if user is a suspended agent
userSchema.methods.isSuspendedAgent = function() {
  return this.userType === 'agent' && this.agentApproval.status === 'suspended';
};

// Method to apply for agent (called when user registers as agent)
userSchema.methods.applyForAgent = async function() {
  if (this.userType !== 'agent') {
    throw new Error('User must have userType "agent" to apply');
  }
  
  this.agentApproval = {
    status: 'pending',
    appliedAt: new Date()
  };
  
  await this.save();
  return this;
};

// ===========================================

// Method to add liked property
userSchema.methods.addLikedProperty = async function(propertyId) {
  if (!this.likedProperties.some(item => item.property.toString() === propertyId)) {
    this.likedProperties.push({
      property: propertyId,
      likedAt: new Date()
    });
    await this.save();
  }
  return this;
};

// Method to remove liked property
userSchema.methods.removeLikedProperty = async function(propertyId) {
  this.likedProperties = this.likedProperties.filter(
    item => item.property.toString() !== propertyId
  );
  await this.save();
  return this;
};

// Method to check if property is liked
userSchema.methods.isPropertyLiked = function(propertyId) {
  return this.likedProperties.some(
    item => item.property.toString() === propertyId
  );
};

module.exports = mongoose.model('User', userSchema);