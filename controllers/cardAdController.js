// controllers/cardAdController.js
const CardAd = require('../models/CardAd');
const cloudinary = require('../config/cloudinary');
const fs = require('fs');
const path = require('path');

// Get ads for specific section (public)
const getSectionAds = async (req, res) => {
  try {
    const { section } = req.params;
    const { target = 'both', limit = 20 } = req.query;
    
    const query = {
      section: section,
      isActive: true,
      target: { $in: [target, 'both'] }
    };
    
    const ads = await CardAd.find(query)
      .sort({ displayOrder: 1, createdAt: -1 })
      .limit(parseInt(limit));
    
    res.json({
      success: true,
      data: ads,
      section: section
    });
  } catch (error) {
    console.error('Error fetching section ads:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching ads'
    });
  }
};

// Get all sections with their ads
const getAllSections = async (req, res) => {
  try {
    const { target = 'both' } = req.query;
    
    const sections = ['first', 'second', 'third', 'fourth', 'fifth', 'hero', 'sidebar', 'footer', 'promo'];
    const result = {};
    
    for (const section of sections) {
      const ads = await CardAd.find({
        section: section,
        isActive: true,
        target: { $in: [target, 'both'] }
      }).sort({ displayOrder: 1 });
      
      if (ads.length > 0) {
        result[section] = ads;
      }
    }
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error fetching all sections:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching sections'
    });
  }
};

// Create ad (admin)
const createCardAd = async (req, res) => {
  try {
    console.log('Creating card ad:', req.body);
    console.log('File received:', req.file);
    
    const {
      section,
      target,
      link,
      displayOrder,
      rotationInterval,
      overlayTitle,
      overlayDescription,
      ctaText,
      isActive
    } = req.body;
    
    // Check if file is uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Image is required'
      });
    }
    
    if (!section) {
      return res.status(400).json({
        success: false,
        message: 'Section is required'
      });
    }
    
    let imageUrl = null;
    let publicId = null;
    
    // Upload to Cloudinary
    try {
      console.log('Uploading image to Cloudinary:', req.file.path);
      console.log('File exists?', fs.existsSync(req.file.path));
      
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: `card-ads/${section}`,
        transformation: [
          { quality: 'auto' },
          { fetch_format: 'auto' }
        ]
      });
      
      imageUrl = result.secure_url;
      publicId = result.public_id;
      console.log('Upload successful:', imageUrl);
      
      // Clean up temp file
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
        console.log('Deleted temp file:', req.file.path);
      }
    } catch (uploadError) {
      console.error('Cloudinary upload error:', uploadError);
      
      // Clean up temp file in case of error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      return res.status(500).json({
        success: false,
        message: 'Error uploading image to Cloudinary',
        error: uploadError.message
      });
    }
    
    const ad = new CardAd({
      section,
      desktopImage: imageUrl,
      mobileImage: imageUrl, // Use same image for mobile if not specified
      target: target || 'both',
      link: link || '#',
      displayOrder: parseInt(displayOrder) || 0,
      rotationInterval: parseInt(rotationInterval) || 5000,
      overlayTitle: overlayTitle || '',
      overlayDescription: overlayDescription || '',
      ctaText: ctaText || '',
      isActive: isActive === 'false' ? false : true
    });
    
    await ad.save();
    
    res.status(201).json({
      success: true,
      message: 'Ad created successfully',
      data: ad
    });
    
  } catch (error) {
    console.error('Error creating ad:', error);
    
    // Clean up uploaded file in case of error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
      console.log('Cleaned up temp file on error:', req.file.path);
    }
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error creating ad',
      error: error.message
    });
  }
};

