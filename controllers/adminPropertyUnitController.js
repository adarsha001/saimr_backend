const PropertyUnit = require("../models/PropertyUnit");
const User = require("../models/user");
const cloudinary = require("../config/cloudinary");
const mongoose = require('mongoose');

// ✅ Get all property units (Admin only)
const getAllPropertyUnits = async (req, res) => {
  try {
    const {
      search,
      city,
      propertyType,
      approvalStatus,
      isFeatured,
      isVerified,
      availability,
      listingType,
      createdBy,
      unitType, // Added for filtering by unit type
      furnishing, // Added for filtering by furnishing status
      possessionStatus, // Added for filtering by possession status
      minPrice, // Added for price range filtering
      maxPrice,
      page = 1,
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter
    const filter = {};

    // Search filter
if (search && search.trim() !== '') {
  const searchRegex = new RegExp(search.trim(), 'i');
  filter.$or = [
    { title: searchRegex },
    { description: searchRegex },
    { address: searchRegex },
    { city: searchRegex },
    { locality: searchRegex },
    { state: searchRegex },
    { pincode: searchRegex },
    { 'buildingDetails.name': searchRegex },
    { 'buildingDetails.address': searchRegex },
    { 'buildingDetails.locality': searchRegex },
    { slug: searchRegex },
    { complexName: searchRegex },
    { buildingName: searchRegex },
    { landmark: searchRegex },
    { nearbyLandmarks: searchRegex }
  ];
}
    // Apply filters
    if (city && city.trim() !== '') {
      filter.city = new RegExp(city.trim(), 'i');
    }
    
    if (propertyType && propertyType.trim() !== '') {
      filter.propertyType = propertyType.trim();
    }
    
    if (approvalStatus && approvalStatus.trim() !== '') {
      filter.approvalStatus = approvalStatus.trim();
    }
    
    if (isFeatured !== undefined && isFeatured !== '') {
      filter.isFeatured = isFeatured === 'true';
    }
    
    if (isVerified !== undefined && isVerified !== '') {
      filter.isVerified = isVerified === 'true';
    }
    
    if (availability && availability.trim() !== '') {
      filter.availability = availability.trim();
    }
    
    if (listingType && listingType.trim() !== '') {
      filter.listingType = listingType.trim();
    }
    
    if (createdBy && createdBy.trim() !== '') {
      filter.createdBy = createdBy.trim();
    }

    // Filter by unit type (nested in unitTypes array)
    if (unitType && unitType.trim() !== '') {
      filter['unitTypes.type'] = unitType.trim();
    }

    // Filter by furnishing status
    if (furnishing && furnishing.trim() !== '') {
      filter['commonSpecifications.furnishing'] = furnishing.trim();
    }

    // Filter by possession status
    if (possessionStatus && possessionStatus.trim() !== '') {
      filter['commonSpecifications.possessionStatus'] = possessionStatus.trim();
    }

    // Price range filter (using unitTypes price)
    if (minPrice || maxPrice) {
      filter['unitTypes.price.amount'] = {};
      if (minPrice) filter['unitTypes.price.amount'].$gte = parseFloat(minPrice);
      if (maxPrice) filter['unitTypes.price.amount'].$lte = parseFloat(maxPrice);
    }

    // Calculate pagination
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(Math.max(1, parseInt(limit) || 50), 200);
    const skip = (pageNum - 1) * limitNum;

    // Build sort object
    let sort = {};
    
    const allowedSortFields = {
      'createdAt': 'createdAt',
      'updatedAt': 'updatedAt',
      'title': 'title',
      'city': 'city',
      'price': 'price',
      'displayOrder': 'displayOrder',
      'viewCount': 'viewCount',
      'approvalStatus': 'approvalStatus',
      'isFeatured': 'isFeatured',
      'isVerified': 'isVerified',
      'likes': 'likes',
      'inquiryCount': 'inquiryCount',
      'favoriteCount': 'favoriteCount'
    };

    const sortField = allowedSortFields[sortBy] || 'createdAt';
    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    
    sort[sortField] = sortDirection;

    // Execute query
    const query = PropertyUnit.find(filter);
    
    if (Object.keys(sort).length > 0) {
      query.sort(sort);
    }
    
    const propertyUnits = await query
      .skip(skip)
      .limit(limitNum)
      .populate('createdBy', 'name email phoneNumber avatar userType')
      .lean();

    // Get total count
    const total = await PropertyUnit.countDocuments(filter);

    // Get stats for filters
    const cities = await PropertyUnit.distinct('city').sort();
    const propertyTypes = await PropertyUnit.distinct('propertyType').sort();
    const approvalStatuses = await PropertyUnit.distinct('approvalStatus').sort();
    const unitTypes = await PropertyUnit.distinct('unitTypes.type').sort();
    const furnishingOptions = ['unfurnished', 'semi-furnished', 'fully-furnished'];
    const possessionStatuses = ['ready-to-move', 'under-construction', 'resale'];

    res.status(200).json({
      success: true,
      count: propertyUnits.length,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      data: propertyUnits,
      filters: {
        cities,
        propertyTypes,
        approvalStatuses,
        unitTypes,
        furnishingOptions,
        possessionStatuses
      }
    });

  } catch (error) {
    console.error('Get all property units error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching property units',
      error: error.message
    });
  }
};

