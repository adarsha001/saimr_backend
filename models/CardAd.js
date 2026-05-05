// models/CardAd.js
const mongoose = require('mongoose');

const cardAdSchema = new mongoose.Schema(
  {
    // Section identifier (e.g., 'hero', 'sidebar', 'footer', 'promo1', 'promo2')
    section: {
      type: String,
      required: true,
      enum: ['first', 'second', 'third', 'fourth', 'fifth', 'hero', 'sidebar', 'footer', 'promo'],
      default: 'first'
    },
    
    // Section display name for admin panel
    sectionName: {
      type: String,
      default: function() {
        return this.section.charAt(0).toUpperCase() + this.section.slice(1) + ' Section';
      }
    },
    
    // Image URLs
    desktopImage: {
      type: String,
      required: true
    },
    mobileImage: {
      type: String
    },
    
    // Target audience
    target: {
      type: String,
      enum: ['guest', 'member', 'both'],
      default: 'both'
    },
    
    // Click destination
    link: {
      type: String,
      default: '#'
    },
    
    // Display settings
    isActive: {
      type: Boolean,
      default: true
    },
    
    // Display order within its section
    displayOrder: {
      type: Number,
      default: 0
    },
    
    // Rotation speed for this specific card (milliseconds)
    rotationInterval: {
      type: Number,
      default: 5000
    },
    
    // Optional title/text overlay (if designer wants to add text)
    overlayTitle: {
      type: String
    },
    overlayDescription: {
      type: String
    },
    ctaText: {
      type: String
    },
    
    // Analytics
    clicks: {
      type: Number,
      default: 0
    },
    views: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

// Compound index for efficient queries by section and order
cardAdSchema.index({ section: 1, displayOrder: 1, isActive: 1 });
cardAdSchema.index({ section: 1, target: 1, isActive: 1 });

module.exports = mongoose.model('CardAd', cardAdSchema);