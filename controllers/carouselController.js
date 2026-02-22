// controllers/carouselController.js
const CarouselImage = require('../models/CarouselImage');
const PropertyUnit = require('../models/PropertyUnit');
const cloudinary = require('../config/cloudinary');
const fs = require('fs');

/**
 * Create a new carousel image with separate desktop and mobile uploads
 */
const createCarouselImage = async (req, res) => {
  try {
    console.log('Creating carousel image:', req.body);
    console.log('Files received:', req.files);
    
    // Check if user is authenticated
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const {
      propertyUnit,
      title,
      description,
      propertyType,
      isMainBanner,
      displayOrder,
      altText,
      link,
      isActive
    } = req.body;

    // Check required fields
    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Title is required'
      });
    }

    // Check if files are uploaded
    if (!req.files || (!req.files.desktopImage && !req.files.mobileImage)) {
      return res.status(400).json({
        success: false,
        message: 'At least one image file (desktop or mobile) is required'
      });
    }

    let desktopImageUrl = req.body.desktopImageUrl;
    let mobileImageUrl = req.body.mobileImageUrl;
    let desktopPublicId = null;
    let mobilePublicId = null;

    // Upload desktop image to Cloudinary if provided
    if (req.files && req.files.desktopImage) {
      try {
        const desktopFile = req.files.desktopImage[0];
        console.log('Uploading desktop image:', desktopFile.originalname);
        console.log('Desktop file path:', desktopFile.path);
        
        const result = await cloudinary.uploader.upload(desktopFile.path, {
          folder: 'carousel-images/desktop',
          transformation: [
            { quality: 'auto' },
            { fetch_format: 'auto' }
          ]
        });
        
        desktopImageUrl = result.secure_url;
        desktopPublicId = result.public_id;
        
        // Clean up temp file
        if (fs.existsSync(desktopFile.path)) {
          fs.unlinkSync(desktopFile.path);
          console.log('Deleted temp file:', desktopFile.path);
        }
      } catch (uploadError) {
        console.error('Cloudinary desktop upload error:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Error uploading desktop image to Cloudinary',
          error: uploadError.message
        });
      }
    }

    // Upload mobile image to Cloudinary if provided
    if (req.files && req.files.mobileImage) {
      try {
        const mobileFile = req.files.mobileImage[0];
        console.log('Uploading mobile image:', mobileFile.originalname);
        console.log('Mobile file path:', mobileFile.path);
        
        const result = await cloudinary.uploader.upload(mobileFile.path, {
          folder: 'carousel-images/mobile',
          transformation: [
            { quality: 'auto' },
            { fetch_format: 'auto' }
          ]
        });
        
        mobileImageUrl = result.secure_url;
        mobilePublicId = result.public_id;
        
        // Clean up temp file
        if (fs.existsSync(mobileFile.path)) {
          fs.unlinkSync(mobileFile.path);
          console.log('Deleted temp file:', mobileFile.path);
        }
      } catch (uploadError) {
        console.error('Cloudinary mobile upload error:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Error uploading mobile image to Cloudinary',
          error: uploadError.message
        });
      }
    }

    // If mobile image not provided but desktop is, create a responsive version
    if (!mobileImageUrl && desktopImageUrl) {
      mobileImageUrl = desktopImageUrl.replace('/upload/', '/upload/w_2500,h_1200,c_limit/');
    }

    // Create carousel image
    const carouselImage = new CarouselImage({
      propertyUnit: propertyUnit || null,
      desktopImageUrl,
      mobileImageUrl: mobileImageUrl || desktopImageUrl,
      public_id: desktopPublicId || mobilePublicId || `carousel_${Date.now()}`,
      mobilePublic_id: mobilePublicId,
      title,
      description: description || '',
      propertyType: propertyType || 'all',
      isMainBanner: isMainBanner === 'true' || isMainBanner === true,
      displayOrder: displayOrder ? parseInt(displayOrder) : 0,
      altText: altText || title,
      link: link || '',
      isActive: isActive === 'false' ? false : true
    });

    await carouselImage.save();

    // If linked to property unit, update the property's carouselImages array
    if (propertyUnit) {
      await PropertyUnit.findByIdAndUpdate(
        propertyUnit,
        { $addToSet: { carouselImages: carouselImage._id } }
      );
    }

    res.status(201).json({
      success: true,
      message: 'Carousel image created successfully',
      data: carouselImage
    });

  } catch (error) {
    console.error('Error creating carousel image:', error);
    
    // Clean up any uploaded files in case of error
    if (req.files) {
      if (req.files.desktopImage) {
        req.files.desktopImage.forEach(file => {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
            console.log('Cleaned up temp file on error:', file.path);
          }
        });
      }
      if (req.files.mobileImage) {
        req.files.mobileImage.forEach(file => {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
            console.log('Cleaned up temp file on error:', file.path);
          }
        });
      }
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
      message: 'Error creating carousel image',
      error: error.message
    });
  }
};

