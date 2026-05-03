// models/PropertyBatch.js - UPDATED VERSION WITH DISPLAY ORDERS
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
            viewCount: {
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
        // Display order for property within the batch
        displayOrder: {
          type: Number,
          default: 0
        },
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
    
    // Display orders based on batch type
    displayOrders: {
      location_based_order: {
        type: Number,
        default: 0,
        description: "Display order for location-based batches"
      },
      project_group_order: {
        type: Number,
        default: 0,
        description: "Display order for project group batches"
      },
      featured_listings_order: {
        type: Number,
        default: 0,
        description: "Display order for featured listings batches"
      },
      similar_properties_order: {
        type: Number,
        default: 0,
        description: "Display order for similar properties batches"
      },
      comparison_group_order: {
        type: Number,
        default: 0,
        description: "Display order for comparison group batches"
      }
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

// Virtual for getting current display order based on batch type
propertyBatchSchema.virtual('currentDisplayOrder').get(function() {
  switch(this.batchType) {
    case 'location_based':
      return this.displayOrders.location_based_order;
    case 'project_group':
      return this.displayOrders.project_group_order;
    case 'featured_listings':
      return this.displayOrders.featured_listings_order;
    case 'similar_properties':
      return this.displayOrders.similar_properties_order;
    case 'comparison_group':
      return this.displayOrders.comparison_group_order;
    default:
      return 0;
  }
});

// Virtual for location summary
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
  
  // Set default display orders if not set
  if (!this.displayOrders) {
    this.displayOrders = {
      location_based_order: 0,
      project_group_order: 0,
      featured_listings_order: 0,
      similar_properties_order: 0,
      comparison_group_order: 0
    };
  }
  
  next();
});

// Method to add a property to batch with display order
propertyBatchSchema.methods.addPropertyToBatch = function(propertyId, displayOrder = null) {
  const existingProperty = this.propertyUnits.find(
    p => p.propertyId && p.propertyId.toString() === propertyId.toString()
  );
  
  if (!existingProperty) {
    // If displayOrder not provided, set it to the next available order
    if (displayOrder === null) {
      const maxOrder = Math.max(...this.propertyUnits.map(p => p.displayOrder || 0), -1);
      displayOrder = maxOrder + 1;
    }
    
    this.propertyUnits.push({
      propertyId: propertyId,
      displayOrder: displayOrder,
      userViews: [],
      propertyStats: {
        totalViews: 0,
        uniqueViewers: 0,
        totalViewDuration: 0,
        avgViewDuration: 0
      }
    });
    
    // Sort property units by display order
    this.propertyUnits.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    
    this.stats.totalProperties = this.propertyUnits.length;
    return true;
  }
  return false;
};

// Method to update property display order within batch
propertyBatchSchema.methods.updatePropertyDisplayOrder = function(propertyId, newDisplayOrder) {
  const propertyIndex = this.propertyUnits.findIndex(
    p => p.propertyId && p.propertyId.toString() === propertyId.toString()
  );
  
  if (propertyIndex === -1) {
    throw new Error("Property not found in batch");
  }
  
  this.propertyUnits[propertyIndex].displayOrder = newDisplayOrder;
  
  // Re-sort property units
  this.propertyUnits.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  
  return true;
};

// Method to reorder all properties in batch
propertyBatchSchema.methods.reorderProperties = function(orderArray) {
  // orderArray should be array of {propertyId, displayOrder}
  orderArray.forEach(order => {
    const property = this.propertyUnits.find(
      p => p.propertyId && p.propertyId.toString() === order.propertyId.toString()
    );
    if (property) {
      property.displayOrder = order.displayOrder;
    }
  });
  
  // Sort property units by display order
  this.propertyUnits.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  
  return true;
};

// Method to set batch display order based on batch type
propertyBatchSchema.methods.setDisplayOrder = function(order) {
  switch(this.batchType) {
    case 'location_based':
      this.displayOrders.location_based_order = order;
      break;
    case 'project_group':
      this.displayOrders.project_group_order = order;
      break;
    case 'featured_listings':
      this.displayOrders.featured_listings_order = order;
      break;
    case 'similar_properties':
      this.displayOrders.similar_properties_order = order;
      break;
    case 'comparison_group':
      this.displayOrders.comparison_group_order = order;
      break;
    default:
      throw new Error(`Unknown batch type: ${this.batchType}`);
  }
  return true;
};

// Method to get display order for current batch type
propertyBatchSchema.methods.getDisplayOrder = function() {
  switch(this.batchType) {
    case 'location_based':
      return this.displayOrders.location_based_order;
    case 'project_group':
      return this.displayOrders.project_group_order;
    case 'featured_listings':
      return this.displayOrders.featured_listings_order;
    case 'similar_properties':
      return this.displayOrders.similar_properties_order;
    case 'comparison_group':
      return this.displayOrders.comparison_group_order;
    default:
      return 0;
  }
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
    // Update existing view
    if (duration > property.userViews[recentViewIndex].viewDuration) {
      property.userViews[recentViewIndex].viewDuration = duration;
    }
    property.userViews[recentViewIndex].viewCount += 1;
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
      viewCount: 1,
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
    displayOrder: p.displayOrder,
    totalViews: p.propertyStats?.totalViews || 0,
    uniqueViewers: p.propertyStats?.uniqueViewers || 0,
    avgViewDuration: p.propertyStats?.avgViewDuration || 0,
    lastViewedAt: p.propertyStats?.lastViewedAt,
    recentViews: (p.userViews || []).slice(-5).reverse()
  }));
  
  // Sort properties by display order
  propertiesData.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  
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
      location: this.locationName,
      batchType: this.batchType,
      displayOrder: this.getDisplayOrder()
    },
    summary: {
      totalProperties: this.stats.totalProperties,
      totalViews: this.stats.totalViews,
      uniqueViewers: this.stats.uniqueViewers,
      lastViewedAt: this.stats.lastViewedAt
    },
    topProperties: propertiesData.slice(0, 5),
    topUsers: topUsers,
    allProperties: propertiesData
  };
};

// Static method to get batches ordered by specific batch type
propertyBatchSchema.statics.getOrderedByType = async function(batchType, limit = null) {
  const orderField = `${batchType}_order`;
  const query = { batchType: batchType, isActive: true };
  
  let findQuery = this.find(query).sort({ [`displayOrders.${orderField}`]: 1 });
  
  if (limit) {
    findQuery = findQuery.limit(limit);
  }
  
  return await findQuery;
};

// Indexes
propertyBatchSchema.index({ locationName: 1 });
propertyBatchSchema.index({ batchCode: 1 }, { unique: true });
propertyBatchSchema.index({ createdBy: 1 });
propertyBatchSchema.index({ tags: 1 });
propertyBatchSchema.index({ isActive: 1 });
propertyBatchSchema.index({ batchType: 1 });
propertyBatchSchema.index({ "stats.totalViews": -1 });
propertyBatchSchema.index({ "displayOrders.location_based_order": 1 });
propertyBatchSchema.index({ "displayOrders.project_group_order": 1 });
propertyBatchSchema.index({ "displayOrders.featured_listings_order": 1 });
propertyBatchSchema.index({ "displayOrders.similar_properties_order": 1 });
propertyBatchSchema.index({ "displayOrders.comparison_group_order": 1 });

module.exports = mongoose.model("PropertyBatch", propertyBatchSchema);