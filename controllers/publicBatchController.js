// controllers/projectBatchController.js
const PropertyBatch = require('../models/PropertyBatch');
const mongoose = require('mongoose');

// @desc    Get all project batches ordered by display order with pagination
// @route   GET /api/batches/project
// @access  Public
exports.getProjectBatches = async (req, res) => {
  try {
    const { 
      limit = 6, 
      page = 1,
      sortBy = 'displayOrder',
      sortOrder = 'asc'
    } = req.query;
    
    // Convert to numbers
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;
    
    // Build query
    let query = PropertyBatch.find({ 
      batchType: 'project_group', 
      isActive: true 
    });
    
    // Get total count for pagination
    const totalCount = await PropertyBatch.countDocuments({
      batchType: 'project_group',
      isActive: true
    });
    
    // Apply sorting
    let sortOptions = {};
    if (sortBy === 'displayOrder') {
      sortOptions = { 'displayOrders.project_group_order': sortOrder === 'asc' ? 1 : -1 };
    } else if (sortBy === 'createdAt') {
      sortOptions = { createdAt: sortOrder === 'asc' ? 1 : -1 };
    } else if (sortBy === 'batchName') {
      sortOptions = { batchName: sortOrder === 'asc' ? 1 : -1 };
    } else if (sortBy === 'propertyCount') {
      sortOptions = { 'stats.totalProperties': sortOrder === 'asc' ? 1 : -1 };
    } else {
      sortOptions = { 'displayOrders.project_group_order': 1 };
    }
    
    // Add secondary sort for consistency
    if (sortBy !== 'createdAt') {
      sortOptions.createdAt = -1;
    }
    
    // Execute query with pagination
    const batches = await query
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum)
      .populate('propertyUnits.propertyId', 'title images city price propertyType specifications')
      .select('-createdBy -__v');
    
    // Add rank to each batch based on global position
    const batchesWithRank = batches.map((batch, index) => {
      const batchObj = batch.toObject();
      const globalRank = skip + index + 1;
      batchObj.rank = globalRank;
      batchObj.displayOrder = batch.displayOrders.project_group_order;
      return batchObj;
    });
    
    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;
    
    res.json({
      success: true,
      data: batchesWithRank,
      pagination: {
        currentPage: pageNum,
        totalPages: totalPages,
        totalItems: totalCount,
        itemsPerPage: limitNum,
        hasNextPage: hasNextPage,
        hasPrevPage: hasPrevPage,
        startIndex: skip + 1,
        endIndex: Math.min(skip + limitNum, totalCount)
      },
      filters: {
        sortBy,
        sortOrder
      }
    });
  } catch (error) {
    console.error('Error getting project batches:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching project batches',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get single project batch by ID
// @route   GET /api/batches/project/:id
// @access  Public
exports.getProjectBatchById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid batch ID'
      });
    }
    
    const batch = await PropertyBatch.findOne({
      _id: id,
      batchType: 'project_group',
      isActive: true
    })
    .populate('propertyUnits.propertyId', 'title images city price propertyType specifications amenities')
    .select('-createdBy -__v');
    
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Project batch not found'
      });
    }
    
    // Get rank position among all active project batches
    const allProjectBatches = await PropertyBatch.find({
      batchType: 'project_group',
      isActive: true
    }).sort({ 'displayOrders.project_group_order': 1 });
    
    const rank = allProjectBatches.findIndex(b => b._id.toString() === id) + 1;
    
    const batchObj = batch.toObject();
    batchObj.rank = rank;
    batchObj.totalProjectBatches = allProjectBatches.length;
    batchObj.displayOrder = batch.displayOrders.project_group_order;
    
    res.json({
      success: true,
      data: batchObj
    });
  } catch (error) {
    console.error('Error getting project batch:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching project batch',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get featured project batches (top N)
// @route   GET /api/batches/project/featured
// @access  Public
exports.getFeaturedProjectBatches = async (req, res) => {
  try {
    const { limit = 3 } = req.query;
    
    const batches = await PropertyBatch.find({ 
      batchType: 'project_group', 
      isActive: true 
    })
    .sort({ 'displayOrders.project_group_order': 1 })
    .limit(parseInt(limit))
    .populate('propertyUnits.propertyId', 'title images city price')
    .select('-createdBy -__v');
    
    const batchesWithRank = batches.map((batch, index) => {
      const batchObj = batch.toObject();
      batchObj.rank = index + 1;
      return batchObj;
    });
    
    res.json({
      success: true,
      count: batchesWithRank.length,
      data: batchesWithRank
    });
  } catch (error) {
    console.error('Error getting featured project batches:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching featured project batches'
    });
  }
};

// @desc    Get project batches with advanced filtering
// @route   GET /api/batches/project/filter
// @access  Public
exports.filterProjectBatches = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 6,
      search = '',
      location = '',
      minProperties = 0,
      maxProperties = null,
      sortBy = 'displayOrder',
      sortOrder = 'asc'
    } = req.query;
    
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;
    
    // Build filter query
    let filterQuery = {
      batchType: 'project_group',
      isActive: true
    };
    
    // Search by name or description
    if (search) {
      filterQuery.$or = [
        { batchName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { locationName: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Filter by location
    if (location) {
      filterQuery.locationName = { $regex: location, $options: 'i' };
    }
    
    // Filter by property count range
    if (minProperties) {
      filterQuery['stats.totalProperties'] = { $gte: parseInt(minProperties) };
    }
    if (maxProperties) {
      filterQuery['stats.totalProperties'] = { 
        ...filterQuery['stats.totalProperties'],
        $lte: parseInt(maxProperties)
      };
    }
    
    // Get total count for pagination
    const totalCount = await PropertyBatch.countDocuments(filterQuery);
    
    // Build sort options
    let sortOptions = {};
    if (sortBy === 'displayOrder') {
      sortOptions = { 'displayOrders.project_group_order': sortOrder === 'asc' ? 1 : -1 };
    } else if (sortBy === 'createdAt') {
      sortOptions = { createdAt: sortOrder === 'asc' ? 1 : -1 };
    } else if (sortBy === 'batchName') {
      sortOptions = { batchName: sortOrder === 'asc' ? 1 : -1 };
    } else if (sortBy === 'propertyCount') {
      sortOptions = { 'stats.totalProperties': sortOrder === 'asc' ? 1 : -1 };
    } else {
      sortOptions = { 'displayOrders.project_group_order': 1 };
    }
    
    // Execute query
    const batches = await PropertyBatch.find(filterQuery)
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum)
      .populate('propertyUnits.propertyId', 'title images city price')
      .select('-createdBy -__v');
    
    // Add rank
    const batchesWithRank = batches.map((batch, index) => {
      const batchObj = batch.toObject();
      batchObj.rank = skip + index + 1;
      batchObj.displayOrder = batch.displayOrders.project_group_order;
      return batchObj;
    });
    
    const totalPages = Math.ceil(totalCount / limitNum);
    
    res.json({
      success: true,
      data: batchesWithRank,
      pagination: {
        currentPage: pageNum,
        totalPages: totalPages,
        totalItems: totalCount,
        itemsPerPage: limitNum,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      },
      filters: {
        search,
        location,
        minProperties,
        maxProperties,
        sortBy,
        sortOrder
      }
    });
  } catch (error) {
    console.error('Error filtering project batches:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while filtering project batches'
    });
  }
};