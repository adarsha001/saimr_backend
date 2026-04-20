// models/PropertyBatch.js - UPDATED VERSION
const mongoose = require("mongoose");

const propertyBatchSchema = new mongoose.Schema(
  {
    batchName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    
    locationName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    
    description: {
      type: String,
      trim: true,
      maxlength: 1000
    },
    
    image: {
      url: { type: String, required: true },
      public_id: { type: String },
      caption: { type: String, default: "" }
    },
    
    // IMPORTANT: This needs to be an array of objects with userViews, not just ObjectIds
    propertyUnits: [
      {
        propertyId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "PropertyUnit",
          required: true
        },
        // User views for this specific property in this batch
// In propertyUnits.userViews array, add viewCount field
userViews: [
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    userName: { type: String },
    userEmail: { type: String },
    userType: { type: String },
    userPhone: { type: String },
    viewedAt: {
      type: Date,
      default: Date.now
    },
    viewDuration: {
      type: Number,
      default: 0
    },
    viewCount: {  // NEW: Track number of times user viewed in this session
      type: Number,
      default: 1
    },
    sessionId: { type: String },
    source: {
      type: String,
      enum: ["direct", "search", "featured", "batch_view", "recommendation", "other"],
      default: "direct"
    }
  }
],
        // Statistics for this property within the batch
        propertyStats: {
          totalViews: { type: Number, default: 0 },
          uniqueViewers: { type: Number, default: 0 },
          totalViewDuration: { type: Number, default: 0 },
          avgViewDuration: { type: Number, default: 0 },
          lastViewedAt: { type: Date }
        }
      }
    ],
    
    batchCode: {
      type: String,
      unique: true,
      uppercase: true,
      trim: true
    },
    
    batchType: {
      type: String,
      enum: ["location_based", "project_group", "featured_listings", "similar_properties", "comparison_group"],
      default: "location_based"
    },
    
    locationCoordinates: {
      latitude: Number,
      longitude: Number
    },
    
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    
    isActive: {
      type: Boolean,
      default: true
    },
    
    displayOrder: {
      type: Number,
      default: 0
    },
    
    // Overall batch statistics
    stats: {
      totalProperties: { type: Number, default: 0 },
      totalViews: { type: Number, default: 0 },
      uniqueViewers: { type: Number, default: 0 },
      avgPrice: { type: Number, default: 0 },
      minPrice: { type: Number, default: 0 },
      maxPrice: { type: Number, default: 0 },
      propertyTypes: [String],
      lastViewedAt: { type: Date }
    },
    
    tags: [String]
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtuals
propertyBatchSchema.virtual('locationSummary').get(function() {
  return `${this.locationName} (${this.stats.totalProperties} properties)`;
});

propertyBatchSchema.virtual('thumbnail').get(function() {
  return this.image?.url || null;
});

// Pre-save middleware
propertyBatchSchema.pre('save', function(next) {
  if (!this.batchCode) {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substr(2, 4).toUpperCase();
    const locationPrefix = this.locationName.substr(0, 3).toUpperCase().replace(/\s/g, '');
    this.batchCode = `BATCH-${locationPrefix}-${randomStr}-${timestamp}`;
  }
  
  if (this.isModified()) {
    this.updatedAt = Date.now();
  }
  
  if (!Array.isArray(this.propertyUnits)) {
    this.propertyUnits = [];
  }
  
  // Update total properties count
  this.stats.totalProperties = this.propertyUnits.length;
  
  next();
});

// Method to add a property to batch
propertyBatchSchema.methods.addPropertyToBatch = function(propertyId) {
  const existingProperty = this.propertyUnits.find(
    p => p.propertyId && p.propertyId.toString() === propertyId.toString()
  );
  
  if (!existingProperty) {
    this.propertyUnits.push({
      propertyId: propertyId,
      userViews: [],
      propertyStats: {
        totalViews: 0,
        uniqueViewers: 0,
        totalViewDuration: 0,
        avgViewDuration: 0
      }
    });
    this.stats.totalProperties = this.propertyUnits.length;
    return true;
  }
  return false;
};

