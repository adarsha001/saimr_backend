const mongoose = require("mongoose");

const propertyUnitSchema = new mongoose.Schema(
  {
    // Parent Property Reference (for grouping units in same project/building)
    parentProperty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: false, // Optional if standalone unit
    },

    // Basic Information
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    unitNumber: { type: String, trim: true }, // e.g., "Unit 101", "Villa A1"

    // Images
    images: [
      {
        url: { type: String, required: true },
        public_id: { type: String },
        caption: { type: String, default: "" }
      },
    ],

    // Location
    city: { type: String, required: true },
    address: { type: String, required: true },
    coordinates: { latitude: Number, longitude: Number },
 mapUrl: { type: String }, 
    // Price
    price: {
      amount: { type:String, required: true },
      currency: { type: String, default: "INR" },
      perUnit: { 
        type: String, 
        enum: ["total", "sqft", "sqm", "month"], 
        default: "total" 
      }
    },
    maintenanceCharges: { type: Number, default: 0 },
    securityDeposit: { type: Number, default: 0 },

    // Unit Category
    propertyType: {
      type: String,
      enum: [
        "Apartment",
        "Villa",
        "Independent House",
        "Studio",
        "Penthouse",
        "Duplex",
        "Pg house",
        "Plot", // For smaller plots
        "Commercial Space"
      ],
      required: true,
    },

    // 🏠 Unit Specifications
    specifications: {
      // Bedrooms & Bathrooms
      bedrooms: { 
        type: Number, 
        required: true,
    
      },
      bathrooms: { 
        type: Number, 
        required: true,
     
      },
      balconies: { type: Number, default: 0 },
      floors: { type: Number, default: 1 }, // Number of floors in this unit
      floorNumber: { type: Number }, // Floor number in building
      
      // Area Measurements
      carpetArea: { type: Number, required: true }, // in sqft
      builtUpArea: { type: Number, required: true }, // in sqft
      superBuiltUpArea: { type: Number }, // in sqft
      plotArea: { type: Number }, // For villas/independent houses
      
      // Unit Status
      furnishing: {
        type: String,
        enum: ["unfurnished", "semi-furnished", "fully-furnished"],
        default: "unfurnished"
      },
      possessionStatus: {
        type: String,
        enum: ["ready-to-move", "under-construction", "resale"],
        default: "ready-to-move"
      },
      ageOfProperty: { type: Number }, // in years
      
      // Parking
      parking: {
        covered: { type: Number, default: 0 },
        open: { type: Number, default: 0 }
      },
      
      // Kitchen
      kitchenType: {
        type: String,
        enum: ["modular", "regular", "open", "closed", "none"],
        default: "regular"
      }
    },

    // 🏢 Building/Project Details (if applicable)
    buildingDetails: {
      name: { type: String, trim: true },
      totalFloors: { type: Number },
      totalUnits: { type: Number },
      yearBuilt: { type: Number },
      amenities: [String], // Shared amenities
    },

    // 🏠 Unit Features
    unitFeatures: [
      {
        type: String,
        enum: [
          // Basic
          "Air Conditioning",
          "Modular Kitchen",
          "Wardrobes",
          "Geyser",
          "Exhaust Fan",
          "Chimney",
          "Lighting",
          "Ceiling Fans",
          
          // Luxury
          "Smart Home Automation",
          "Central AC",
          "bore water",
          "Walk-in Closet",
          "Study Room",
          "Pooja Room",
          "Utility Area",
          "Servant Room",
          
          // Outdoor
          "Private Garden",
          "Terrace",
          "Balcony",
          "Swimming Pool",
          "bore water",
          
          // Safety & Security
          "Video Door Phone",
          "Security Alarm",
          "Fire Safety",
          "CCTV",
          
          // Additional
          "Pet Friendly",
          "Wheelchair Access",
          "Natural Light",
          "View"
        ],
      },
    ],

    // Rental Details (if for rent)
    rentalDetails: {
      availableForRent: { type: Boolean, default: false },
      leaseDuration: { // Minimum lease period
        value: { type: Number, default: 11 }, // months
        unit: { type: String, enum: ["months", "years"], default: "months" }
      },
      rentNegotiable: { type: Boolean, default: true },
      preferredTenants: {
        type: [String],
        enum: ["family", "bachelors", "corporate", "students", "any"]
      },
      includedInRent: [String] // e.g., ["maintenance", "electricity", "water"]
    },

    // Availability & Status
    availability: {
      type: String,
      enum: ["available", "sold", "rented", "under-agreement", "hold"],
      default: "available"
    },
    
    // Featured & Verification Status
    isFeatured: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },
    
    // Approval Workflow
    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending"
    },
    
    // Listing Type
    listingType: {
      type: String,
      enum: ["sale", "rent", "lease", "pg"], // PG = Paying Guest
      default: "sale"
    },
      likes: {
    type: Number,
    default: 0
  },
    // 🌐 WEBSITE ASSIGNMENT
    websiteAssignment: {
      type: [String],
      default: ["cleartitle"], // Default to cleartitle only
      required: true,
    },
    
    // Rejection Reason (for admin use)
    rejectionReason: { type: String, default: "" },
    
    // Virtual Tour
    virtualTour: {
      type: String // URL for 360° tour or video
    },
    
    // Floor Plan
    floorPlan: {
      image: String,
      public_id: String, // Added for Cloudinary deletion
      description: String
    },

    // 👤 Creator Information
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    
    // 👤 Owner Information
    ownerDetails: {
      name: String,
      phoneNumber: String,
      email: String,
      reasonForSelling: String
    },

    // ⚖️ Legal & Documentation
    legalDetails: {
      ownershipType: {
        type: String,
        enum: ["freehold", "leasehold", "cooperative", "power-of-attorney"]
      },
      reraRegistered: Boolean,
      reraNumber: String,
      khataCertificate: Boolean,
      encumbranceCertificate: Boolean,
      occupancyCertificate: Boolean
    },

    // 📅 Viewing & Contact
    viewingSchedule: [
      {
        date: Date,
        startTime: String,
        endTime: String,
        slotsAvailable: Number
      }
    ],
    contactPreference: {
      type: [String],
      enum: ["call", "whatsapp", "email", "message"],
      default: ["call", "whatsapp"]
    },

    // 📊 Statistics
    viewCount: { type: Number, default: 0 },
    inquiryCount: { type: Number, default: 0 },
    favoriteCount: { type: Number, default: 0 },

    // 🔍 SEO & Display
    metaTitle: String,
    metaDescription: String,
    slug: { type: String, unique: true, lowercase: true },
    displayOrder: { type: Number, default: 0 },
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for price per sqft
propertyUnitSchema.virtual('pricePerSqft').get(function() {
  if (this.price.perUnit === 'total' && this.specifications.carpetArea > 0) {
    return this.price.amount / this.specifications.carpetArea;
  }
  return null;
});

