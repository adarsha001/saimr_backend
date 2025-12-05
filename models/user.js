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
    enum: ['buyer', 'seller', 'builder', 'developer', 'agent', 'investor', 'other']
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
        // Allow dummy numbers for Google sign-in users
        if (this.isGoogleAuth && v === '1234567890') {
          return true;
        }
        return /^\+?[\d\s\-\(\)]{10,}$/.test(v);
      },
      message: 'Please provide a valid phone number'
    }
  },
  // Additional phone number for agents
  alternativePhoneNumber: {
    type: String,
    validate: {
      validator: function(v) {
        if (!v) return true; // Optional field
        return /^\+?[\d\s\-\(\)]{10,}$/.test(v);
      },
      message: 'Please provide a valid phone number'
    }
  },
  gmail: {
    type: String,
    required: [true, 'Gmail is required'],
    unique: true,
    lowercase: true,
    validate: [validator.isEmail, 'Please provide a valid gmail address']
  },
  password: {
    type: String,
    minlength: [6, 'Password must be at least 6 characters long'],
    select: false,
    validate: {
      validator: function(v) {
        // Password is not required for Google auth users
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
    sparse: true // Allows null values while maintaining uniqueness
  },
  isGoogleAuth: {
    type: Boolean,
    default: false
  },
  avatar: {
    type: String
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  lastLogin: {
    type: Date
  },
  
  // Agent-specific fields
  company: {
    type: String,
    trim: true
  },
  languages: [{
    type: String,
    trim: true
  }],
  officeAddress: {
    street: String,
    city: String,
    state: String,
    pincode: String
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
  }]
}, {
  timestamps: true
});

// Hash password before saving (only if password exists)
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  if (this.password) {
    this.password = await bcrypt.hash(this.password, 12);
  }
  next();
});

// Compare password method (handles Google auth users)
userSchema.methods.comparePassword = async function(candidatePassword) {
  // Google auth users don't have passwords
  if (this.isGoogleAuth) {
    return false;
  }
  return await bcrypt.compare(candidatePassword, this.password);
};

// Generate JWT token
userSchema.methods.getSignedJwtToken = function() {
  return jwt.sign(
    { 
      id: this._id, 
      username: this.username, 
      userType: this.userType,
      isAdmin: this.isAdmin,
      isGoogleAuth: this.isGoogleAuth
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE }
  );
};

module.exports = mongoose.model('User', userSchema);