// ✅ Get property unit by ID (Admin)
const getPropertyUnitByIdAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid property unit ID"
      });
    }

    const propertyUnit = await PropertyUnit.findById(id)
      .populate('createdBy', 'name email phoneNumber avatar userType')
      .lean();

    if (!propertyUnit) {
      return res.status(404).json({
        success: false,
        message: "Property unit not found"
      });
    }

    res.status(200).json({
      success: true,
      data: propertyUnit
    });

  } catch (error) {
    console.error('Get property unit by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching property unit',
      error: error.message
    });
  }
};

// ✅ Get property unit stats
const getPropertyUnitStats = async (req, res) => {
  try {
    const total = await PropertyUnit.countDocuments({});
    const approved = await PropertyUnit.countDocuments({ approvalStatus: 'approved' });
    const pending = await PropertyUnit.countDocuments({ approvalStatus: 'pending' });
    const rejected = await PropertyUnit.countDocuments({ approvalStatus: 'rejected' });
    const featured = await PropertyUnit.countDocuments({ isFeatured: true });
    const verified = await PropertyUnit.countDocuments({ isVerified: true });
    
    // Count by property type
    const propertyTypeStats = await PropertyUnit.aggregate([
      { $group: { _id: '$propertyType', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    // Count by city
    const cityStats = await PropertyUnit.aggregate([
      { $match: { city: { $ne: null, $ne: '' } } },
      { $group: { _id: '$city', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Count by unit type (unwind the unitTypes array)
    const unitTypeStats = await PropertyUnit.aggregate([
      { $unwind: '$unitTypes' },
      { $group: { _id: '$unitTypes.type', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Count by furnishing status
    const furnishingStats = await PropertyUnit.aggregate([
      { $group: { _id: '$commonSpecifications.furnishing', count: { $sum: 1 } } }
    ]);

    // Count by possession status
    const possessionStats = await PropertyUnit.aggregate([
      { $group: { _id: '$commonSpecifications.possessionStatus', count: { $sum: 1 } } }
    ]);

    // Count by listing type
    const listingTypeStats = await PropertyUnit.aggregate([
      { $group: { _id: '$listingType', count: { $sum: 1 } } }
    ]);

    // RERA registered count
    const reraRegistered = await PropertyUnit.countDocuments({
      'legalDetails.reraRegistered': true
    });

    // Recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentAdded = await PropertyUnit.countDocuments({
      createdAt: { $gte: sevenDaysAgo }
    });

    // Total views, inquiries, favorites
    const totalStats = await PropertyUnit.aggregate([
      {
        $group: {
          _id: null,
          totalViews: { $sum: '$viewCount' },
          totalInquiries: { $sum: '$inquiryCount' },
          totalFavorites: { $sum: '$favoriteCount' },
          totalLikes: { $sum: '$likes' }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        total,
        approved,
        pending,
        rejected,
        featured,
        verified,
        reraRegistered,
        propertyTypeStats,
        cityStats,
        unitTypeStats,
        furnishingStats,
        possessionStats,
        listingTypeStats,
        recentAdded,
        totalStats: totalStats[0] || {
          totalViews: 0,
          totalInquiries: 0,
          totalFavorites: 0,
          totalLikes: 0
        }
      }
    });

  } catch (error) {
    console.error('Get property unit stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching stats',
      error: error.message
    });
  }
};

// ✅ Create property unit (Admin)
const createPropertyUnitAdmin = async (req, res) => {
  try {
    const { ...data } = req.body;
    
    // Validate unitTypes data
    if (data.unitTypes && Array.isArray(data.unitTypes)) {
      data.unitTypes = data.unitTypes.map(unit => ({
        ...unit,
        // Ensure price object structure
        price: {
          amount: unit.price?.amount || unit.price,
          currency: unit.price?.currency || 'INR',
          perUnit: unit.price?.perUnit || 'total'
        }
      }));
    }

    // Admin can set all fields directly
    const propertyUnit = new PropertyUnit({
      ...data,
      createdBy: req.user._id
    });

    await propertyUnit.save();

    res.status(201).json({
      success: true,
      message: 'Property unit created successfully',
      data: propertyUnit
    });

  } catch (error) {
    console.error('Create property unit admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating property unit',
      error: error.message
    });
  }
};

// ✅ Update property unit (Admin)
// In your backend routes file (e.g., propertyUnitRoutes.js or similar)

const updatePropertyUnitAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Parse data if it comes as JSON string in FormData
    let updateData = req.body;
    if (req.body.data) {
      try {
        updateData = JSON.parse(req.body.data);
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: 'Invalid JSON data format'
        });
      }
    }

    // Validate ID
    if (!id || id === 'undefined') {
      return res.status(400).json({
        success: false,
        message: 'Invalid property unit ID'
      });
    }

    // Find existing property unit
    const existingPropertyUnit = await PropertyUnit.findById(id);
    if (!existingPropertyUnit) {
      return res.status(404).json({
        success: false,
        message: 'Property unit not found'
      });
    }

    // Prepare update data
    const preparedData = {};

    // Basic fields
    const basicFields = [
      'title', 'description', 'city', 'address', 'mapUrl', 'locationNearby',
      'propertyType', 'listingType', 'availability', 'isFeatured', 'isVerified',
      'approvalStatus', 'rejectionReason', 'contactPreference', 'viewingSchedule',
      'displayOrder', 'unitFeatures'
    ];

    basicFields.forEach(field => {
      if (updateData[field] !== undefined) {
        preparedData[field] = updateData[field];
      }
    });
    
    // Handle images
    if (updateData.images !== undefined) {
      preparedData.images = updateData.images;
    }
    
    // Handle unitTypes
    if (updateData.unitTypes && Array.isArray(updateData.unitTypes)) {
      preparedData.unitTypes = updateData.unitTypes.map(unit => {
        const unitData = {
          type: unit.type,
          price: {
            amount: unit.price?.amount ? Number(unit.price.amount) : 0,
            currency: unit.price?.currency || 'INR',
            perUnit: unit.price?.perUnit || 'total'
          },
          carpetArea: unit.carpetArea ? Number(unit.carpetArea) : 0,
          builtUpArea: unit.builtUpArea ? Number(unit.builtUpArea) : 0,
          superBuiltUpArea: unit.superBuiltUpArea ? Number(unit.superBuiltUpArea) : 0,
          availability: unit.availability || 'available',
          totalUnits: unit.totalUnits ? Number(unit.totalUnits) : 0,
          availableUnits: unit.availableUnits ? Number(unit.availableUnits) : 0
        };
        
        // Handle plot details
        if (unit.type === 'Plot' && unit.plotDetails) {
          unitData.plotDetails = {
            dimensions: {
              length: Number(unit.plotDetails.dimensions?.length) || 0,
              breadth: Number(unit.plotDetails.dimensions?.breadth) || 0,
              frontage: Number(unit.plotDetails.dimensions?.frontage) || 0
            },
            area: {
              sqft: Number(unit.plotDetails.area?.sqft) || Number(unit.carpetArea) || 0,
              sqYards: Number(unit.plotDetails.area?.sqYards) || 0,
              grounds: Number(unit.plotDetails.area?.grounds) || 0,
              acres: Number(unit.plotDetails.area?.acres) || 0,
              cents: Number(unit.plotDetails.area?.cents) || 0
            },
            shape: unit.plotDetails.shape || 'rectangle',
            facing: unit.plotDetails.facing || null,
            isCornerPlot: unit.plotDetails.isCornerPlot || false,
            cornerRoads: unit.plotDetails.cornerRoads || [],
            roadWidth: Number(unit.plotDetails.roadWidth) || 0,
            roadType: unit.plotDetails.roadType || 'secondary',
            boundaryWalls: unit.plotDetails.boundaryWalls || false,
            fencing: unit.plotDetails.fencing || false,
            gate: unit.plotDetails.gate || false,
            elevationAvailable: unit.plotDetails.elevationAvailable || false,
            soilType: unit.plotDetails.soilType || null,
            landUse: unit.plotDetails.landUse || 'residential',
            developmentStatus: unit.plotDetails.developmentStatus || 'developed',
            amenities: unit.plotDetails.amenities || [],
            utilities: {
              electricity: unit.plotDetails.utilities?.electricity || false,
              waterConnection: unit.plotDetails.utilities?.waterConnection || false,
              sewageConnection: unit.plotDetails.utilities?.sewageConnection || false,
              gasConnection: unit.plotDetails.utilities?.gasConnection || false,
              internetFiber: unit.plotDetails.utilities?.internetFiber || false
            },
            approvalDetails: {
              dtcpApproved: unit.plotDetails.approvalDetails?.dtcpApproved || false,
              dtcpNumber: unit.plotDetails.approvalDetails?.dtcpNumber || '',
              layoutApproved: unit.plotDetails.approvalDetails?.layoutApproved || false,
              layoutNumber: unit.plotDetails.approvalDetails?.layoutNumber || '',
              surveyNumber: unit.plotDetails.approvalDetails?.surveyNumber || '',
              pattaNumber: unit.plotDetails.approvalDetails?.pattaNumber || '',
              subdivisionApproved: unit.plotDetails.approvalDetails?.subdivisionApproved || false
            }
          };
          
          // Remove null values
          if (unitData.plotDetails.facing === null) delete unitData.plotDetails.facing;
          if (unitData.plotDetails.soilType === null) delete unitData.plotDetails.soilType;
        }
        
        return unitData;
      });
    }

    // Handle buildingDetails
    if (updateData.buildingDetails) {
      preparedData.buildingDetails = {
        name: updateData.buildingDetails.name || '',
        totalFloors: Number(updateData.buildingDetails.totalFloors) || 0,
        totalUnits: Number(updateData.buildingDetails.totalUnits) || 0,
        yearBuilt: Number(updateData.buildingDetails.yearBuilt) || 0,
        amenities: updateData.buildingDetails.amenities || []
      };
    }

    // Handle commonSpecifications
    if (updateData.commonSpecifications) {
      preparedData.commonSpecifications = {
        furnishing: updateData.commonSpecifications.furnishing || 'unfurnished',
        possessionStatus: updateData.commonSpecifications.possessionStatus || 'ready-to-move',
        ageOfProperty: Number(updateData.commonSpecifications.ageOfProperty) || 0,
        parking: {
          covered: Number(updateData.commonSpecifications.parking?.covered) || 0,
          open: Number(updateData.commonSpecifications.parking?.open) || 0
        },
        kitchenType: updateData.commonSpecifications.kitchenType || 'regular'
      };
    }

    // Handle ownerDetails
    if (updateData.ownerDetails) {
      preparedData.ownerDetails = {
        name: updateData.ownerDetails.name || '',
        phoneNumber: updateData.ownerDetails.phoneNumber || '',
        email: updateData.ownerDetails.email || '',
        reasonForSelling: updateData.ownerDetails.reasonForSelling || ''
      };
    }

    // Handle legalDetails
    if (updateData.legalDetails) {
      preparedData.legalDetails = {
        reraRegistered: updateData.legalDetails.reraRegistered || false,
        reraNumber: updateData.legalDetails.reraNumber || '',
        reraWebsiteLink: updateData.legalDetails.reraWebsiteLink || '',
        sanctioningAuthority: updateData.legalDetails.sanctioningAuthority || '',
        sanctionNumber: updateData.legalDetails.sanctionNumber || '',
        sanctionDate: updateData.legalDetails.sanctionDate || null,
        occupancyCertificate: updateData.legalDetails.occupancyCertificate || false,
        occupancyCertificateNumber: updateData.legalDetails.occupancyCertificateNumber || '',
        occupancyCertificateDate: updateData.legalDetails.occupancyCertificateDate || null,
        commencementCertificate: updateData.legalDetails.commencementCertificate || false,
        commencementCertificateNumber: updateData.legalDetails.commencementCertificateNumber || '',
        commencementCertificateDate: updateData.legalDetails.commencementCertificateDate || null,
        khataStatus: updateData.legalDetails.khataStatus || 'Not Applicable',
        clearTitle: updateData.legalDetails.clearTitle || false,
        motherDeedAvailable: updateData.legalDetails.motherDeedAvailable || false,
        conversionCertificate: updateData.legalDetails.conversionCertificate || false,
        conversionType: updateData.legalDetails.conversionType || '',
        encumbranceCertificate: updateData.legalDetails.encumbranceCertificate || false,
        encumbranceYears: Number(updateData.legalDetails.encumbranceYears) || 0,
        ownershipType: updateData.legalDetails.ownershipType || 'freehold',
        bankApprovals: updateData.legalDetails.bankApprovals || [],
        legalStatusSummary: updateData.legalDetails.legalStatusSummary || '',
        legalVerified: updateData.legalDetails.legalVerified || false,
        legalVerificationDate: updateData.legalDetails.legalVerificationDate || null,
        legalVerifier: updateData.legalDetails.legalVerifier || ''
      };
    }

    // Handle viewing schedule
    if (updateData.viewingSchedule && Array.isArray(updateData.viewingSchedule)) {
      preparedData.viewingSchedule = updateData.viewingSchedule.map(slot => ({
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        slotsAvailable: Number(slot.slotsAvailable) || 1
      }));
    }

    // Handle contact preference
    if (updateData.contactPreference && Array.isArray(updateData.contactPreference)) {
      preparedData.contactPreference = updateData.contactPreference;
    }

    // Handle new image uploads
    if (req.files && req.files.length > 0) {
      const cloudinary = require('cloudinary').v2;
      const newImages = [];
      
      for (let file of req.files) {
        try {
          const result = await cloudinary.uploader.upload(file.path, {
            folder: "property-units",
          });
          
          newImages.push({
            url: result.secure_url,
            public_id: result.public_id,
            caption: ""
          });
        } catch (uploadError) {
          console.error('Cloudinary upload error:', uploadError);
        }
      }
      
      const existingImages = preparedData.images || existingPropertyUnit.images || [];
      preparedData.images = [...existingImages, ...newImages];
    }

    // Remove undefined fields
    Object.keys(preparedData).forEach(key => {
      if (preparedData[key] === undefined) {
        delete preparedData[key];
      }
    });

    // Update the property unit
    const propertyUnit = await PropertyUnit.findByIdAndUpdate(
      id,
      preparedData,
      { 
        new: true, 
        runValidators: false
      }
    ).populate('createdBy', 'name email phoneNumber');
    
    if (!propertyUnit) {
      return res.status(404).json({
        success: false,
        message: 'Property unit not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Property unit updated successfully',
      data: propertyUnit
    });
    
  } catch (error) {
    console.error('Update error:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error updating property unit',
      error: error.message
    });
  }
};

// ✅ Delete property unit (Admin)
const deletePropertyUnitAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const propertyUnit = await PropertyUnit.findById(id);
    if (!propertyUnit) {
      return res.status(404).json({
        success: false,
        message: 'Property unit not found'
      });
    }

    // Delete images from Cloudinary
    if (propertyUnit.images && propertyUnit.images.length > 0) {
      for (const image of propertyUnit.images) {
        if (image.public_id) {
          try {
            await cloudinary.uploader.destroy(image.public_id);
          } catch (cloudinaryError) {
            console.error('Error deleting image from Cloudinary:', cloudinaryError);
          }
        }
      }
    }

    await PropertyUnit.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Property unit deleted successfully'
    });

  } catch (error) {
    console.error('Delete property unit admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting property unit',
      error: error.message
    });
  }
};

