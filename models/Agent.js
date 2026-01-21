// models/Agent.js
const mongoose = require('mongoose');

const agentSchema = new mongoose.Schema({
  agentId: {
    type: String,
    unique: true,
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  
  // Professional Information
  licenseNumber: {
    type: String,
    trim: true
  },
  experienceYears: {
    type: Number,
    min: 0,
    default: 0
  },
  specializationAreas: [{
    type: String,
    trim: true
  }],
  certifications: [{
    name: String,
    issuingAuthority: String,
    year: Number
  }],
  bio: {
    type: String,
    trim: true,
    maxlength: [2000, 'Bio cannot exceed 2000 characters']
  },
  profilePhoto: {
    type: String,
    default: ''
  },
  
  // Ratings
  ratings: {
    average: { type: Number, default: 0, min: 0, max: 5 },
    totalReviews: { type: Number, default: 0 }
  },
  
  // Social Links
  socialLinks: {
    facebook: String,
    twitter: String,
    linkedin: String,
    instagram: String,
    website: String
  },
  
  // Stats
  propertiesCount: {
    type: Number,
    default: 0,
    min: 0
  },
  clientsCount: {
    type: Number,
    default: 0,
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Approval metadata
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date,
    default: Date.now
  },
  
  // Basic info copied from User (for quick access)
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true
  },
  phoneNumber: {
    type: String,
    required: true
  },
  company: {
    type: String,
    trim: true
  },
  officeAddress: {
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    pincode: { type: String, trim: true },
    country: { type: String, default: 'India' }
  }
}, {
  timestamps: true
});

// Generate unique agentId before saving
agentSchema.pre('save', async function(next) {
  if (!this.agentId) {
    try {
      // Generate agent ID: cleartitle100001, cleartitle100002, etc.
      const lastAgent = await mongoose.model('Agent')
        .findOne({}, { agentId: 1 })
        .sort({ createdAt: -1 })
        .lean();
      
      let nextNumber = 100001; // Start from 100001
      
      if (lastAgent && lastAgent.agentId) {
        // Extract number from agentId like "cleartitle100001"
        const match = lastAgent.agentId.match(/cleartitle(\d+)/);
        if (match && match[1]) {
          nextNumber = parseInt(match[1]) + 1;
        }
      }
      
      this.agentId = `cleartitle${nextNumber}`;
    } catch (error) {
      return next(error);
    }
  }
  
  next();
});

// Indexes
agentSchema.index({ agentId: 1 }, { unique: true });
agentSchema.index({ user: 1 }, { unique: true });
agentSchema.index({ email: 1 });
agentSchema.index({ phoneNumber: 1 });
agentSchema.index({ company: 1 });
agentSchema.index({ isActive: 1 });
agentSchema.index({ 'officeAddress.city': 1 });

// Method to increment properties count
agentSchema.methods.incrementPropertiesCount = async function() {
  this.propertiesCount += 1;
  await this.save();
  return this;
};

// Method to increment clients count
agentSchema.methods.incrementClientsCount = async function() {
  this.clientsCount += 1;
  await this.save();
  return this;
};

// Method to update rating
agentSchema.methods.updateRating = async function(newRating) {
  const totalScore = this.ratings.average * this.ratings.totalReviews + newRating;
  this.ratings.totalReviews += 1;
  this.ratings.average = totalScore / this.ratings.totalReviews;
  await this.save();
  return this;
};

module.exports = mongoose.model('Agent', agentSchema);