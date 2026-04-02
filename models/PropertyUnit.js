const mongoose = require("mongoose");

const propertyUnitSchema = new mongoose.Schema(
  {
    // Basic Information
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },

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
    mapUrl: { type: String },

    // Location Nearby (Amenities and landmarks near the property)
    locationNearby: [
      {
        name: { type: String, required: true }, // e.g., "Metro Station", "School", "Hospital"
        distance: { type: String, required: true }, // e.g., "500m", "1.2km"
        type: {
          type: String,
          enum: ["transport", "education", "healthcare", "shopping", "entertainment", "banking", "religious", "park", "restaurant", "other"],
          default: "other"
        },
        icon: { type: String }, // Optional icon identifier
        coordinates: {
          latitude: Number,
          longitude: Number
        }
      }
    ],

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
        "Plot",
        "Commercial Space"
      ],
      required: true,
    },

    // 🏠 Multiple Unit Types (For projects with different configurations)
    unitTypes: [
      {
        type: {
          type: String,
          required: true,
          enum: ["1BHK", "2BHK", "3BHK", "4BHK", "5BHK", "Studio", "Penthouse", "Duplex", "Plot"]
        },
        price: {
          amount: { type: Number, required: true },
          currency: { type: String, default: "INR" },
          perUnit: {
            type: String,
            enum: ["total", "sqft", "sqm", "month", "perSqYard", "perGround"],
            default: "total"
          }
        },
        carpetArea: { type: Number,  }, // in sqft
        builtUpArea: { type: Number, }, // in sqft
        superBuiltUpArea: { type: Number },
        
        // Plot-specific fields
        plotDetails: {
          dimensions: {
            length: { type: Number }, // in feet
            breadth: { type: Number }, // in feet
            frontage: { type: Number }, // in feet
          },
          area: {
            sqft: { type: Number },
            sqYards: { type: Number },
            grounds: { type: Number },
            acres: { type: Number },
            cents: { type: Number }
          },
          shape: {
            type: String,
            enum: ["square", "rectangle", "corner", "irregular", "triangular"],
            default: "rectangle"
          },
          facing: {
            type: String,
            enum: ["north", "south", "east", "west", "north-east", "north-west", "south-east", "south-west"],
          },
          isCornerPlot: { type: Boolean, default: false },
          cornerRoads: [String], // e.g., ["Main Road", "Cross Road"]
          roadWidth: { type: Number }, // in feet
          roadType: {
            type: String,
            enum: ["main", "secondary", "internal", "service", "highway"],
            default: "secondary"
          },
          boundaryWalls: { type: Boolean, default: false },
          fencing: { type: Boolean, default: false },
          gate: { type: Boolean, default: false },
          elevationAvailable: { type: Boolean, default: false },
          soilType: {
            type: String,
            enum: ["black", "red", "clay", "loamy", "sandy", "rocky", "other"],
          },
          landUse: {
            type: String,
            enum: ["residential", "commercial", "agricultural", "industrial", "mixed-use", "institutional"],
            default: "residential"
          },
          developmentStatus: {
            type: String,
            enum: ["developed", "semi-developed", "undeveloped"],
            default: "developed"
          },
          amenities: [String], // e.g., ["Electricity", "Water Connection", "Sewage", "Road Access"]
          utilities: {
            electricity: { type: Boolean, default: false },
            waterConnection: { type: Boolean, default: false },
            sewageConnection: { type: Boolean, default: false },
            gasConnection: { type: Boolean, default: false },
            internetFiber: { type: Boolean, default: false }
          },
          approvalDetails: {
            dtcpApproved: { type: Boolean, default: false },
            dtcpNumber: { type: String },
            layoutApproved: { type: Boolean, default: false },
            layoutNumber: { type: String },
            surveyNumber: { type: String },
            pattaNumber: { type: String },
            subdivisionApproved: { type: Boolean, default: false }
          }
        },
        
        floors: { type: Number, default: 1 },
        floorNumber: { type: Number },
        availability: {
          type: String,
          enum: ["available", "sold", "limited", "coming-soon", "booked", "reserved"],
          default: "available"
        },
        totalUnits: { type: Number },
        availableUnits: { type: Number }
      }
    ],

    // 🏢 Building/Project Details (if applicable)
    buildingDetails: {
      name: { type: String, trim: true },
      totalFloors: { type: Number },
      totalUnits: { type: Number },
      yearBuilt: { type: Number },
      amenities: [String],
    },

    // 🏠 Unit Features
    unitFeatures: [
      {
        type: String,
        enum: [
          "Air Conditioning",
          "Modular Kitchen",
          "Wardrobes",
          "Geyser",
          "Exhaust Fan",
          "Chimney",
          "Lighting",
          "Ceiling Fans",
          "Smart Home Automation",
          "Central AC",
          "bore water",
          "Walk-in Closet",
          "Study Room",
          "Pooja Room",
          "Utility Area",
          "Servant Room",
          "Private Garden",
          "Terrace",
          "Balcony",
          "Swimming Pool",
          "Video Door Phone",
          "Security Alarm",
          "Fire Safety",
          "CCTV",
          "Pet Friendly",
          "Wheelchair Access",
          "Natural Light",
          "View"
        ],
      },
    ],

    // Common Specifications
    commonSpecifications: {
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
      ageOfProperty: { type: Number },
      parking: {
        covered: { type: Number, default: 0 },
        open: { type: Number, default: 0 }
      },
      kitchenType: {
        type: String,
        enum: ["modular", "regular", "open", "closed", "none"],
        default: "regular"
      }
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
      enum: ["sale", "rent", "lease", "pg"],
      default: "sale"
    },
    
    likes: {
      type: Number,
      default: 0
    },

    // Rejection Reason
    rejectionReason: { type: String, default: "" },

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
      reraRegistered: { type: Boolean, default: false },
      reraNumber: { type: String, trim: true },
      reraWebsiteLink: { type: String, trim: true },
      sanctioningAuthority: { type: String, trim: true },
      sanctionNumber: { type: String, trim: true },
      sanctionDate: { type: Date },
      occupancyCertificate: { type: Boolean, default: false },
      occupancyCertificateNumber: { type: String, trim: true },
      occupancyCertificateDate: { type: Date },
      commencementCertificate: { type: Boolean, default: false },
      commencementCertificateNumber: { type: String, trim: true },
      commencementCertificateDate: { type: Date },
      khataStatus: {
        type: String,
        enum: ["A-Khata", "B-Khata", "E-Khata", "Not Applicable"],
        default: "Not Applicable"
      },
      clearTitle: { type: Boolean, default: false },
      motherDeedAvailable: { type: Boolean, default: false },
      conversionCertificate: { type: Boolean, default: false },
      conversionType: { type: String, trim: true },
      encumbranceCertificate: { type: Boolean, default: false },
      encumbranceYears: { type: Number },
      ownershipType: {
        type: String,
        enum: ["freehold", "leasehold", "cooperative", "power-of-attorney"],
        default: "freehold"
      },
      bankApprovals: [
        {
          bankName: { type: String, required: true },
          approved: { type: Boolean, default: true },
          approvalDate: { type: Date },
          referenceNumber: { type: String }
        }
      ],
      legalStatusSummary: { type: String, trim: true },
      legalVerified: { type: Boolean, default: false },
      legalVerificationDate: { type: Date },
      legalVerifier: { type: String, trim: true }
    },
    slug: {
      type: String,
      unique: true,
      sparse: true, // Allow multiple null values if needed
      trim: true,
      lowercase: true
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

    // Display
    displayOrder: { type: Number, default: 0 },
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

propertyUnitSchema.pre('save', async function(next) {
  if (!this.slug) {
    // Generate slug from title
    let slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    
    // Add random suffix to ensure uniqueness
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    slug = `${slug}-${randomSuffix}`;
    
    // Check if slug already exists
    let existingSlug = await this.constructor.findOne({ slug });
    let counter = 1;
    
    while (existingSlug) {
      slug = `${slug}-${counter}`;
      existingSlug = await this.constructor.findOne({ slug });
      counter++;
    }
    
    this.slug = slug;
  }
  next();
});

// Virtual to get price range across all unit types
propertyUnitSchema.virtual('priceRange').get(function() {
  if (!this.unitTypes || this.unitTypes.length === 0) return null;
  
  const prices = this.unitTypes.map(unit => unit.price.amount);
  return {
    min: Math.min(...prices),
    max: Math.max(...prices)
  };
});

// Virtual to get all available unit types
propertyUnitSchema.virtual('availableUnitTypes').get(function() {
  if (!this.unitTypes) return [];
  return this.unitTypes.filter(unit => 
    unit.availability === 'available' && 
    (unit.availableUnits === undefined || unit.availableUnits > 0)
  );
});

// Virtual to get plot area in different units
propertyUnitSchema.virtual('plotArea').get(function() {
  if (this.propertyType !== 'Plot' || !this.unitTypes) return null;
  
  const plotUnits = this.unitTypes.filter(unit => unit.type === 'Plot');
  if (plotUnits.length === 0) return null;
  
  return plotUnits.map(unit => ({
    sqft: unit.plotDetails?.area?.sqft || unit.carpetArea,
    sqYards: unit.plotDetails?.area?.sqYards,
    grounds: unit.plotDetails?.area?.grounds,
    acres: unit.plotDetails?.area?.acres,
    cents: unit.plotDetails?.area?.cents
  }));
});

// Indexes for better performance
propertyUnitSchema.index({ city: 1 });
propertyUnitSchema.index({ availability: 1, isFeatured: 1 });
propertyUnitSchema.index({ approvalStatus: 1 });
propertyUnitSchema.index({ isVerified: 1 });
propertyUnitSchema.index({ listingType: 1 });
propertyUnitSchema.index({ createdBy: 1 });
propertyUnitSchema.index({ "legalDetails.reraRegistered": 1 });
propertyUnitSchema.index({ "unitTypes.type": 1 });
propertyUnitSchema.index({ "locationNearby.type": 1 });
propertyUnitSchema.index({ propertyType: 1 }); // Added index for property type
propertyUnitSchema.index({ "unitTypes.plotDetails.landUse": 1 }); // Index for plot land use
propertyUnitSchema.index({ "unitTypes.plotDetails.developmentStatus": 1 }); // Index for plot development status

module.exports = mongoose.model("PropertyUnit", propertyUnitSchema);