// ✅ Update approval status
const updateApprovalStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { approvalStatus, rejectionReason } = req.body;

    if (!['pending', 'approved', 'rejected'].includes(approvalStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid approval status'
      });
    }

    const updateData = { approvalStatus };
    
    if (approvalStatus === 'rejected' && rejectionReason) {
      updateData.rejectionReason = rejectionReason;
    } else if (approvalStatus !== 'rejected') {
      updateData.rejectionReason = '';
    }

    const propertyUnit = await PropertyUnit.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    if (!propertyUnit) {
      return res.status(404).json({
        success: false,
        message: 'Property unit not found'
      });
    }

    res.status(200).json({
      success: true,
      message: `Property unit ${approvalStatus} successfully`,
      data: propertyUnit
    });

  } catch (error) {
    console.error('Update approval status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating approval status',
      error: error.message
    });
  }
};

// ✅ Toggle featured
const toggleFeatured = async (req, res) => {
  try {
    const { id } = req.params;
    
    const propertyUnit = await PropertyUnit.findById(id);
    if (!propertyUnit) {
      return res.status(404).json({
        success: false,
        message: 'Property unit not found'
      });
    }

    propertyUnit.isFeatured = !propertyUnit.isFeatured;
    await propertyUnit.save();

    res.status(200).json({
      success: true,
      message: `Property unit ${propertyUnit.isFeatured ? 'featured' : 'unfeatured'} successfully`,
      data: propertyUnit
    });

  } catch (error) {
    console.error('Toggle featured error:', error);
    res.status(500).json({
      success: false,
      message: 'Error toggling featured status',
      error: error.message
    });
  }
};

