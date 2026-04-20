const mongoose = require("mongoose");

const propertyViewTrackerSchema = new mongoose.Schema(
  {
    // Reference to the property unit being viewed
    propertyUnit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PropertyUnit",
      required: true,
      index: true
    },
    
    // Reference to the batch containing this property
    propertyBatch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PropertyBatch",
      required: true,
      index: true
    },
    
    // User who viewed the property
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    
    // User details at the time of viewing (denormalized for quick access)
    userDetails: {
      name: { type: String },
      email: { type: String },
      phoneNumber: { type: String },
      userType: { type: String },
      company: { type: String },
      preferredLocation: { type: String }
    },
    
    // View metadata
    viewTimestamp: {
      type: Date,
      default: Date.now,
      index: true
    },
    
    // Session information
    sessionId: {
      type: String,
      index: true
    },
    
    // Source/Referrer
    source: {
      type: String,
      enum: ["direct", "search", "featured", "batch_view", "recommendation", "other"],
      default: "direct"
    },
    
    // View duration in seconds
    viewDuration: {
      type: Number,
      default: 0
    },
    
    // Whether this was a unique view for this user-property combination
    isUniqueView: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Compound indexes for efficient queries
propertyViewTrackerSchema.index({ propertyUnit: 1, user: 1, viewTimestamp: -1 });
propertyViewTrackerSchema.index({ propertyBatch: 1, viewTimestamp: -1 });
propertyViewTrackerSchema.index({ user: 1, viewTimestamp: -1 });
propertyViewTrackerSchema.index({ propertyBatch: 1, user: 1 });

// Virtual for formatted view date
propertyViewTrackerSchema.virtual('formattedDate').get(function() {
  return this.viewTimestamp.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
});

// Static method to get batch view statistics
propertyViewTrackerSchema.statics.getBatchViewStats = async function(batchId) {
  const stats = await this.aggregate([
    { $match: { propertyBatch: new mongoose.Types.ObjectId(batchId) } },
    {
      $group: {
        _id: null,
        totalViews: { $sum: 1 },
        uniqueUsers: { $addToSet: "$user" },
        totalDuration: { $sum: "$viewDuration" },
        viewsLast24Hours: {
          $sum: {
            $cond: [
              { $gte: ["$viewTimestamp", new Date(Date.now() - 24 * 60 * 60 * 1000)] },
              1,
              0
            ]
          }
        },
        viewsLast7Days: {
          $sum: {
            $cond: [
              { $gte: ["$viewTimestamp", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)] },
              1,
              0
            ]
          }
        },
        viewsLast30Days: {
          $sum: {
            $cond: [
              { $gte: ["$viewTimestamp", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)] },
              1,
              0
            ]
          }
        }
      }
    },
    {
      $project: {
        totalViews: 1,
        uniqueViewers: { $size: "$uniqueUsers" },
        totalDuration: 1,
        avgDuration: { $divide: ["$totalDuration", { $max: ["$totalViews", 1] }] },
        viewsLast24Hours: 1,
        viewsLast7Days: 1,
        viewsLast30Days: 1
      }
    }
  ]);
  
  return stats[0] || {
    totalViews: 0,
    uniqueViewers: 0,
    totalDuration: 0,
    avgDuration: 0,
    viewsLast24Hours: 0,
    viewsLast7Days: 0,
    viewsLast30Days: 0
  };
};

// Static method to get user's view history for a batch
propertyViewTrackerSchema.statics.getUserBatchViews = async function(userId, batchId, limit = 50) {
  return this.find({
    user: userId,
    propertyBatch: batchId
  })
  .populate('propertyUnit', 'title address city price propertyType images')
  .sort({ viewTimestamp: -1 })
  .limit(limit);
};

// Static method to get user's viewing history across all batches
propertyViewTrackerSchema.statics.getUserViewingHistory = async function(userId, limit = 50, offset = 0) {
  return this.find({ user: userId })
    .populate('propertyUnit', 'title address city price propertyType images')
    .populate('propertyBatch', 'batchName locationName batchType')
    .sort({ viewTimestamp: -1 })
    .skip(offset)
    .limit(limit);
};

// Method to check if this is a duplicate view (within a time window)
propertyViewTrackerSchema.methods.isDuplicateView = async function(timeWindowMinutes = 30) {
  const existingView = await this.constructor.findOne({
    propertyUnit: this.propertyUnit,
    user: this.user,
    viewTimestamp: {
      $gte: new Date(Date.now() - timeWindowMinutes * 60 * 1000)
    }
  });
  return !!existingView;
};

module.exports = mongoose.model("PropertyViewTracker", propertyViewTrackerSchema);