// Virtual for full address
propertyUnitSchema.virtual('fullAddress').get(function() {
  let address = this.address;
  if (this.unitNumber) {
    address = `${this.unitNumber}, ${address}`;
  }
  if (this.buildingDetails && this.buildingDetails.name) {
    address = `${this.buildingDetails.name}, ${address}`;
  }
  return `${address}, ${this.city}`;
});

// Indexes for better performance
propertyUnitSchema.index({ city: 1, price: 1 });
propertyUnitSchema.index({ "specifications.bedrooms": 1, "specifications.bathrooms": 1 });
propertyUnitSchema.index({ coordinates: "2dsphere" });
propertyUnitSchema.index({ availability: 1, isFeatured: 1 });
propertyUnitSchema.index({ websiteAssignment: 1 });
propertyUnitSchema.index({ approvalStatus: 1 });
propertyUnitSchema.index({ isVerified: 1 });
propertyUnitSchema.index({ listingType: 1 });
propertyUnitSchema.index({ slug: 1 }, { unique: true });
propertyUnitSchema.index({ createdBy: 1 });

// Pre-save middleware to generate slug
propertyUnitSchema.pre('save', function(next) {
  if (this.isModified('title') || !this.slug) {
    const slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    
    // Add unique identifier
    this.slug = `${slug}-${Date.now().toString(36)}`;
  }
  
  // Ensure websiteAssignment is always an array with unique values
  if (this.websiteAssignment && this.websiteAssignment.length > 0) {
    this.websiteAssignment = [...new Set(this.websiteAssignment)];
  }
  
  next();
});

// Method to get status badge color
propertyUnitSchema.methods.getStatusBadge = function() {
  const statusMap = {
    'pending': 'warning',
    'approved': 'success',
    'rejected': 'danger',
    'available': 'success',
    'sold': 'secondary',
    'rented': 'info',
    'under-agreement': 'warning',
    'hold': 'warning'
  };
  
  return {
    approval: statusMap[this.approvalStatus] || 'secondary',
    availability: statusMap[this.availability] || 'secondary'
  };
};

module.exports = mongoose.model("PropertyUnit", propertyUnitSchema);