// ✅ Toggle verified
const toggleVerified = async (req, res) => {
  try {
    const { id } = req.params;
    
    const propertyUnit = await PropertyUnit.findById(id);
    if (!propertyUnit) {
      return res.status(404).json({
        success: false,
        message: 'Property unit not found'
      });
    }

    propertyUnit.isVerified = !propertyUnit.isVerified;
    await propertyUnit.save();

    res.status(200).json({
      success: true,
      message: `Property unit ${propertyUnit.isVerified ? 'verified' : 'unverified'} successfully`,
      data: propertyUnit
    });

  } catch (error) {
    console.error('Toggle verified error:', error);
    res.status(500).json({
      success: false,
      message: 'Error toggling verified status',
      error: error.message
    });
  }
};

// ✅ Bulk update property units
const bulkUpdatePropertyUnits = async (req, res) => {
  try {
    const { ids, ...updateData } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Property IDs array is required'
      });
    }

    const updates = ids.map(id => ({
      updateOne: {
        filter: { _id: id },
        update: { $set: updateData }
      }
    }));

    const result = await PropertyUnit.bulkWrite(updates);

    res.status(200).json({
      success: true,
      message: `Updated ${result.modifiedCount} properties`,
      modifiedCount: result.modifiedCount
    });

  } catch (error) {
    console.error('Bulk update error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating properties',
      error: error.message
    });
  }
};