// Update ad (admin)
const updateCardAd = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Updating card ad:', id);
    console.log('Request body:', req.body);
    console.log('File received:', req.file);
    
    const {
      section,
      target,
      link,
      displayOrder,
      rotationInterval,
      isActive,
      overlayTitle,
      overlayDescription,
      ctaText
    } = req.body;
    
    const ad = await CardAd.findById(id);
    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found'
      });
    }
    
    // Update fields
    if (section) ad.section = section;
    if (target) ad.target = target;
    if (link) ad.link = link;
    if (displayOrder !== undefined) ad.displayOrder = parseInt(displayOrder);
    if (rotationInterval) ad.rotationInterval = parseInt(rotationInterval);
    if (isActive !== undefined) ad.isActive = isActive === 'true' || isActive === true;
    if (overlayTitle !== undefined) ad.overlayTitle = overlayTitle;
    if (overlayDescription !== undefined) ad.overlayDescription = overlayDescription;
    if (ctaText !== undefined) ad.ctaText = ctaText;
    
    // Update image if new one uploaded
    if (req.file) {
      try {
        // Delete old image from Cloudinary
        if (ad.desktopImage) {
          const publicId = ad.desktopImage.split('/').slice(-2).join('/').split('.')[0];
          await cloudinary.uploader.destroy(publicId);
          console.log('Deleted old image from Cloudinary:', publicId);
        }
        
        // Upload new image
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: `card-ads/${ad.section}`,
          transformation: [
            { quality: 'auto' },
            { fetch_format: 'auto' }
          ]
        });
        
        ad.desktopImage = result.secure_url;
        ad.mobileImage = result.secure_url;
        console.log('Uploaded new image:', result.secure_url);
        
        // Clean up temp file
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
          console.log('Deleted temp file:', req.file.path);
        }
      } catch (uploadError) {
        console.error('Cloudinary upload error:', uploadError);
        
        // Clean up temp file in case of error
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        
        return res.status(500).json({
          success: false,
          message: 'Error uploading image to Cloudinary',
          error: uploadError.message
        });
      }
    }
    
    await ad.save();
    
    res.json({
      success: true,
      message: 'Ad updated successfully',
      data: ad
    });
    
  } catch (error) {
    console.error('Error updating ad:', error);
    
    // Clean up uploaded file in case of error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      success: false,
      message: 'Error updating ad',
      error: error.message
    });
  }
};

// Delete ad (admin)
const deleteCardAd = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Deleting card ad:', id);
    
    const ad = await CardAd.findById(id);
    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found'
      });
    }
    
    // Delete image from Cloudinary
    if (ad.desktopImage) {
      try {
        const publicId = ad.desktopImage.split('/').slice(-2).join('/').split('.')[0];
        await cloudinary.uploader.destroy(publicId);
        console.log('Deleted image from Cloudinary:', publicId);
      } catch (cloudinaryError) {
        console.error('Error deleting from Cloudinary:', cloudinaryError);
        // Continue with deletion even if Cloudinary fails
      }
    }
    
    await ad.deleteOne();
    
    res.json({
      success: true,
      message: 'Ad deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting ad:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting ad',
      error: error.message
    });
  }
};

// Track click
const trackClick = async (req, res) => {
  try {
    const { id } = req.params;
    
    await CardAd.findByIdAndUpdate(id, {
      $inc: { clicks: 1 }
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error tracking click:', error);
    res.status(500).json({ success: false, message: 'Error tracking click' });
  }
};

// Track view
const trackView = async (req, res) => {
  try {
    const { id } = req.params;
    
    await CardAd.findByIdAndUpdate(id, {
      $inc: { views: 1 }
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error tracking view:', error);
    res.status(500).json({ success: false, message: 'Error tracking view' });
  }
};

// Update order for multiple ads in same section
const updateSectionOrder = async (req, res) => {
  try {
    const { section, updates } = req.body; 
    // updates: [{ id: '...', displayOrder: 1 }]
    
    console.log('Updating section order:', section, updates);
    
    for (const item of updates) {
      await CardAd.findByIdAndUpdate(item.id, {
        displayOrder: item.displayOrder
      });
    }
    
    res.json({
      success: true,
      message: `${section} section order updated successfully`
    });
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating order',
      error: error.message
    });
  }
};

// Get available sections list
const getSectionsList = async (req, res) => {
  try {
    const sections = [
      { value: 'first', label: 'First Section', description: 'Top banner area' },
      { value: 'second', label: 'Second Section', description: 'Below hero section' },
      { value: 'third', label: 'Third Section', description: 'Middle content area' },
      { value: 'fourth', label: 'Fourth Section', description: 'Before footer' },
      { value: 'fifth', label: 'Fifth Section', description: 'Bottom area' },
      { value: 'hero', label: 'Hero Section', description: 'Main hero banner' },
      { value: 'sidebar', label: 'Sidebar Section', description: 'Sidebar ads' },
      { value: 'footer', label: 'Footer Section', description: 'Footer area' },
      { value: 'promo', label: 'Promo Section', description: 'Promotional banners' }
    ];
    
    res.json({
      success: true,
      data: sections
    });
  } catch (error) {
    console.error('Error fetching sections:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching sections'
    });
  }
};

module.exports = {
  getSectionAds,
  getAllSections,
  createCardAd,
  updateCardAd,
  deleteCardAd,
  trackClick,
  trackView,
  updateSectionOrder,
  getSectionsList
};