/**
 * Update carousel image with separate desktop and mobile images
 */
const updateCarouselImage = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    console.log('Updating carousel image:', id);
    console.log('Files received:', req.files);

    // Find existing image
    const image = await CarouselImage.findById(id);
    if (!image) {
      return res.status(404).json({
        success: false,
        message: 'Carousel image not found'
      });
    }

    // Handle desktop image update if new file provided
    if (req.files && req.files.desktopImage) {
      try {
        const desktopFile = req.files.desktopImage[0];
        
        // Delete old desktop image from Cloudinary if exists
        if (image.public_id) {
          await cloudinary.uploader.destroy(image.public_id);
        }

        // Upload new desktop image
        const result = await cloudinary.uploader.upload(desktopFile.path, {
          folder: 'carousel-images/desktop',
          transformation: [
            { quality: 'auto' },
            { fetch_format: 'auto' }
          ]
        });

        updates.desktopImageUrl = result.secure_url;
        updates.public_id = result.public_id;
        
        // Clean up temp file
        if (fs.existsSync(desktopFile.path)) {
          fs.unlinkSync(desktopFile.path);
        }
      } catch (uploadError) {
        console.error('Cloudinary desktop upload error:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Error uploading desktop image to Cloudinary'
        });
      }
    }

    // Handle mobile image update if new file provided
    if (req.files && req.files.mobileImage) {
      try {
        const mobileFile = req.files.mobileImage[0];
        
        // Delete old mobile image from Cloudinary if exists
        if (image.mobilePublic_id) {
          await cloudinary.uploader.destroy(image.mobilePublic_id);
        }

        // Upload new mobile image
        const result = await cloudinary.uploader.upload(mobileFile.path, {
          folder: 'carousel-images/mobile',
          transformation: [
            { quality: 'auto' },
            { fetch_format: 'auto' }
          ]
        });

        updates.mobileImageUrl = result.secure_url;
        updates.mobilePublic_id = result.public_id;
        
        // Clean up temp file
        if (fs.existsSync(mobileFile.path)) {
          fs.unlinkSync(mobileFile.path);
        }
      } catch (uploadError) {
        console.error('Cloudinary mobile upload error:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Error uploading mobile image to Cloudinary'
        });
      }
    }

    // Update fields
    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        // Convert string booleans
        if (updates[key] === 'true') updates[key] = true;
        if (updates[key] === 'false') updates[key] = false;
        
        // Convert numbers
        if (key === 'displayOrder' && updates[key]) {
          updates[key] = parseInt(updates[key]);
        }

        image[key] = updates[key];
      }
    });

    await image.save();

    res.status(200).json({
      success: true,
      message: 'Carousel image updated successfully',
      data: image
    });

  } catch (error) {
    console.error('Error updating carousel image:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating carousel image',
      error: error.message
    });
  }
};

/**
 * Get all carousel images with filters
 */
const getCarouselImages = async (req, res) => {
  try {
    const {
      propertyType,
      isMainBanner,
      isActive,
      limit = 20,
      page = 1,
      sortBy = 'displayOrder',
      includeInactive = false
    } = req.query;

    // Build filter query
    const filter = {};
    
    if (!includeInactive && includeInactive !== 'true') {
      filter.isActive = true;
    } else if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    if (propertyType && propertyType !== 'all') {
      filter.propertyType = propertyType;
    }

    if (isMainBanner !== undefined) {
      filter.isMainBanner = isMainBanner === 'true';
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const imageLimit = parseInt(limit);

    // Determine sort order
    let sortOptions = {};
    switch (sortBy) {
      case 'newest':
        sortOptions = { createdAt: -1 };
        break;
      case 'oldest':
        sortOptions = { createdAt: 1 };
        break;
      case 'mostViewed':
        sortOptions = { views: -1 };
        break;
      case 'mostClicked':
        sortOptions = { clicks: -1 };
        break;
      case 'displayOrder':
      default:
        sortOptions = { displayOrder: 1, createdAt: -1 };
        break;
    }

    // Get total count for pagination
    const totalCount = await CarouselImage.countDocuments(filter);

    // Fetch images
    const images = await CarouselImage.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(imageLimit)
      .populate('propertyUnit', 'title slug price city propertyType');

    res.status(200).json({
      success: true,
      data: images,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / imageLimit),
        totalItems: totalCount,
        itemsPerPage: imageLimit,
        hasMore: skip + imageLimit < totalCount
      }
    });

  } catch (error) {
    console.error('Error fetching carousel images:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching carousel images',
      error: error.message
    });
  }
};

/**
 * Get single carousel image by ID
 */