// Method to record a user view for a specific property in the batch
propertyBatchSchema.methods.recordUserView = async function(propertyId, userId, userData, options = {}) {
  const { duration = 0, sessionId = null, source = "direct" } = options;
  
  // Find the property in the batch
  let propertyIndex = this.propertyUnits.findIndex(
    p => p.propertyId && p.propertyId.toString() === propertyId.toString()
  );
  
  // If property not found, add it first
  if (propertyIndex === -1) {
    this.addPropertyToBatch(propertyId);
    propertyIndex = this.propertyUnits.findIndex(
      p => p.propertyId && p.propertyId.toString() === propertyId.toString()
    );
  }
  
  if (propertyIndex === -1) {
    throw new Error("Failed to add property to batch");
  }
  
  const property = this.propertyUnits[propertyIndex];
  
  // Check if user already viewed in last 30 minutes
  const recentViewIndex = property.userViews.findIndex(
    view => view.userId.toString() === userId.toString() &&
    new Date(view.viewedAt) > new Date(Date.now() - 30 * 60 * 1000)
  );
  
  if (recentViewIndex !== -1) {
    // Update existing view duration if longer
    if (duration > property.userViews[recentViewIndex].viewDuration) {
      property.userViews[recentViewIndex].viewDuration = duration;
    }
  } else {
    // Add new user view record
    property.userViews.push({
      userId: userId,
      userName: userData.name || "Unknown",
      userEmail: userData.email || "",
      userType: userData.userType || "unknown",
      userPhone: userData.phoneNumber || "",
      viewedAt: new Date(),
      viewDuration: duration,
      sessionId: sessionId,
      source: source
    });
  }
  
  // Update property stats
  const uniqueViewers = new Set(property.userViews.map(v => v.userId.toString()));
  const totalDuration = property.userViews.reduce((sum, v) => sum + v.viewDuration, 0);
  
  property.propertyStats = {
    totalViews: property.userViews.length,
    uniqueViewers: uniqueViewers.size,
    totalViewDuration: totalDuration,
    avgViewDuration: property.userViews.length > 0 ? Math.round(totalDuration / property.userViews.length) : 0,
    lastViewedAt: new Date()
  };
  
  // Update overall batch stats
  const allViews = this.propertyUnits.flatMap(p => p.userViews || []);
  const allUniqueViewers = new Set(allViews.map(v => v.userId.toString()));
  
  this.stats.totalViews = allViews.length;
  this.stats.uniqueViewers = allUniqueViewers.size;
  this.stats.lastViewedAt = new Date();
  
  await this.save();
  
  return {
    propertyStats: property.propertyStats,
    batchStats: {
      totalViews: this.stats.totalViews,
      uniqueViewers: this.stats.uniqueViewers
    }
  };
};

// Method to get batch analytics
propertyBatchSchema.methods.getAnalytics = function() {
  const propertiesData = this.propertyUnits.map(p => ({
    propertyId: p.propertyId,
    totalViews: p.propertyStats?.totalViews || 0,
    uniqueViewers: p.propertyStats?.uniqueViewers || 0,
    avgViewDuration: p.propertyStats?.avgViewDuration || 0,
    lastViewedAt: p.propertyStats?.lastViewedAt,
    recentViews: (p.userViews || []).slice(-5).reverse()
  }));
  
  // Get top users
  const userMap = new Map();
  this.propertyUnits.forEach(p => {
    (p.userViews || []).forEach(v => {
      if (!userMap.has(v.userId.toString())) {
        userMap.set(v.userId.toString(), {
          userId: v.userId,
          name: v.userName,
          type: v.userType,
          views: 0,
          duration: 0
        });
      }
      const user = userMap.get(v.userId.toString());
      user.views++;
      user.duration += v.viewDuration;
    });
  });
  
  const topUsers = Array.from(userMap.values())
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);
  
  return {
    batchInfo: {
      id: this._id,
      name: this.batchName,
      code: this.batchCode,
      location: this.locationName
    },
    summary: {
      totalProperties: this.stats.totalProperties,
      totalViews: this.stats.totalViews,
      uniqueViewers: this.stats.uniqueViewers,
      lastViewedAt: this.stats.lastViewedAt
    },
    topProperties: propertiesData.sort((a, b) => b.totalViews - a.totalViews).slice(0, 5),
    topUsers: topUsers,
    allProperties: propertiesData
  };
};

// Indexes
propertyBatchSchema.index({ locationName: 1 });
propertyBatchSchema.index({ batchCode: 1 }, { unique: true });
propertyBatchSchema.index({ createdBy: 1 });
propertyBatchSchema.index({ tags: 1 });
propertyBatchSchema.index({ isActive: 1 });
propertyBatchSchema.index({ batchType: 1 });
propertyBatchSchema.index({ "stats.totalViews": -1 });

module.exports = mongoose.model("PropertyBatch", propertyBatchSchema);