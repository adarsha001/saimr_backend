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
    mapUrl: { type: String }, // new field for map link
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
    attributes: {
      bedrooms: Number,
      bathrooms: Number,
      floors: Number,
      square: Number,
      price: Number,
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
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Property", propertySchema);
