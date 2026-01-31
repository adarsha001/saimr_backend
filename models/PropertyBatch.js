const mongoose = require("mongoose");

const propertyBatchSchema = new mongoose.Schema(
  {
    // Batch Basic Information
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
    
    // Single featured image for the batch
    image: {
      url: {
        type: String,
        required: true
      },
      public_id: {
        type: String
      },
      caption: {
        type: String,
        default: ""
      }
    },
    
    // Reference to PropertyUnits in this batch
    propertyUnits: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "PropertyUnit",
        required: true
      }
    ],
    
    // Batch Identifier
    batchCode: {
      type: String,
      unique: true,
      uppercase: true,
      trim: true
    },
    
    // Batch Metadata
    batchType: {
      type: String,
      enum: [
        "location_based",
        "project_group",
        "featured_listings",
        "similar_properties",
        "comparison_group"
      ],
      default: "location_based"
    },
    
    // Location coordinates (optional)
    locationCoordinates: {
      latitude: Number,
      longitude: Number
    },
    
    // Batch Creator
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    
    // Status
    isActive: {
      type: Boolean,
      default: true
    },
    
    // Ordering/Display
    displayOrder: {
      type: Number,
      default: 0
    },
    
    // Statistics (auto-calculated)
    stats: {
      totalProperties: {
        type: Number,
        default: 0
      },
      avgPrice: {
        type: Number,
        default: 0
      },
      minPrice: {
        type: Number,
        default: 0
      },
      maxPrice: {
        type: Number,
        default: 0
      },
      propertyTypes: [String]
    },
    
    // Tags for filtering
    tags: [String],
    
    // Timestamps
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    // Enable virtuals
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for location info summary
propertyBatchSchema.virtual('locationSummary').get(function() {
  return `${this.locationName} (${this.stats.totalProperties} properties)`;
});

// Virtual for batch thumbnail (uses image URL)
propertyBatchSchema.virtual('thumbnail').get(function() {
  return this.image?.url || null;
});

// Pre-save middleware to generate batch code
propertyBatchSchema.pre('save', function(next) {
  // Generate batch code if not provided
  if (!this.batchCode) {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substr(2, 4).toUpperCase();
    const locationPrefix = this.locationName
      .substr(0, 3)
      .toUpperCase()
      .replace(/\s/g, '');
    
    this.batchCode = `BATCH-${locationPrefix}-${randomStr}-${timestamp}`;
  }
  
  // Update timestamp
  if (this.isModified()) {
    this.updatedAt = Date.now();
  }
  
  next();
});

// Pre-save middleware to validate property units array
propertyBatchSchema.pre('save', function(next) {
  // Ensure propertyUnits is an array
  if (!Array.isArray(this.propertyUnits)) {
    this.propertyUnits = [];
  }
  
  // Remove duplicates
  this.propertyUnits = [...new Set(this.propertyUnits.map(id => id.toString()))];
  
  // Update stats
  this.stats.totalProperties = this.propertyUnits.length;
  
  next();
});

// Method to check if a property unit exists in batch
propertyBatchSchema.methods.hasPropertyUnit = function(propertyUnitId) {
  return this.propertyUnits.some(unitId => 
    unitId.toString() === propertyUnitId.toString()
  );
};

// Method to add a property unit to batch
propertyBatchSchema.methods.addPropertyUnit = function(propertyUnitId) {
  if (!this.hasPropertyUnit(propertyUnitId)) {
    this.propertyUnits.push(propertyUnitId);
    this.stats.totalProperties = this.propertyUnits.length;
    return true;
  }
  return false;
};

// Method to remove a property unit from batch
propertyBatchSchema.methods.removePropertyUnit = function(propertyUnitId) {
  const initialLength = this.propertyUnits.length;
  this.propertyUnits = this.propertyUnits.filter(unitId => 
    unitId.toString() !== propertyUnitId.toString()
  );
  
  if (this.propertyUnits.length < initialLength) {
    this.stats.totalProperties = this.propertyUnits.length;
    return true;
  }
  return false;
};

// Method to get batch overview
propertyBatchSchema.methods.getOverview = function() {
  return {
    batchName: this.batchName,
    location: this.locationName,
    totalProperties: this.stats.totalProperties,
    description: this.description,
    image: this.image.url,
    batchCode: this.batchCode,
    created: this.createdAt
  };
};

// Indexes for better performance
propertyBatchSchema.index({ locationName: 1 });
propertyBatchSchema.index({ batchCode: 1 }, { unique: true });
propertyBatchSchema.index({ createdBy: 1 });
propertyBatchSchema.index({ tags: 1 });
propertyBatchSchema.index({ isActive: 1 });
propertyBatchSchema.index({ batchType: 1 });
propertyBatchSchema.index({ "stats.totalProperties": 1 });
propertyBatchSchema.index({ createdAt: -1 });

module.exports = mongoose.model("PropertyBatch", propertyBatchSchema);