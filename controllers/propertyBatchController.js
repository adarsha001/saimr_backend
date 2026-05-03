const PropertyBatch = require('../models/PropertyBatch');
const PropertyUnit = require('../models/PropertyUnit');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;

// @desc    Create a new property batch
// @route   POST /api/property-batches
// @access  Private/Admin only
exports.createBatch = async (req, res) => {
  try {
    console.log('User making request:', req.user);
    
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated. Please login to create batch'
      });
    }

    const {
      batchName,
      locationName,
      description,
      image,
      propertyUnits = [],
      batchType = 'location_based',
      tags = [],
      locationCoordinates,
      isActive = true,
      displayOrder = 0
    } = req.body;

    if (!batchName || !locationName) {
      return res.status(400).json({
        success: false,
        message: 'Batch name and location name are required'
      });
    }

    const validBatchTypes = [
      "location_based",
      "project_group",
      "featured_listings",
      "similar_properties",
      "comparison_group"
    ];
    
    if (!validBatchTypes.includes(batchType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid batch type. Must be one of: ${validBatchTypes.join(', ')}`
      });
    }

    // IMAGE HANDLING
    let uploadedImage = null;
    
    if (req.file) {
      try {
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: "property_batches",
        });
        
        uploadedImage = {
          url: result.secure_url,
          public_id: result.public_id,
          caption: image?.caption || req.body.imageCaption || ''
        };
      } catch (uploadError) {
        console.error('Cloudinary upload error:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Error uploading image to Cloudinary'
        });
      }
    } else if (image && image.url) {
      uploadedImage = {
        url: image.url,
        public_id: image.public_id || '',
        caption: image.caption || req.body.imageCaption || ''
      };
    } else {
      return res.status(400).json({
        success: false,
        message: 'Image is required. Please provide an image file or URL'
      });
    }

    // Parse property units with display order
    let parsedPropertyUnits = [];
    let rawPropertyIds = [];
    
    if (propertyUnits && propertyUnits.length > 0) {
      try {
        if (typeof propertyUnits === 'string') {
          rawPropertyIds = JSON.parse(propertyUnits);
        } else if (Array.isArray(propertyUnits)) {
          if (propertyUnits.length > 0 && typeof propertyUnits[0] === 'object' && propertyUnits[0].propertyId) {
            rawPropertyIds = propertyUnits.map(p => p.propertyId);
          } else {
            rawPropertyIds = propertyUnits;
          }
        }
        
        if (rawPropertyIds.length > 0) {
          const validUnits = await PropertyUnit.find({ 
            _id: { $in: rawPropertyIds } 
          }).select('_id price propertyType');
          
          const validUnitIds = validUnits.map(unit => unit._id.toString());
          const validUnitsMap = new Map(validUnits.map(unit => [unit._id.toString(), unit]));
          
          const invalidUnits = rawPropertyIds.filter(unitId => 
            !validUnitIds.includes(unitId.toString())
          );
          
          if (invalidUnits.length > 0) {
            return res.status(400).json({
              success: false,
              message: `Invalid property units: ${invalidUnits.join(', ')}`,
              validUnits: validUnitIds
            });
          }
          
          // Create property units with display order
          parsedPropertyUnits = rawPropertyIds.map((propertyId, index) => {
            const property = validUnitsMap.get(propertyId.toString());
            return {
              propertyId: propertyId,
              displayOrder: index, // Set initial display order based on array index
              userViews: [],
              propertyStats: {
                totalViews: 0,
                uniqueViewers: 0,
                totalViewDuration: 0,
                avgViewDuration: 0,
                lastViewedAt: null
              }
            };
          });
        }
      } catch (parseError) {
        console.error('Property units parse error:', parseError);
        return res.status(400).json({
          success: false,
          message: 'Invalid property units format. Please provide array of property IDs'
        });
      }
    }

    // Parse location coordinates
    let parsedCoordinates = {};
    if (locationCoordinates) {
      try {
        parsedCoordinates = typeof locationCoordinates === 'string' 
          ? JSON.parse(locationCoordinates) 
          : locationCoordinates;
      } catch (parseError) {
        console.error('Coordinates parse error:', parseError);
      }
    }

    // Parse tags
    let parsedTags = [];
    if (tags && tags.length > 0) {
      try {
        parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags;
      } catch (parseError) {
        console.error('Tags parse error:', parseError);
        parsedTags = [];
      }
    }

    // Calculate batch statistics
    let totalPrice = 0;
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    const propertyTypesSet = new Set();
    
    if (parsedPropertyUnits.length > 0) {
      const propertyIds = parsedPropertyUnits.map(p => p.propertyId);
      const properties = await PropertyUnit.find({ _id: { $in: propertyIds } })
        .select('unitTypes.price.amount propertyType');
      
      properties.forEach(property => {
        let price = 0;
        if (property.unitTypes && property.unitTypes.length > 0) {
          price = property.unitTypes[0].price?.amount || 0;
        }
        
        totalPrice += price;
        if (price < minPrice) minPrice = price;
        if (price > maxPrice) maxPrice = price;
        
        if (property.propertyType) {
          propertyTypesSet.add(property.propertyType);
        }
      });
    }
    
    const avgPrice = parsedPropertyUnits.length > 0 ? totalPrice / parsedPropertyUnits.length : 0;
    if (minPrice === Infinity) minPrice = 0;
    if (maxPrice === -Infinity) maxPrice = 0;

    // Create display orders object
    const displayOrders = {
      location_based_order: 0,
      project_group_order: 0,
      featured_listings_order: 0,
      similar_properties_order: 0,
      comparison_group_order: 0
    };
    
    // Set the display order for the specific batch type
    displayOrders[`${batchType}_order`] = parseInt(displayOrder) || 0;

    // Create new batch
    const batch = new PropertyBatch({
      batchName: batchName.trim(),
      locationName: locationName.trim(),
      description: description || '',
      image: uploadedImage,
      propertyUnits: parsedPropertyUnits,
      batchType,
      displayOrders,
      locationCoordinates: parsedCoordinates,
      tags: parsedTags,
      isActive: isActive === 'true' || isActive === true,
      createdBy: req.user._id,
      stats: {
        totalProperties: parsedPropertyUnits.length,
        totalViews: 0,
        uniqueViewers: 0,
        avgPrice: avgPrice,
        minPrice: minPrice,
        maxPrice: maxPrice,
        propertyTypes: Array.from(propertyTypesSet),
        lastViewedAt: null
      }
    });

    await batch.save();
    
    await batch.populate('createdBy', 'name email username');
    await batch.populate('propertyUnits.propertyId', 'title propertyType city price images');

    res.status(201).json({
      success: true,
      data: batch,
      message: `Property batch '${batch.batchName}' created successfully with ${parsedPropertyUnits.length} properties`
    });
    
  } catch (error) {
    console.error('Error creating batch:', error);
    
    if (error.code === 11000 && error.keyPattern && error.keyPattern.batchCode) {
      return res.status(400).json({
        success: false,
        message: 'Batch code already exists. Please try again or use a different name.'
      });
    }
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors
      });
    }
    
    res.status(500).json({
      success: false,
      message: error.message || 'Server error creating batch'
    });
  }
};

// @desc    Get all property batches
// @route   GET /api/property-batches
// @access  Public
exports.getAllBatches = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      location, 
      batchType, 
      tags,
      search,
      isActive = true,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    
    const query = {};
    
    const isAdminUser = req.user && (
      req.user?.isAdmin || 
      req.user?.userType === 'superadmin' || 
      req.user?.userType === 'admin'
    );
    
    if (!isAdminUser) {
      query.isActive = isActive === 'true' || isActive === true;
    }
    
    if (location) {
      query.locationName = new RegExp(location, 'i');
    }
    
    if (batchType) {
      query.batchType = batchType;
    }
    
    if (tags) {
      const tagsArray = tags.split(',');
      query.tags = { $in: tagsArray };
    }
    
    if (search) {
      query.$or = [
        { batchName: new RegExp(search, 'i') },
        { locationName: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') },
        { batchCode: new RegExp(search, 'i') }
      ];
    }
    
    if (req.user && !isAdminUser) {
      query.$or = [
        { createdBy: req.user._id },
        { isActive: true }
      ];
    }
    
    const pageInt = parseInt(page);
    const limitInt = parseInt(limit);
    const skip = (pageInt - 1) * limitInt;
    
    // Handle sorting by display order for specific batch types
    let sort = {};
    if (sortBy === 'displayOrder' && batchType) {
      sort[`displayOrders.${batchType}_order`] = sortOrder === 'asc' ? 1 : -1;
    } else {
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
    }
    
    const batches = await PropertyBatch.find(query)
      .populate('createdBy', 'name email username')
      .populate({
        path: 'propertyUnits.propertyId',
        select: 'title price images city specifications.bedrooms specifications.bathrooms availability isFeatured'
      })
      .sort(sort)
      .skip(skip)
      .limit(limitInt);
    
    // Sort properties within each batch by displayOrder
    batches.forEach(batch => {
      if (batch.propertyUnits && batch.propertyUnits.length > 0) {
        batch.propertyUnits.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
      }
    });
    
    const total = await PropertyBatch.countDocuments(query);
    
    res.json({
      success: true,
      data: batches,
      pagination: {
        page: pageInt,
        limit: limitInt,
        total,
        pages: Math.ceil(total / limitInt)
      }
    });
  } catch (error) {
    console.error('Error fetching batches:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching batches'
    });
  }
};

// @desc    Get single property batch
// @route   GET /api/property-batches/:id
// @access  Public
exports.getBatch = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid batch ID'
      });
    }
    
    const batch = await PropertyBatch.findById(id)
      .populate('createdBy', 'name email username')
      .populate({
        path: 'propertyUnits.propertyId',
        select: '-createdBy -__v',
        populate: {
          path: 'createdBy',
          select: 'name email phoneNumber'
        }
      });
    
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Property batch not found'
      });
    }
    
    // Sort properties by display order
    if (batch.propertyUnits && batch.propertyUnits.length > 0) {
      batch.propertyUnits.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    }
    
    const isAdminUser = req.user && (
      req.user?.isAdmin || 
      req.user?.userType === 'superadmin' || 
      req.user?.userType === 'admin'
    );
    
    const isOwner = req.user && batch.createdBy._id.toString() === req.user._id.toString();
    
    if (!batch.isActive) {
      if (!req.user) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. This batch is not active'
        });
      }
      
      if (!isAdminUser && !isOwner) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. This batch is not active'
        });
      }
    }
    
    res.json({
      success: true,
      data: batch
    });
  } catch (error) {
    console.error('Error fetching batch:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching batch'
    });
  }
};

// @desc    Update property batch
// @route   PUT /api/property-batches/:id
// @access  Private/Admin only
// In propertyBatchController.js - Update the updateBatch function

// Update the updateBatch function in your backend

exports.updateBatch = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    console.log('=== BACKEND UPDATE START ===');
    console.log('Batch ID:', id);
    console.log('Received updates:', updates);
    console.log('PropertyUnits raw:', updates.propertyUnits);
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid batch ID'
      });
    }
    
    const batch = await PropertyBatch.findById(id);
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Property batch not found'
      });
    }
    
    const isAdminUser = req.user && (
      req.user?.isAdmin || 
      req.user?.userType === 'superadmin' || 
      req.user?.userType === 'admin'
    );
    
    if (!isAdminUser) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to update this batch. Admin access required.'
      });
    }
    
    // Handle image update
    if (req.file) {
      try {
        if (batch.image && batch.image.public_id) {
          await cloudinary.uploader.destroy(batch.image.public_id);
        }
        
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: "property_batches",
        });
        
        updates.image = {
          url: result.secure_url,
          public_id: result.public_id,
          caption: updates.imageCaption || batch.image?.caption || ''
        };
      } catch (uploadError) {
        console.error('Cloudinary upload error:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Error updating image'
        });
      }
    } else if (updates.image && updates.image.url && !updates.image.public_id) {
      updates.image = {
        url: updates.image.url,
        public_id: batch.image?.public_id || '',
        caption: updates.image.caption || batch.image?.caption || ''
      };
    }
    
    // Handle property units update
    if (updates.propertyUnits) {
      try {
        // Parse propertyUnits if it's a string
        let propertyUnitIds = updates.propertyUnits;
        if (typeof propertyUnitIds === 'string') {
          propertyUnitIds = JSON.parse(propertyUnitIds);
        }
        
        console.log('Parsed propertyUnitIds:', propertyUnitIds);
        
        // Ensure it's an array
        if (!Array.isArray(propertyUnitIds)) {
          return res.status(400).json({
            success: false,
            message: 'Property units must be an array'
          });
        }
        
        // Clean and validate IDs
        const cleanIds = propertyUnitIds
          .map(id => {
            if (typeof id === 'object' && id !== null) {
              return id.propertyId || id._id || null;
            }
            return id;
          })
          .filter(id => id && typeof id === 'string');
        
        console.log('Clean IDs:', cleanIds);
        
        if (cleanIds.length > 0) {
          // Verify these property units exist
          const validUnits = await PropertyUnit.find({ 
            _id: { $in: cleanIds } 
          }).select('_id');
          
          const validUnitIds = validUnits.map(unit => unit._id.toString());
          
          const finalValidIds = cleanIds.filter(id => validUnitIds.includes(id.toString()));
          
          console.log('Final valid IDs:', finalValidIds);
          
          // Preserve existing display orders
          const existingPropertyMap = new Map();
          if (batch.propertyUnits && Array.isArray(batch.propertyUnits)) {
            batch.propertyUnits.forEach(p => {
              if (p.propertyId) {
                existingPropertyMap.set(p.propertyId.toString(), {
                  displayOrder: p.displayOrder,
                  userViews: p.userViews || [],
                  propertyStats: p.propertyStats || {
                    totalViews: 0, uniqueViewers: 0, totalViewDuration: 0, avgViewDuration: 0
                  }
                });
              }
            });
          }
          
          // Create new property units array
          updates.propertyUnits = finalValidIds.map((propertyId, index) => {
            const existing = existingPropertyMap.get(propertyId.toString());
            return {
              propertyId: propertyId,
              displayOrder: existing?.displayOrder ?? index,
              userViews: existing?.userViews || [],
              propertyStats: existing?.propertyStats || {
                totalViews: 0, uniqueViewers: 0, totalViewDuration: 0, avgViewDuration: 0
              }
            };
          });
        } else {
          updates.propertyUnits = [];
        }
        
        console.log('Final propertyUnits to save:', updates.propertyUnits);
      } catch (parseError) {
        console.error('Error parsing property units:', parseError);
        return res.status(400).json({
          success: false,
          message: 'Invalid property units format: ' + parseError.message
        });
      }
    }
    
    // Handle display order update
    if (updates.displayOrder !== undefined) {
      if (!batch.displayOrders) {
        batch.displayOrders = {
          location_based_order: 0,
          project_group_order: 0,
          featured_listings_order: 0,
          similar_properties_order: 0,
          comparison_group_order: 0
        };
      }
      batch.displayOrders[`${batch.batchType}_order`] = parseInt(updates.displayOrder);
      delete updates.displayOrder;
    }
    
    // Update other fields
    Object.keys(updates).forEach(key => {
      if (key !== 'propertyUnits') {
        batch[key] = updates[key];
      }
    });
    
    if (updates.propertyUnits) {
      batch.propertyUnits = updates.propertyUnits;
    }
    
    // Update stats
    if (batch.propertyUnits && batch.propertyUnits.length > 0) {
      const propertyIds = batch.propertyUnits.map(p => p.propertyId);
      const properties = await PropertyUnit.find({ _id: { $in: propertyIds } })
        .select('unitTypes.price.amount propertyType');
      
      let totalPrice = 0;
      let minPrice = Infinity;
      let maxPrice = -Infinity;
      const propertyTypesSet = new Set();
      
      properties.forEach(property => {
        let price = 0;
        if (property.unitTypes && property.unitTypes.length > 0) {
          price = property.unitTypes[0].price?.amount || 0;
        }
        
        totalPrice += price;
        if (price < minPrice) minPrice = price;
        if (price > maxPrice) maxPrice = price;
        
        if (property.propertyType) {
          propertyTypesSet.add(property.propertyType);
        }
      });
      
      batch.stats = {
        ...batch.stats,
        avgPrice: batch.propertyUnits.length > 0 ? totalPrice / batch.propertyUnits.length : 0,
        minPrice: minPrice === Infinity ? 0 : minPrice,
        maxPrice: maxPrice === -Infinity ? 0 : maxPrice,
        propertyTypes: Array.from(propertyTypesSet),
        totalProperties: batch.propertyUnits.length
      };
    }
    
    batch.updatedAt = Date.now();
    await batch.save();
    
    await batch.populate('createdBy', 'name email username');
    await batch.populate('propertyUnits.propertyId', 'title propertyType city price images');
    
    console.log('=== BACKEND UPDATE SUCCESS ===');
    
    res.json({
      success: true,
      data: batch,
      message: 'Property batch updated successfully'
    });
  } catch (error) {
    console.error('Error updating batch:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating batch: ' + error.message
    });
  }
};

// @desc    Delete property batch
// @route   DELETE /api/property-batches/:id
// @access  Private/Admin only
exports.deleteBatch = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid batch ID'
      });
    }
    
    const batch = await PropertyBatch.findById(id);
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Property batch not found'
      });
    }
    
    const isAdminUser = req.user && (
      req.user?.isAdmin || 
      req.user?.userType === 'superadmin' || 
      req.user?.userType === 'admin'
    );
    
    if (!isAdminUser) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to delete this batch. Admin access required.'
      });
    }
    
    if (batch.image && batch.image.public_id) {
      try {
        await cloudinary.uploader.destroy(batch.image.public_id);
      } catch (cloudinaryError) {
        console.error('Error deleting image from Cloudinary:', cloudinaryError);
      }
    }
    
    await PropertyBatch.findByIdAndDelete(id);
    
    res.status(200).json({
      success: true,
      message: 'Property batch deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting batch:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting batch',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Add property unit to batch
// @route   POST /api/property-batches/:id/add-unit
// @access  Private/Admin only
exports.addPropertyUnit = async (req, res) => {
  try {
    const { id } = req.params;
    const { propertyUnitId, displayOrder } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(propertyUnitId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid batch ID or property unit ID'
      });
    }
    
    const batch = await PropertyBatch.findById(id);
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Property batch not found'
      });
    }
    
    const isAdminUser = req.user && (
      req.user?.isAdmin || 
      req.user?.userType === 'superadmin' || 
      req.user?.userType === 'admin'
    );
    
    if (!isAdminUser) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to modify this batch. Admin access required.'
      });
    }
    
    const propertyUnit = await PropertyUnit.findById(propertyUnitId);
    if (!propertyUnit) {
      return res.status(404).json({
        success: false,
        message: 'Property unit not found'
      });
    }
    
    const added = batch.addPropertyToBatch(propertyUnitId, displayOrder);
    if (!added) {
      return res.status(400).json({
        success: false,
        message: 'Property unit already exists in batch'
      });
    }
    
    // Update batch stats
    const propertyIds = batch.propertyUnits.map(p => p.propertyId);
    const properties = await PropertyUnit.find({ _id: { $in: propertyIds } })
      .select('unitTypes.price.amount propertyType');
    
    let totalPrice = 0;
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    const propertyTypesSet = new Set();
    
    properties.forEach(property => {
      let price = 0;
      if (property.unitTypes && property.unitTypes.length > 0) {
        price = property.unitTypes[0].price?.amount || 0;
      }
      
      totalPrice += price;
      if (price < minPrice) minPrice = price;
      if (price > maxPrice) maxPrice = price;
      
      if (property.propertyType) {
        propertyTypesSet.add(property.propertyType);
      }
    });
    
    batch.stats.avgPrice = batch.propertyUnits.length > 0 ? totalPrice / batch.propertyUnits.length : 0;
    batch.stats.minPrice = minPrice === Infinity ? 0 : minPrice;
    batch.stats.maxPrice = maxPrice === -Infinity ? 0 : maxPrice;
    batch.stats.propertyTypes = Array.from(propertyTypesSet);
    batch.stats.totalProperties = batch.propertyUnits.length;
    
    await batch.save();
    
    await batch.populate('propertyUnits.propertyId', 'title propertyType city price images');
    
    res.json({
      success: true,
      data: batch,
      message: 'Property unit added to batch successfully'
    });
  } catch (error) {
    console.error('Error adding property unit:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while adding property unit'
    });
  }
};

// @desc    Remove property unit from batch
// @route   POST /api/property-batches/:id/remove-unit
// @access  Private/Admin only
exports.removePropertyUnit = async (req, res) => {
  try {
    const { id } = req.params;
    const { propertyUnitId } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(propertyUnitId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid batch ID or property unit ID'
      });
    }
    
    const batch = await PropertyBatch.findById(id);
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Property batch not found'
      });
    }
    
    const isAdminUser = req.user && (
      req.user?.isAdmin || 
      req.user?.userType === 'superadmin' || 
      req.user?.userType === 'admin'
    );
    
    if (!isAdminUser) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to modify this batch. Admin access required.'
      });
    }
    
    const initialLength = batch.propertyUnits.length;
    batch.propertyUnits = batch.propertyUnits.filter(
      p => p.propertyId.toString() !== propertyUnitId.toString()
    );
    
    if (batch.propertyUnits.length === initialLength) {
      return res.status(400).json({
        success: false,
        message: 'Property unit not found in batch'
      });
    }
    
    // Update stats
    batch.stats.totalProperties = batch.propertyUnits.length;
    await batch.save();
    
    res.json({
      success: true,
      data: batch,
      message: 'Property unit removed from batch successfully'
    });
  } catch (error) {
    console.error('Error removing property unit:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while removing property unit'
    });
  }
};

// @desc    Reorder properties in batch
// @route   PUT /api/property-batches/:id/reorder-properties
// @access  Private/Admin only
exports.reorderProperties = async (req, res) => {
  try {
    const { id } = req.params;
    const { orderArray } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid batch ID'
      });
    }
    
    if (!orderArray || !Array.isArray(orderArray)) {
      return res.status(400).json({
        success: false,
        message: 'Order array is required'
      });
    }
    
    const batch = await PropertyBatch.findById(id);
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Property batch not found'
      });
    }
    
    const isAdminUser = req.user && (
      req.user?.isAdmin || 
      req.user?.userType === 'superadmin' || 
      req.user?.userType === 'admin'
    );
    
    if (!isAdminUser) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to modify this batch. Admin access required.'
      });
    }
    
    batch.reorderProperties(orderArray);
    await batch.save();
    
    res.json({
      success: true,
      data: batch,
      message: 'Properties reordered successfully'
    });
  } catch (error) {
    console.error('Error reordering properties:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while reordering properties'
    });
  }
};

// @desc    Update individual property display order
// @route   PATCH /api/property-batches/:id/update-property-order/:propertyId
// @access  Private/Admin only
exports.updatePropertyDisplayOrder = async (req, res) => {
  try {
    const { id, propertyId } = req.params;
    const { displayOrder } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(propertyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid batch ID or property ID'
      });
    }
    
    if (displayOrder === undefined || typeof displayOrder !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'Valid display order number is required'
      });
    }
    
    const batch = await PropertyBatch.findById(id);
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Property batch not found'
      });
    }
    
    const isAdminUser = req.user && (
      req.user?.isAdmin || 
      req.user?.userType === 'superadmin' || 
      req.user?.userType === 'admin'
    );
    
    if (!isAdminUser) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to modify this batch. Admin access required.'
      });
    }
    
    batch.updatePropertyDisplayOrder(propertyId, displayOrder);
    await batch.save();
    
    res.json({
      success: true,
      data: batch,
      message: 'Property display order updated successfully'
    });
  } catch (error) {
    console.error('Error updating property display order:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error while updating property display order'
    });
  }
};

// @desc    Set batch display order based on its type
// @route   PATCH /api/property-batches/:id/set-display-order
// @access  Private/Admin only
exports.setBatchDisplayOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { order } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid batch ID'
      });
    }
    
    if (order === undefined || typeof order !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'Valid order number is required'
      });
    }
    
    const batch = await PropertyBatch.findById(id);
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Property batch not found'
      });
    }
    
    const isAdminUser = req.user && (
      req.user?.isAdmin || 
      req.user?.userType === 'superadmin' || 
      req.user?.userType === 'admin'
    );
    
    if (!isAdminUser) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to modify this batch. Admin access required.'
      });
    }
    
    batch.setDisplayOrder(order);
    await batch.save();
    
    res.json({
      success: true,
      data: {
        batchId: batch._id,
        batchType: batch.batchType,
        displayOrder: batch.getDisplayOrder()
      },
      message: `Batch display order set to ${order} for type ${batch.batchType}`
    });
  } catch (error) {
    console.error('Error setting batch display order:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error while setting batch display order'
    });
  }
};

// @desc    Get batches ordered by specific type
// @route   GET /api/property-batches/type/:batchType/ordered
// @access  Public
exports.getBatchesOrderedByType = async (req, res) => {
  try {
    const { batchType } = req.params;
    const { limit } = req.query;
    
    const validBatchTypes = [
      "location_based",
      "project_group",
      "featured_listings",
      "similar_properties",
      "comparison_group"
    ];
    
    if (!validBatchTypes.includes(batchType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid batch type. Must be one of: ${validBatchTypes.join(', ')}`
      });
    }
    
    const batches = await PropertyBatch.getOrderedByType(batchType, limit ? parseInt(limit) : null);
    
    res.json({
      success: true,
      count: batches.length,
      data: batches
    });
  } catch (error) {
    console.error('Error fetching ordered batches:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching ordered batches'
    });
  }
};

