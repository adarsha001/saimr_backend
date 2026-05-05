const mongoose = require('mongoose');

const agentSchema = new mongoose.Schema({
  agentId: {
    type: String,
    unique: true,
  },

  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },

  referralCode: {
    type: String,
    unique: true,
    sparse: true
  },

  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent',
    default: null
  },

  referralCount: {
    type: Number,
    default: 0
  },

  rewards: {
    type: Number,
    default: 0
  },

  // Track referral history
  referralHistory: [{
    referredAgent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Agent'
    },
    referredUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    referredAt: {
      type: Date, 
      default: Date.now
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'converted'],
      default: 'active'
    },
    rewardAmount: {
      type: Number,
      default: 100
    }
  }],

  // ================= CLIENT ONBOARDING =================
  // This is the SINGLE source of truth for all appointments
  onboardedClients: [
    {
      client: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },

      property: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PropertyUnit',
        required: true
      },

      appointmentDate: {
        type: Date,
        required: true
      },

      appointmentTime: {
        type: String,
        required: true
      },

      visitedAt: {
        type: Date,
        default: Date.now
      },

      status: {
        type: String,
        enum: ['scheduled', 'visited', 'interested', 'negotiation', 'closed', 'rejected', 'cancelled'],
        default: 'scheduled'
      },

      dealValue: {
        type: Number
      },

      rewardEarned: {
        type: Number,
        default: 0
      },

      notes: {
        type: String,
        trim: true
      },

      followUpDate: {
        type: Date
      },

      feedback: {
        rating: {
          type: Number,
          min: 1,
          max: 5
        },
        comment: String
      },

      createdAt: {
        type: Date,
        default: Date.now
      }
    }
  ],

  // ================= EXISTING FIELDS =================
  licenseNumber: { type: String, trim: true },

  experienceYears: {
    type: Number,
    min: 0,
    default: 0
  },

  specializationAreas: [{ type: String, trim: true }],

  certifications: [
    {
      name: String,
      issuingAuthority: String,
      year: Number
    }
  ],

  bio: {
    type: String,
    trim: true,
    maxlength: [2000, 'Bio cannot exceed 2000 characters']
  },

  profilePhoto: {
    type: String,
    default: ''
  },

  ratings: {
    average: { type: Number, default: 0, min: 0, max: 5 },
    totalReviews: { type: Number, default: 0 }
  },

  socialLinks: {
    facebook: String,
    twitter: String,
    linkedin: String,
    instagram: String,
    website: String
  },

  propertiesCount: {
    type: Number,
    default: 0
  },

  clientsCount: {
    type: Number,
    default: 0
  },

  isActive: {
    type: Boolean,
    default: true
  },

  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  approvedAt: {
    type: Date,
    default: Date.now
  },

  // Cached user info
  name: { type: String, required: true },
  email: { type: String, required: true, lowercase: true },
  phoneNumber: { type: String, required: true },

  company: { type: String, trim: true },

  officeAddress: {
    street: String,
    city: String,
    state: String,
    pincode: String,
    country: { type: String, default: 'India' }
  },

  // Statistics
  stats: {
    totalAppointments: { type: Number, default: 0 },
    completedVisits: { type: Number, default: 0 },
    totalDealValue: { type: Number, default: 0 },
    conversionRate: { type: Number, default: 0 }
  }

}, { timestamps: true });

// Helper function to generate agent ID
async function generateAgentId() {
  const Agent = mongoose.model('Agent');
  const lastAgent = await Agent.findOne({}, { agentId: 1 })
    .sort({ createdAt: -1 })
    .lean();
  
  let nextNumber = 100001;
  
  if (lastAgent && lastAgent.agentId) {
    const match = lastAgent.agentId.match(/cleartitle(\d+)/);
    if (match && match[1]) {
      nextNumber = parseInt(match[1]) + 1;
    }
  }
  
  return `cleartitle${nextNumber}`;
}

// Helper function to generate referral code
function generateReferralCode() {
  const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
  const timestamp = Date.now().toString().slice(-6);
  return `AG${randomStr}${timestamp}`;
}

// Pre-save middleware to generate agentId and referralCode
agentSchema.pre('save', async function(next) {
  try {
    if (!this.agentId) {
      this.agentId = await generateAgentId();
      console.log('Generated agentId:', this.agentId);
    }

    if (!this.referralCode) {
      this.referralCode = generateReferralCode();
      console.log('Generated referralCode:', this.referralCode);
    }

    next();
  } catch (err) {
    console.error('Error in agent pre-save hook:', err);
    next(err);
  }
});

// Indexes
agentSchema.index({ agentId: 1 }, { unique: true });
agentSchema.index({ user: 1 }, { unique: true });
agentSchema.index({ referralCode: 1 }, { unique: true, sparse: true });
agentSchema.index({ 'officeAddress.city': 1 });
agentSchema.index({ 'onboardedClients.status': 1 });
agentSchema.index({ 'onboardedClients.appointmentDate': 1 });

// Methods

// Increment referral
agentSchema.methods.addReferral = async function(referredUserId, referredAgentId = null) {
  this.referralCount += 1;
  this.rewards += 100;
  
  this.referralHistory.push({
    referredUser: referredUserId,
    referredAgent: referredAgentId,
    rewardAmount: 100,
    status: 'active'
  });
  
  await this.save();
  return this;
};

module.exports = mongoose.model('Agent', agentSchema);