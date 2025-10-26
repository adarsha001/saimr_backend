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
    coordinates: { 
      latitude: Number, 
      longitude: Number 
    },
    price: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    mapUrl: { type: String },
    category: {
      type: String,
      enum: [
        "Flat",
        "Villa",
        "House",
        "Lease",
        "Outrade",
        "Commercial",
        "Plots",
        "Farmland",
        "JD/JV",
      ],
      required: true,
    },
    isFeatured: { type: Boolean, default: false },
    forSale: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
    // Add createdBy field to track the user who created the property
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    attributes: {
      bedrooms: Number,
      bathrooms: Number,
      floors: Number,
      square: Number,
      propertyLabel: String,
      leaseDuration: String,
      typeOfJV: String,
      expectedROI: Number,
      garden: Boolean,
      irrigationAvailable: Boolean,
      balcony: Boolean,
    },
    distanceKey: [{ type: String }],
    features: [
      {
        type: String,
        enum: [
          "Wifi",
          "Parking",
          "Swimming pool",
          "Balcony",
          "Garden",
          "Security",
          "Fitness center",
          "Children's Play Area",
          "Indore Games",
          "Laundry Room",
          "Pets Allow",
          "Spa & Massage",
          "Electricity",
          "Gated Community",
          "Street Lamp",
          "Drainage",
          "Tennis Court",
          "Lift(s)",
          "Golf Course",
          "Jogging Track",
          "Club House",
          "Senior Citizen Siteout",
          "Squash Court",
          "Yoga / Meditation Area",
          "Jacuzzi",
          "Mini Theatre",
        ],
      },
    ],
    nearby: {
      Hospital: { type: Number },
      SuperMarket: { type: Number },
      School: { type: Number },
      Airport: { type: Number },
      BusStop: { type: Number },
      Pharmacy: { type: Number },
      Metro: { type: Number },
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Property", propertySchema);