// @desc    Get batch analytics
// @route   GET /api/property-batches/:id/analytics
// @access  Private/Admin only
exports.getBatchAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid batch ID'
      });
    }
    
    const batch = await PropertyBatch.findById(id);
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Property batch not found'
      });
    }
    
    const isAdminUser = req.user && (
      req.user?.isAdmin || 
      req.user?.userType === 'superadmin' || 
      req.user?.userType === 'admin'
    );
    
    if (!isAdminUser) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view analytics. Admin access required.'
      });
    }
    
    const analytics = batch.getAnalytics();
    
    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Error fetching batch analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching batch analytics'
    });
  }
};

// @desc    Record user view for property in batch
// @route   POST /api/property-batches/:id/record-view
// @access  Private
exports.recordUserView = async (req, res) => {
  try {
    const { id } = req.params;
    const { propertyId, duration, sessionId, source } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(propertyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid batch ID or property ID'
      });
    }
    
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }
    
    const batch = await PropertyBatch.findById(id);
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Property batch not found'
      });
    }
    
    const userData = {
      name: req.user.name || req.user.username,
      email: req.user.email,
      userType: req.user.userType || 'user',
      phoneNumber: req.user.phoneNumber
    };
    
    const result = await batch.recordUserView(
      propertyId,
      req.user._id,
      userData,
      { duration: duration || 0, sessionId, source }
    );
    
    res.json({
      success: true,
      data: result,
      message: 'User view recorded successfully'
    });
  } catch (error) {
    console.error('Error recording user view:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error while recording user view'
    });
  }
};