// ✅ Bulk delete property units
const bulkDeletePropertyUnits = async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Property IDs array is required'
      });
    }

    // Get properties to delete images from Cloudinary
    const properties = await PropertyUnit.find({ _id: { $in: ids } });
    
    // Delete images from Cloudinary
    for (const property of properties) {
      if (property.images && property.images.length > 0) {
        for (const image of property.images) {
          if (image.public_id) {
            try {
              await cloudinary.uploader.destroy(image.public_id);
            } catch (cloudinaryError) {
              console.error('Error deleting image from Cloudinary:', cloudinaryError);
            }
          }
        }
      }
    }

    const result = await PropertyUnit.deleteMany({ _id: { $in: ids } });

    res.status(200).json({
      success: true,
      message: `Deleted ${result.deletedCount} properties`,
      deletedCount: result.deletedCount
    });

  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting properties',
      error: error.message
    });
  }
};

// ✅ Update display orders
const updateDisplayOrders = async (req, res) => {
  try {
    const { displayOrders } = req.body;
    
    if (!Array.isArray(displayOrders) || displayOrders.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Display orders array is required'
      });
    }

    const updates = displayOrders.map(order => ({
      updateOne: {
        filter: { _id: order.id },
        update: { $set: { displayOrder: order.displayOrder } }
      }
    }));

    const result = await PropertyUnit.bulkWrite(updates);

    res.status(200).json({
      success: true,
      message: `Display orders updated for ${result.modifiedCount} properties`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Update display orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating display orders',
      error: error.message
    });
  }
};

// ✅ Update single display order
const updateSingleDisplayOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { displayOrder } = req.body;

    if (displayOrder === undefined || displayOrder === null) {
      return res.status(400).json({
        success: false,
        message: 'Display order is required'
      });
    }

    const propertyUnit = await PropertyUnit.findByIdAndUpdate(
      id,
      { displayOrder: parseInt(displayOrder) },
      { new: true }
    );

    if (!propertyUnit) {
      return res.status(404).json({
        success: false,
        message: 'Property unit not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Display order updated successfully',
      data: propertyUnit
    });
  } catch (error) {
    console.error('Update single display order error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating display order',
      error: error.message
    });
  }
};

module.exports = {
  getAllPropertyUnits,
  getPropertyUnitByIdAdmin,
  createPropertyUnitAdmin,
  updatePropertyUnitAdmin,
  deletePropertyUnitAdmin,
  updateApprovalStatus,
  toggleFeatured,
  toggleVerified,
  getPropertyUnitStats,
  bulkUpdatePropertyUnits,
  bulkDeletePropertyUnits,
  updateDisplayOrders,
  updateSingleDisplayOrder
};