// models/CarouselImage.js (updated with mobilePublic_id)
const mongoose = require('mongoose');

const carouselImageSchema = new mongoose.Schema(
  {
    // Reference to property unit (optional)
    propertyUnit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PropertyUnit',
      required: false
    },

    // Desktop Image (High resolution - up to 7900px width)
    desktopImageUrl: {
      type: String,
      required: true
    },
    
    // Cloudinary public ID for desktop image
    public_id: {
      type: String,
      required: true
    },
    
    // Mobile Image (optimized - 2500x1200)
    mobileImageUrl: {
      type: String,
      required: true
    },
    
    // Cloudinary public ID for mobile image (separate)
    mobilePublic_id: {
      type: String
    },

    // Image details
    title: {
      type: String,
      required: true,
      trim: true
    },
    
    description: {
      type: String,
      trim: true
    },

    // Property type association
    propertyType: {
      type: String,
      enum: [
        'Apartment',
        'Villa',
        'Independent House',
        'Studio',
        'Penthouse',
        'Duplex',
        'Pg house',
        'Plot',
        'Commercial Space',
        'all' // For general images
      ],
      default: 'all'
    },

    // Display settings
    isMainBanner: {
      type: Boolean,
      default: false
    },

    // Analytics
    clicks: {
      type: Number,
      default: 0
    },
    
    views: {
      type: Number,
      default: 0
    },

    // Status
    isActive: {
      type: Boolean,
      default: true
    },

    // Display order
    displayOrder: {
      type: Number,
      default: 0
    },

    // Alt text for accessibility
    altText: {
      type: String,
      default: ''
    },

    // Optional link when image is clicked
    link: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for better query performance
carouselImageSchema.index({ propertyType: 1, isMainBanner: 1 });
carouselImageSchema.index({ isActive: 1, displayOrder: 1 });
carouselImageSchema.index({ propertyUnit: 1 });

// Instance methods
carouselImageSchema.methods = {
  // Increment click count
  async incrementClicks() {
    this.clicks += 1;
    return this.save();
  },

  // Increment view count
  async incrementViews() {
    this.views += 1;
    return this.save();
  },

  // Get URL for specific device
  getUrl(device = 'desktop') {
    if (device === 'mobile' && this.mobileImageUrl) {
      return this.mobileImageUrl;
    }
    return this.desktopImageUrl;
  }
};

// Create the model
const CarouselImage = mongoose.model('CarouselImage', carouselImageSchema);

module.exports = CarouselImage;