// @desc    Get batches by location
// @route   GET /api/property-batches/location/:location
// @access  Public
exports.getBatchesByLocation = async (req, res) => {
  try {
    const { location } = req.params;
    const { limit = 10 } = req.query;
    
    const batches = await PropertyBatch.find({
      locationName: new RegExp(location, 'i'),
      isActive: true
    })
    .populate('createdBy', 'name email')
    .populate({
      path: 'propertyUnits.propertyId',
      select: 'title price images city specifications.bedrooms',
      match: { approvalStatus: 'approved', availability: 'available' }
    })
    .limit(parseInt(limit))
    .sort({ [`displayOrders.${req.query.batchType || 'location_based'}_order`]: 1, createdAt: -1 });
    
    // Sort properties within each batch by displayOrder
    batches.forEach(batch => {
      if (batch.propertyUnits && batch.propertyUnits.length > 0) {
        batch.propertyUnits.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
      }
    });
    
    res.json({
      success: true,
      data: batches
    });
  } catch (error) {
    console.error('Error fetching batches by location:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching batches by location'
    });
  }
};

// @desc    Toggle batch active status
// @route   PATCH /api/property-batches/:id/toggle-active
// @access  Private/Admin only
exports.toggleActiveStatus = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid batch ID'
      });
    }
    
    const batch = await PropertyBatch.findById(id);
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Property batch not found'
      });
    }
    
    const isAdminUser = req.user && (
      req.user?.isAdmin || 
      req.user?.userType === 'superadmin' || 
      req.user?.userType === 'admin'
    );
    
    if (!isAdminUser) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to change batch status. Admin access required.'
      });
    }
    
    batch.isActive = !batch.isActive;
    await batch.save();
    
    res.json({
      success: true,
      data: batch,
      message: `Batch ${batch.isActive ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    console.error('Error toggling batch status:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while toggling batch status'
    });
  }
};