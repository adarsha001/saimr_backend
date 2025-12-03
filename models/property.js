const mongoose = require("mongoose");

const propertySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    content: { type: String, trim: true },

    images: [
      {
        url: { type: String, required: true },
        public_id: { type: String },
      },
    ],

    city: { type: String, required: true },
    propertyLocation: { type: String, required: true },
    coordinates: { latitude: Number, longitude: Number },

    price: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },

    mapUrl: { type: String },

    // 🏗️ Property Category (non-residential only)
    category: {
      type: String,
      enum: ["Outright", "Commercial", "Farmland", "JD/JV"],
      required: true,
    },
    
    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending"
    },
    
    displayOrder: {
      type: Number,
      default: 0,
      min: 0
    }, 
    isFeatured: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },
    

    forSale: { type: Boolean, default: true },
       
    websiteAssignment: {
      type: [{
        type: String,
        enum: ["cleartitle", "saimr", "both"] // Keep "both" as a value
      }],
      default: ["cleartitle"], // All new properties default to cleartitle only
      required: true,
      validate: {
        validator: function(v) {
          // Don't allow duplicate values
          return new Set(v).size === v.length;
        },
        message: "Website assignments must be unique"
      }
    },
    
    rejectionReason: { type: String, default: "" },
   
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // 🏢 Agent Information
    agentDetails: {
      agentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Agent",
      },
      name: {
        type: String,
        trim: true
      },
      phoneNumber: {
        type: String,
        trim: true
      },
      alternativePhoneNumber: {
        type: String,
        trim: true
      },
      email: {
        type: String,
        trim: true,
        lowercase: true
      },
      company: {
        type: String,
        trim: true
      },
      languages: [{
        type: String,
        trim: true
      }],
      officeAddress: {
        street: String,
        city: String,
        state: String,
        pincode: String
      }
    },

    // 🧱 Key attributes
    attributes: {
      square: String,
      propertyLabel: String,
      leaseDuration: String, // optional for future lease expansion
      typeOfJV: String, // JD/JV only
      expectedROI: Number, // JD/JV or Commercial
      irrigationAvailable: Boolean, // Farmland only
      facing: String,
      roadWidth: Number,
      waterSource: String,
      soilType: String, // Farmland
      legalClearance: Boolean, // Outright/JD/JV
    },

    distanceKey: [{ type: String }],

    // 🌾 Features (focused and relevant)
    features: [
      {
        type: String,
        enum: [
          // 🏬 Commercial
          "Conference Room",
          "CCTV Surveillance",
          "Power Backup",
          "Fire Safety",
          "Cafeteria",
          "Reception Area",
          "Parking",
          "Lift(s)",

          // 🌾 Farmland
          "Borewell",
          "Fencing",
          "Electricity Connection",
          "Water Source",
          "Drip Irrigation",
          "Storage Shed",

          // 🏗️ Outright / JD/JV
          "Highway Access",
          "Legal Assistance",
          "Joint Development Approved",
          "Investor Friendly",
          "Gated Boundary",
        ],
      },
    ],

    // 📍 Nearby (mainly for Commercial & Outright)
    nearby: {
      Highway: { type: Number },
      Airport: { type: Number },
      BusStop: { type: Number },
      Metro: { type: Number },
      CityCenter: { type: Number },
      IndustrialArea: { type: Number },
    },
  },
  { timestamps: true }
);

// Index for better query performance
propertySchema.index({ "agentDetails.agentId": 1 });

module.exports = mongoose.model("Property", propertySchema);