const getCarouselImageById = async (req, res) => {
  try {
    const { id } = req.params;

    const image = await CarouselImage.findById(id)
      .populate('propertyUnit', 'title slug price city propertyType description');

    if (!image) {
      return res.status(404).json({
        success: false,
        message: 'Carousel image not found'
      });
    }

    // Increment views
    await image.incrementViews();

    res.status(200).json({
      success: true,
      data: image
    });

  } catch (error) {
    console.error('Error fetching carousel image:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching carousel image',
      error: error.message
    });
  }
};

/**
 * Delete carousel image
 */
const deleteCarouselImage = async (req, res) => {
  try {
    const { id } = req.params;

    const image = await CarouselImage.findById(id);
    if (!image) {
      return res.status(404).json({
        success: false,
        message: 'Carousel image not found'
      });
    }

    // Delete desktop image from Cloudinary
    if (image.public_id) {
      await cloudinary.uploader.destroy(image.public_id);
    }

    // Delete mobile image from Cloudinary if exists
    if (image.mobilePublic_id) {
      await cloudinary.uploader.destroy(image.mobilePublic_id);
    }

    // Remove reference from property unit if exists
    if (image.propertyUnit) {
      await PropertyUnit.findByIdAndUpdate(
        image.propertyUnit,
        { $pull: { carouselImages: image._id } }
      );
    }

    await image.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Carousel image deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting carousel image:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting carousel image',
      error: error.message
    });
  }
};

/**
 * Get main banner images (for hero carousel)
 */
const getMainBanners = async (req, res) => {
  try {
    const { limit = 5 } = req.query;

    const banners = await CarouselImage.find({
      isMainBanner: true,
      isActive: true
    })
    .sort({ displayOrder: 1, createdAt: -1 })
    .limit(parseInt(limit))
    .populate('propertyUnit', 'title slug price city');

    res.status(200).json({
      success: true,
      data: banners
    });

  } catch (error) {
    console.error('Error fetching main banners:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching main banners',
      error: error.message
    });
  }
};

/**
 * Get images by property type (for category carousels)
 */
const getImagesByPropertyType = async (req, res) => {
  try {
    const { propertyType = 'all', limit = 10 } = req.query;

    const query = { isActive: true };
    
    if (propertyType && propertyType !== 'all') {
      query.propertyType = propertyType;
    }
    
    const images = await CarouselImage.find(query)
      .sort({ isMainBanner: -1, displayOrder: 1, createdAt: -1 })
      .limit(parseInt(limit))
      .populate('propertyUnit', 'title slug price city');

    res.status(200).json({
      success: true,
      data: images
    });

  } catch (error) {
    console.error('Error fetching images by property type:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching images by property type',
      error: error.message
    });
  }
};

/**
 * Get random images for hero carousel
 */
const getRandomImages = async (req, res) => {
  try {
    const { count = 5 } = req.query;

    const images = await CarouselImage.aggregate([
      { $match: { isActive: true } },
      { $sample: { size: parseInt(count) } },
      {
        $lookup: {
          from: 'propertyunits',
          localField: 'propertyUnit',
          foreignField: '_id',
          as: 'propertyDetails'
        }
      },
      {
        $addFields: {
          propertyDetails: { $arrayElemAt: ['$propertyDetails', 0] }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: images
    });

  } catch (error) {
    console.error('Error fetching random images:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching random images',
      error: error.message
    });
  }
};

/**
 * Track click on carousel image
 */
const trackClick = async (req, res) => {
  try {
    const { id } = req.params;

    const image = await CarouselImage.findById(id);
    if (!image) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    await image.incrementClicks();

    res.status(200).json({
      success: true,
      message: 'Click tracked successfully'
    });

  } catch (error) {
    console.error('Error tracking click:', error);
    res.status(500).json({
      success: false,
      message: 'Error tracking click',
      error: error.message
    });
  }
};

/**
 * Bulk update display order
 */
const updateDisplayOrder = async (req, res) => {
  try {
    const { updates } = req.body; // Expected format: [{ id: '...', displayOrder: 1 }]

    if (!Array.isArray(updates)) {
      return res.status(400).json({
        success: false,
        message: 'Updates must be an array'
      });
    }

    const bulkOps = updates.map(({ id, displayOrder }) => ({
      updateOne: {
        filter: { _id: id },
        update: { displayOrder: parseInt(displayOrder) }
      }
    }));

    await CarouselImage.bulkWrite(bulkOps);

    res.status(200).json({
      success: true,
      message: 'Display order updated successfully'
    });

  } catch (error) {
    console.error('Error updating display order:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating display order',
      error: error.message
    });
  }
};

module.exports = {
  createCarouselImage,
  getCarouselImages,
  getCarouselImageById,
  updateCarouselImage,
  deleteCarouselImage,
  getMainBanners,
  getImagesByPropertyType,
  getRandomImages,
  trackClick,
  updateDisplayOrder
};