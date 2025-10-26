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
    maxlength: [30, 'Username cannot exceed 30 characters']
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
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
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long'],
    select: false
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

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Generate JWT token
userSchema.methods.getSignedJwtToken = function() {
  return jwt.sign(
    { 
      id: this._id, 
      username: this.username, 
      userType: this.userType,
      isAdmin: this.isAdmin 
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE }
  );
};

// Method to add a property to liked properties
userSchema.methods.addToLikedProperties = function(propertyId) {
  const alreadyLiked = this.likedProperties.some(
    item => item.property.toString() === propertyId.toString()
  );
  
  if (!alreadyLiked) {
    this.likedProperties.push({ property: propertyId });
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to remove a property from liked properties
userSchema.methods.removeFromLikedProperties = function(propertyId) {
  this.likedProperties = this.likedProperties.filter(
    item => item.property.toString() !== propertyId.toString()
  );
  return this.save();
};

// Method to add a property to posted properties
userSchema.methods.addToPostedProperties = function(propertyId, status = 'active') {
  const alreadyPosted = this.postedProperties.some(
    item => item.property.toString() === propertyId.toString()
  );
  
  if (!alreadyPosted) {
    this.postedProperties.push({ 
      property: propertyId, 
      status: status 
    });
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to update status of a posted property
userSchema.methods.updatePostedPropertyStatus = function(propertyId, newStatus) {
  const postedProperty = this.postedProperties.find(
    item => item.property.toString() === propertyId.toString()
  );
  
  if (postedProperty) {
    postedProperty.status = newStatus;
    return this.save();
  }
  return Promise.resolve(this);
};

module.exports = mongoose.model('User', userSchema);