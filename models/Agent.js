const mongoose = require('mongoose');

const agentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Agent name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
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
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
    unique: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  company: {
    type: String,
    trim: true,
    maxlength: [100, 'Company name cannot exceed 100 characters']
  },
  languages: [{
    type: String,
    trim: true
  }],
  officeAddress: {
    street: {
      type: String,
      trim: true
    },
    city: {
      type: String,
      trim: true
    },
    state: {
      type: String,
      trim: true
    },
    pincode: {
      type: String,
      trim: true
    },
    country: {
      type: String,
      trim: true,
      default: 'India'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  propertiesCount: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true
});

// Index for better query performance
agentSchema.index({ email: 1 }, { unique: true });
agentSchema.index({ phoneNumber: 1 });
agentSchema.index({ company: 1 });
agentSchema.index({ isActive: 1 });
agentSchema.index({ propertiesCount: -1 });

// Method to increment properties count
agentSchema.methods.incrementPropertiesCount = function() {
  this.propertiesCount += 1;
  return this.save();
};

// Method to decrement properties count
agentSchema.methods.decrementPropertiesCount = function() {
  if (this.propertiesCount > 0) {
    this.propertiesCount -= 1;
  }
  return this.save();
};

// Virtual for getting agent's properties
agentSchema.virtual('properties', {
  ref: 'Property',
  localField: '_id',
  foreignField: 'agentDetails.agentId'
});

// Ensure virtual fields are serialized
agentSchema.set('toJSON', { virtuals: true });
agentSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Agent', agentSchema);