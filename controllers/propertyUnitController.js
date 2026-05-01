const PropertyUnit = require("../models/PropertyUnit");
const User = require("../models/user");
const cloudinary = require("../config/cloudinary");
const mongoose = require('mongoose');

// Create property unit (Public)
const createPropertyUnit = async (req, res) => {
  try {
    console.log('User making request:', req.user);
    
    // Check if user is authenticated
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated. Please login to add property unit.'
      });
    }

    // Extract all fields from request body
    const {
      title,
      description,
      city,
      address,
      mapUrl,
      propertyType,
      unitTypes,
      buildingDetails,
      unitFeatures,
      commonSpecifications,
      approvalStatus,
      isFeatured,
      isVerified,
      availability,
      listingType,
      locationNearby,
      ownerDetails,
      legalDetails,
      contactPreference,
      displayOrder,
      rejectionReason,
    } = req.body;

    // Check required fields
    if (!title || !city || !address || !propertyType) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: title, city, address, propertyType'
      });
    }

    // Validate property type
    const validPropertyTypes = [
      "Apartment",
      "Villa",
      "Independent House",
      "Studio",
      "Penthouse",
      "Duplex",
      "Pg house",
      "Plot",
      "Commercial Space"
    ];
    
    if (!validPropertyTypes.includes(propertyType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid property type. Must be one of: ${validPropertyTypes.join(', ')}`
      });
    }

    // Validate listing type
    const validListingTypes = ["sale", "rent", "lease", "pg"];
    const finalListingType = listingType && validListingTypes.includes(listingType) ? listingType : "sale";

    // Validate availability
    const validAvailability = ["available", "sold", "rented", "under-agreement", "hold"];
    const finalAvailability = availability && validAvailability.includes(availability) ? availability : "available";

    // Parse and validate unitTypes
    let parsedUnitTypes = [];
    try {
      parsedUnitTypes = unitTypes ? JSON.parse(unitTypes) : [];
      
      // Validate at least one unit type
      if (parsedUnitTypes.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one unit type is required'
        });
      }
      
      const validUnitTypes = ["1BHK", "2BHK", "3BHK", "4BHK", "5BHK", "Studio", "Penthouse", "Duplex", "Plot"];
      const validAvailabilityOptions = ["available", "sold", "limited", "coming-soon", "booked", "reserved"];
      
      for (const unit of parsedUnitTypes) {
        // Validate unit type
        if (!unit.type || !validUnitTypes.includes(unit.type)) {
          return res.status(400).json({
            success: false,
            message: `Invalid unit type. Must be one of: ${validUnitTypes.join(', ')}`
          });
        }
        
        // Validate price
        if (!unit.price || !unit.price.amount) {
          return res.status(400).json({
            success: false,
            message: `Price amount is required for ${unit.type}`
          });
        }
        
        // Set default price currency and perUnit if not provided
        unit.price.currency = unit.price.currency || "INR";
        unit.price.perUnit = unit.price.perUnit || "total";
        
        // Validate price.perUnit for plots
        if (unit.type === 'Plot') {
          const validPlotPriceUnits = ["total", "sqft", "sqm", "perSqYard", "perGround"];
          if (unit.price.perUnit && !validPlotPriceUnits.includes(unit.price.perUnit)) {
            return res.status(400).json({
              success: false,
              message: `For plots, price.perUnit must be one of: ${validPlotPriceUnits.join(', ')}`
            });
          }
        }
        
        // Validate areas
        if (!unit.carpetArea && unit.type !== 'Plot') {
          return res.status(400).json({
            success: false,
            message: `Carpet area is required for ${unit.type}`
          });
        }
        
        if (!unit.builtUpArea && unit.type !== 'Plot') {
          return res.status(400).json({
            success: false,
            message: `Built-up area is required for ${unit.type}`
          });
        }
        
        // Validate plot-specific fields
        if (unit.type === 'Plot') {
          // For plots, carpetArea and builtUpArea can be optional if plotDetails.area is provided
          if (!unit.plotDetails?.area?.sqft && !unit.carpetArea) {
            return res.status(400).json({
              success: false,
              message: 'For plots, either carpetArea or plotDetails.area.sqft must be provided'
            });
          }
          
          // Validate plot shape if provided
          const validShapes = ["square", "rectangle", "corner", "irregular", "triangular"];
          if (unit.plotDetails?.shape && !validShapes.includes(unit.plotDetails.shape)) {
            return res.status(400).json({
              success: false,
              message: `Invalid plot shape. Must be one of: ${validShapes.join(', ')}`
            });
          }
          
          // Validate facing if provided
          const validFacings = ["north", "south", "east", "west", "north-east", "north-west", "south-east", "south-west"];
          if (unit.plotDetails?.facing && !validFacings.includes(unit.plotDetails.facing)) {
            return res.status(400).json({
              success: false,
              message: `Invalid facing direction. Must be one of: ${validFacings.join(', ')}`
            });
          }
          
          // Validate road type if provided
          const validRoadTypes = ["main", "secondary", "internal", "service", "highway"];
          if (unit.plotDetails?.roadType && !validRoadTypes.includes(unit.plotDetails.roadType)) {
            return res.status(400).json({
              success: false,
              message: `Invalid road type. Must be one of: ${validRoadTypes.join(', ')}`
            });
          }
          
          // Validate soil type if provided
          const validSoilTypes = ["black", "red", "clay", "loamy", "sandy", "rocky", "other"];
          if (unit.plotDetails?.soilType && !validSoilTypes.includes(unit.plotDetails.soilType)) {
            return res.status(400).json({
              success: false,
              message: `Invalid soil type. Must be one of: ${validSoilTypes.join(', ')}`
            });
          }
          
          // Validate land use if provided
          const validLandUses = ["residential", "commercial", "agricultural", "industrial", "mixed-use", "institutional"];
          if (unit.plotDetails?.landUse && !validLandUses.includes(unit.plotDetails.landUse)) {
            return res.status(400).json({
              success: false,
              message: `Invalid land use. Must be one of: ${validLandUses.join(', ')}`
            });
          }
          
          // Validate development status if provided
          const validDevelopmentStatus = ["developed", "semi-developed", "undeveloped"];
          if (unit.plotDetails?.developmentStatus && !validDevelopmentStatus.includes(unit.plotDetails.developmentStatus)) {
            return res.status(400).json({
              success: false,
              message: `Invalid development status. Must be one of: ${validDevelopmentStatus.join(', ')}`
            });
          }
          
          // Validate approval details if provided
          if (unit.plotDetails?.approvalDetails) {
            const approval = unit.plotDetails.approvalDetails;
            if (approval.dtcpApproved && !approval.dtcpNumber) {
              return res.status(400).json({
                success: false,
                message: 'DTCP number is required when DTCP approved is true'
              });
            }
            if (approval.layoutApproved && !approval.layoutNumber) {
              return res.status(400).json({
                success: false,
                message: 'Layout number is required when layout approved is true'
              });
            }
          }
        }
        
        // Validate availability
        if (unit.availability && !validAvailabilityOptions.includes(unit.availability)) {
          return res.status(400).json({
            success: false,
            message: `Invalid availability for ${unit.type}. Must be one of: ${validAvailabilityOptions.join(', ')}`
          });
        }
        
        // Set default availability
        unit.availability = unit.availability || "available";
        
        // Set default floors if not provided and not a plot
        if (unit.type !== 'Plot') {
          unit.floors = unit.floors || 1;
        }
        
        // For plots, set default values if not provided
        if (unit.type === 'Plot') {
          unit.plotDetails = unit.plotDetails || {};
          unit.plotDetails.shape = unit.plotDetails.shape || "rectangle";
          unit.plotDetails.landUse = unit.plotDetails.landUse || "residential";
          unit.plotDetails.developmentStatus = unit.plotDetails.developmentStatus || "developed";
          unit.plotDetails.utilities = unit.plotDetails.utilities || {
            electricity: false,
            waterConnection: false,
            sewageConnection: false,
            gasConnection: false,
            internetFiber: false
          };
          unit.plotDetails.approvalDetails = unit.plotDetails.approvalDetails || {
            dtcpApproved: false,
            layoutApproved: false,
            subdivisionApproved: false
          };
        }
      }
    } catch (parseError) {
      console.error('JSON parse error for unitTypes:', parseError);
      return res.status(400).json({
        success: false,
        message: 'Invalid JSON format in unitTypes field'
      });
    }

    // SECURITY: Determine sensitive fields based on user role
    const isAdminUser = req.user.isAdmin || req.user.userType === 'superadmin' || req.user.userType === 'admin';
    
    let finalApprovalStatus = "pending";
    let finalIsFeatured = false;
    let finalIsVerified = false;

    // Only allow admin users to set these sensitive fields
    if (isAdminUser) {
      if (approvalStatus && ["pending", "approved", "rejected"].includes(approvalStatus)) {
        finalApprovalStatus = approvalStatus;
      }
      
      if (isFeatured !== undefined) {
        finalIsFeatured = isFeatured === 'true' || isFeatured === true;
      }
      
      if (isVerified !== undefined) {
        finalIsVerified = isVerified === 'true' || isVerified === true;
      }
    }
    // For non-admin users, always use default values
    else {
      finalApprovalStatus = "pending";
      finalIsFeatured = false;
      finalIsVerified = false;
      
      if (approvalStatus === "approved" || isFeatured === true || isFeatured === 'true' || isVerified === true || isVerified === 'true') {
        console.warn(`Security Alert: User ${req.user._id} attempted to set privileged fields without authorization`);
      }
    }

    // Upload images to Cloudinary
    const uploadedImages = [];
    if (req.files && req.files.length > 0) {
      for (let file of req.files) {
        try {
          const result = await cloudinary.uploader.upload(file.path, {
            folder: "property-units",
          });
          uploadedImages.push({
            url: result.secure_url,
            public_id: result.public_id,
            caption: ""
          });
        } catch (uploadError) {
          console.error('Cloudinary upload error:', uploadError);
          return res.status(500).json({
            success: false,
            message: 'Error uploading images to Cloudinary'
          });
        }
      }
    } else {
      return res.status(400).json({
        success: false,
        message: 'At least one image is required'
      });
    }

    // Parse nested objects with error handling
    let parsedBuildingDetails = {};
    let parsedUnitFeatures = [];
    let parsedCommonSpecifications = {};
    let parsedLocationNearby = [];
    let parsedOwnerDetails = {};
    let parsedLegalDetails = {};
    let parsedContactPreference = ["call", "whatsapp"];

    try {
      parsedBuildingDetails = buildingDetails ? JSON.parse(buildingDetails) : {};
      parsedUnitFeatures = unitFeatures ? JSON.parse(unitFeatures) : [];
      parsedCommonSpecifications = commonSpecifications ? JSON.parse(commonSpecifications) : {};
      parsedLocationNearby = locationNearby ? JSON.parse(locationNearby) : [];
      parsedOwnerDetails = ownerDetails ? JSON.parse(ownerDetails) : {};
      parsedLegalDetails = legalDetails ? JSON.parse(legalDetails) : {};
      parsedContactPreference = contactPreference ? JSON.parse(contactPreference) : ["call", "whatsapp"];
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return res.status(400).json({
        success: false,
        message: 'Invalid JSON format in one of the fields'
      });
    }

    // Validate locationNearby if provided
    const validLocationTypes = ["transport", "education", "healthcare", "shopping", "entertainment", "banking", "religious", "park", "restaurant", "other"];
    if (parsedLocationNearby.length > 0) {
      for (const location of parsedLocationNearby) {
        if (!location.name || !location.distance) {
          return res.status(400).json({
            success: false,
            message: 'Each location nearby must have name and distance'
          });
        }
        
        // Validate type if provided
        if (location.type && !validLocationTypes.includes(location.type)) {
          location.type = "other";
        }
      }
    }

    // Validate unit features if provided
    const validUnitFeatures = [
      "Air Conditioning",
      "Modular Kitchen",
      "Wardrobes",
      "Geyser",
      "Exhaust Fan",
      "Chimney",
      "Lighting",
      "Ceiling Fans",
      "Smart Home Automation",
      "Central AC",
      "bore water",
      "Walk-in Closet",
      "Study Room",
      "Pooja Room",
      "Utility Area",
      "Servant Room",
      "Private Garden",
      "Terrace",
      "Balcony",
      "Swimming Pool",
      "Video Door Phone",
      "Security Alarm",
      "Fire Safety",
      "CCTV",
      "Pet Friendly",
      "Wheelchair Access",
      "Natural Light",
      "View"
    ];
    
    if (parsedUnitFeatures.length > 0) {
      for (const feature of parsedUnitFeatures) {
        if (feature.type && !validUnitFeatures.includes(feature.type)) {
          console.warn(`Invalid unit feature: ${feature.type}`);
        }
      }
    }

    // Validate common specifications
    const validFurnishing = ["unfurnished", "semi-furnished", "fully-furnished"];
    const validPossessionStatus = ["ready-to-move", "under-construction", "resale"];
    const validKitchenType = ["modular", "regular", "open", "closed", "none"];
    
    const finalCommonSpecifications = {
      furnishing: parsedCommonSpecifications.furnishing && validFurnishing.includes(parsedCommonSpecifications.furnishing) 
        ? parsedCommonSpecifications.furnishing 
        : "unfurnished",
      possessionStatus: parsedCommonSpecifications.possessionStatus && validPossessionStatus.includes(parsedCommonSpecifications.possessionStatus)
        ? parsedCommonSpecifications.possessionStatus
        : "ready-to-move",
      ageOfProperty: parsedCommonSpecifications.ageOfProperty,
      parking: {
        covered: parsedCommonSpecifications.parking?.covered || 0,
        open: parsedCommonSpecifications.parking?.open || 0
      },
      kitchenType: parsedCommonSpecifications.kitchenType && validKitchenType.includes(parsedCommonSpecifications.kitchenType)
        ? parsedCommonSpecifications.kitchenType
        : "regular"
    };

    // Validate contact preference
    const validContactPreferences = ["call", "whatsapp", "email", "message"];
    parsedContactPreference = parsedContactPreference.filter(pref => 
      validContactPreferences.includes(pref)
    );
    if (parsedContactPreference.length === 0) {
      parsedContactPreference = ["call", "whatsapp"];
    }

    // Validate building details based on property type
    if (propertyType !== 'Plot' && parsedBuildingDetails) {
      // For non-plot properties, ensure building details are properly structured
      if (parsedBuildingDetails.yearBuilt && 
          (parsedBuildingDetails.yearBuilt < 1900 || parsedBuildingDetails.yearBuilt > new Date().getFullYear())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid year built. Must be between 1900 and current year'
        });
      }
    }

    // Create new property unit
    const newPropertyUnit = new PropertyUnit({
      title,
      description,
      city,
      address,
      mapUrl: mapUrl ? mapUrl.trim() : undefined,
      propertyType,
      unitTypes: parsedUnitTypes,
      buildingDetails: parsedBuildingDetails,
      unitFeatures: parsedUnitFeatures,
      commonSpecifications: finalCommonSpecifications,
      locationNearby: parsedLocationNearby,
      approvalStatus: finalApprovalStatus,
      isFeatured: finalIsFeatured,
      isVerified: finalIsVerified,
      availability: finalAvailability,
      listingType: finalListingType,
      images: uploadedImages,
      ownerDetails: parsedOwnerDetails,
      legalDetails: parsedLegalDetails,
      contactPreference: parsedContactPreference,
      displayOrder: displayOrder || 0,
      rejectionReason: isAdminUser ? rejectionReason : "",
      createdBy: req.user._id,
      // Initialize statistics with zeros
      viewCount: 0,
      inquiryCount: 0,
      favoriteCount: 0,
      likes: 0
    });

    // Save the property unit
    await newPropertyUnit.save();
    
    // Update user's postedProperties array
    try {
      const foundUser = await User.findById(req.user._id);
      if (foundUser) {
        const alreadyExists = foundUser.postedProperties.some(
          item => item.property && item.property.toString() === newPropertyUnit._id.toString()
        );
        
        if (!alreadyExists) {
          foundUser.postedProperties.push({
            property: newPropertyUnit._id,
            postedAt: newPropertyUnit.createdAt,
            status: 'active',
            type: 'propertyUnit'
          });
          await foundUser.save();
          console.log(`Property unit ${newPropertyUnit._id} added to user ${foundUser._id}'s postedProperties`);
        } else {
          console.log(`Property unit ${newPropertyUnit._id} already exists in user's postedProperties`);
        }
      } else {
        console.warn(`User ${req.user._id} not found when updating postedProperties`);
      }
    } catch (userUpdateError) {
      console.error('Error updating user postedProperties:', userUpdateError);
    }
    
    // Populate createdBy user details
    await newPropertyUnit.populate('createdBy', 'name username email phoneNumber');

    const successMessage = finalApprovalStatus === "approved" 
      ? `Property unit added successfully and approved! It is now live on the platform.${propertyType === 'Plot' ? ' Plot details have been saved.' : ''}`
      : `Property unit added successfully! It will be visible after admin approval.${propertyType === 'Plot' ? ' Plot details have been saved.' : ''}`;

    // Prepare response data with plot-specific information
    const responseData = newPropertyUnit.toObject({
      virtuals: true // Include virtual fields like priceRange and availableUnitTypes
    });

    // Add plot-specific computed fields if property is a plot
    if (propertyType === 'Plot') {
      const plotUnits = parsedUnitTypes.filter(unit => unit.type === 'Plot');
      if (plotUnits.length > 0) {
        responseData.plotSummary = {
          totalPlots: plotUnits.length,
          availablePlots: plotUnits.filter(unit => unit.availability === 'available').length,
          minPrice: Math.min(...plotUnits.map(unit => unit.price.amount)),
          maxPrice: Math.max(...plotUnits.map(unit => unit.price.amount)),
          areaRange: {
            min: Math.min(...plotUnits.map(unit => unit.plotDetails?.area?.sqft || unit.carpetArea)),
            max: Math.max(...plotUnits.map(unit => unit.plotDetails?.area?.sqft || unit.carpetArea))
          }
        };
      }
    }

    res.status(201).json({
      success: true,
      message: successMessage,
      propertyUnit: responseData,
    });
  } catch (error) {
    console.error('Property unit creation error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    // Handle duplicate key errors (e.g., slug)
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'A property with similar title already exists. Please use a different title.',
      });
    }

    res.status(500).json({ 
      success: false, 
      message: "Error adding property unit",
      error: error.message 
    });
  }
};

const createPropertyUnitN8n = async (req, res) => {
  try {
    console.log('=== N8N PROPERTY UNIT CREATION ===');
    console.log('Request Body:', JSON.stringify(req.body, null, 2));

    // === SECURITY: Validate request source ===
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Authorization token required"
      });
    }

    // === VALIDATE REQUIRED FIELDS ===
    const requiredFields = [
      'title',
      'city', 
      'address',
      'propertyType',
      'price',
      'createdBy'  // User ID from n8n
    ];

    const missingFields = requiredFields.filter(field => !req.body[field]);
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`,
        required: requiredFields
      });
    }

    // === VALIDATE PROPERTY TYPE ===
    const validPropertyTypes = [
      "Apartment", "Villa", "Independent House", "Studio", 
      "Penthouse", "Duplex", "Pg house", "Plot", "Commercial Space"
    ];

    if (!validPropertyTypes.includes(req.body.propertyType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid propertyType. Must be one of: ${validPropertyTypes.join(', ')}`,
        received: req.body.propertyType
      });
    }

    // === VALIDATE USER ===
    const user = await User.findById(req.body.createdBy);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: `User with ID ${req.body.createdBy} not found`
      });
    }

    // === VALIDATE SPECIFICATIONS ===
    let specifications = {};
    if (req.body.specifications) {
      try {
        specifications = typeof req.body.specifications === 'string' 
          ? JSON.parse(req.body.specifications)
          : req.body.specifications;
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: "Invalid specifications format. Must be valid JSON object",
          error: error.message
        });
      }
    }

    // Set default specifications if not provided
    const defaultSpecs = {
      bedrooms: 0,
      bathrooms: 0,
      balconies: 0,
      floors: 1,
      carpetArea: 0,
      builtUpArea: 0,
      furnishing: "unfurnished",
      possessionStatus: "ready-to-move",
      parking: { covered: 0, open: 0 },
      kitchenType: "regular"
    };

    // Merge provided specs with defaults
    specifications = { ...defaultSpecs, ...specifications };

    // === VALIDATE PRICE ===
    let price = {};
    if (req.body.price) {
      try {
        price = typeof req.body.price === 'string' 
          ? JSON.parse(req.body.price)
          : req.body.price;
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: "Invalid price format. Must be valid JSON object",
          error: error.message
        });
      }
    }

    if (!price.amount || isNaN(Number(price.amount))) {
      return res.status(400).json({
        success: false,
        message: "Price must have a valid 'amount' field",
        received: price
      });
    }

    // === PARSE OPTIONAL FIELDS ===
    const parseField = (field, defaultValue) => {
      if (!req.body[field]) return defaultValue;
      try {
        return typeof req.body[field] === 'string' 
          ? JSON.parse(req.body[field])
          : req.body[field];
      } catch (error) {
        console.warn(`Failed to parse ${field}, using default`);
        return defaultValue;
      }
    };

    const buildingDetails = parseField('buildingDetails', {});
    const unitFeatures = parseField('unitFeatures', []);
    const rentalDetails = parseField('rentalDetails', {});
    const coordinates = parseField('coordinates', { latitude: null, longitude: null });
    const ownerDetails = parseField('ownerDetails', {});
    const legalDetails = parseField('legalDetails', {});
    const floorPlan = parseField('floorPlan', {});
    const viewingSchedule = parseField('viewingSchedule', []);

    // === PROCESS IMAGES ===
    let images = [];
    if (req.body.images && Array.isArray(req.body.images)) {
      images = req.body.images.map(img => ({
        url: img.url || '',
        public_id: img.public_id || '',
        caption: img.caption || ''
      })).filter(img => img.url && img.url.trim() !== '');
    }

    // IMPORTANT: Allow empty images array for n8n
    // Images can be added later or might come from another source

    // === DETERMINE LISTING TYPE ===
    let listingType = "sale";
    if (req.body.listingType && ["sale", "rent", "lease", "pg"].includes(req.body.listingType)) {
      listingType = req.body.listingType;
    } else if (rentalDetails.availableForRent) {
      listingType = "rent";
    }

    // === VALIDATE UNIT FEATURES (ENUM) ===
    const validUnitFeatures = [
      "Air Conditioning", "Modular Kitchen", "Wardrobes", "Geyser", "Exhaust Fan", 
      "Chimney", "Lighting", "Ceiling Fans", "Smart Home Automation", "Central AC", 
      "bore water", "Walk-in Closet", "Study Room", "Pooja Room", "Utility Area", 
      "Servant Room", "Private Garden", "Terrace", "Balcony", "Swimming Pool", 
      "Video Door Phone", "Security Alarm", "Fire Safety", "CCTV", "Pet Friendly", 
      "Wheelchair Access", "Natural Light", "View"
    ];

    const filteredUnitFeatures = unitFeatures.filter(feature => 
      validUnitFeatures.includes(feature)
    );

    // === CREATE PROPERTY UNIT OBJECT ===
    const propertyUnitData = {
      title: req.body.title.trim(),
      description: req.body.description || '',
      unitNumber: req.body.unitNumber || '',
      images: images, // Can be empty array
      city: req.body.city.trim(),
      address: req.body.address.trim(),
      coordinates: coordinates,
      mapUrl: req.body.mapUrl || '',
      price: {
        amount: String(price.amount),
        currency: price.currency || "INR",
        perUnit: price.perUnit || "total"
      },
      maintenanceCharges: Number(req.body.maintenanceCharges) || 0,
      securityDeposit: Number(req.body.securityDeposit) || 0,
      propertyType: req.body.propertyType,
      specifications: {
        bedrooms: Number(specifications.bedrooms) || 0,
        bathrooms: Number(specifications.bathrooms) || 0,
        balconies: Number(specifications.balconies) || 0,
        floors: Number(specifications.floors) || 1,
        floorNumber: specifications.floorNumber ? Number(specifications.floorNumber) : null,
        carpetArea: Number(specifications.carpetArea) || 0,
        builtUpArea: Number(specifications.builtUpArea) || 0,
        superBuiltUpArea: specifications.superBuiltUpArea ? Number(specifications.superBuiltUpArea) : null,
        plotArea: specifications.plotArea ? Number(specifications.plotArea) : null,
        furnishing: specifications.furnishing || "unfurnished",
        possessionStatus: specifications.possessionStatus || "ready-to-move",
        ageOfProperty: specifications.ageOfProperty ? Number(specifications.ageOfProperty) : null,
        parking: {
          covered: specifications.parking?.covered ? Number(specifications.parking.covered) : 0,
          open: specifications.parking?.open ? Number(specifications.parking.open) : 0
        },
        kitchenType: specifications.kitchenType || "regular"
      },
      buildingDetails: {
        name: buildingDetails.name || '',
        totalFloors: buildingDetails.totalFloors ? Number(buildingDetails.totalFloors) : null,
        totalUnits: buildingDetails.totalUnits ? Number(buildingDetails.totalUnits) : null,
        yearBuilt: buildingDetails.yearBuilt ? Number(buildingDetails.yearBuilt) : null,
        amenities: Array.isArray(buildingDetails.amenities) ? buildingDetails.amenities : []
      },
      unitFeatures: filteredUnitFeatures,
      rentalDetails: {
        availableForRent: rentalDetails.availableForRent || false,
        leaseDuration: {
          value: rentalDetails.leaseDuration?.value || 11,
          unit: rentalDetails.leaseDuration?.unit || "months"
        },
        rentNegotiable: rentalDetails.rentNegotiable !== undefined ? rentalDetails.rentNegotiable : true,
        preferredTenants: rentalDetails.preferredTenants || [],
        includedInRent: rentalDetails.includedInRent || []
      },
      availability: req.body.availability || "available",
      isFeatured: req.body.isFeatured === true || req.body.isFeatured === 'true',
      isVerified: req.body.isVerified === true || req.body.isVerified === 'true',
      approvalStatus: req.body.approvalStatus || "pending",
      listingType: listingType,
      websiteAssignment: req.body.websiteAssignment && Array.isArray(req.body.websiteAssignment)
        ? [...new Set([...req.body.websiteAssignment, "cleartitle"])]
        : ["cleartitle"],
      rejectionReason: req.body.rejectionReason || '',
      virtualTour: req.body.virtualTour || '',
      floorPlan: {
        image: floorPlan.image || '',
        public_id: floorPlan.public_id || '',
        description: floorPlan.description || ''
      },
      ownerDetails: {
        name: ownerDetails.name || '',
        phoneNumber: ownerDetails.phoneNumber || '',
        email: ownerDetails.email || '',
        reasonForSelling: ownerDetails.reasonForSelling || ''
      },
      legalDetails: {
        ownershipType: legalDetails.ownershipType || null,
        reraRegistered: legalDetails.reraRegistered || false,
        reraNumber: legalDetails.reraNumber || '',
        khataCertificate: legalDetails.khataCertificate || false,
        encumbranceCertificate: legalDetails.encumbranceCertificate || false,
        occupancyCertificate: legalDetails.occupancyCertificate || false
      },
      viewingSchedule: viewingSchedule,
      contactPreference: req.body.contactPreference && Array.isArray(req.body.contactPreference)
        ? req.body.contactPreference
        : ["call", "whatsapp"],
      viewCount: 0,
      inquiryCount: 0,
      favoriteCount: 0,
      metaTitle: req.body.metaTitle || '',
      metaDescription: req.body.metaDescription || '',
      slug: req.body.slug || '', // Will be auto-generated if empty
      displayOrder: Number(req.body.displayOrder) || 0,
      createdBy: req.body.createdBy,
      parentProperty: req.body.parentProperty || null
    };

    console.log('Creating Property Unit with data:', JSON.stringify(propertyUnitData, null, 2));

    // === CREATE PROPERTY UNIT IN DATABASE ===
    const newPropertyUnit = await PropertyUnit.create(propertyUnitData);

    // === UPDATE USER'S POSTED PROPERTIES ===
    try {
      const foundUser = await User.findById(req.body.createdBy);
      if (foundUser) {
        const alreadyExists = foundUser.postedProperties.some(
          item => item.property && item.property.toString() === newPropertyUnit._id.toString()
        );
        
        if (!alreadyExists) {
          foundUser.postedProperties.push({
            property: newPropertyUnit._id,
            postedAt: newPropertyUnit.createdAt,
            status: 'active',
            propertyType: 'unit'
          });
          await foundUser.save();
          console.log(`✓ Property Unit ${newPropertyUnit._id} added to user ${foundUser._id}'s postedProperties`);
        }
      }
    } catch (userUpdateError) {
      console.error('Error updating user postedProperties:', userUpdateError);
      // Continue even if user update fails
    }

    // === SUCCESS RESPONSE ===
    const response = {
      success: true,
      message: "Property unit created successfully via n8n",
      data: newPropertyUnit,
      n8nId: req.body.n8nId || req.body.externalId || null
    };

    console.log('=== N8N PROPERTY UNIT CREATION SUCCESS ===');
    res.status(201).json(response);

  } catch (error) {
    console.error('=== N8N PROPERTY UNIT CREATION ERROR ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors,
        validationError: true
      });
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Duplicate property unit detected",
        duplicateError: true
      });
    }

    // Generic error response
    res.status(500).json({
      success: false,
      message: "Server error while creating property unit via n8n",
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

const getPropertyUnits = async (req, res) => {
  try {
    const {
      city,
      propertyType,
      minPrice,
      maxPrice,
      unitType, // For filtering by unit type (1BHK, 2BHK, etc.)
      furnishing,
      possessionStatus,
      kitchenType,
      listingType,
      availability,
      isFeatured,
      isVerified,
      sortBy = 'displayOrder',
      sortOrder = 'asc',
      page = 1,
      limit = 12,
      search: searchQuery,
      approvalStatus,
      createdBy,
      // New filters for advanced search
      bedrooms,
      bathrooms,
      carpetAreaMin,
      carpetAreaMax,
      builtUpAreaMin,
      builtUpAreaMax,
      parkingSpaces,
      reraRegistered,
      khataStatus,
      ownershipType,
      plotLandUse,
      plotDevelopmentStatus,
      nearbyAmenity, // e.g., "Metro Station", "School"
      nearbyDistanceMax // max distance in km
    } = req.query;

    // Build filter
    const filter = {};

    // User type check
    const isAdmin = req.user && (req.user.userType === 'admin' || req.user.userType === 'superadmin');

    // Set default filters for non-admin users
    if (!isAdmin) {
      filter.approvalStatus = 'approved';
      filter.availability = 'available';
    } else {
      if (approvalStatus) {
        filter.approvalStatus = approvalStatus;
      }
      if (availability) {
        filter.availability = availability;
      }
    }

    // Apply basic filters
    if (city && city.trim() !== '') {
      filter.city = new RegExp(city.trim(), 'i');
    }
    
    if (propertyType && propertyType.trim() !== '') {
      filter.propertyType = propertyType.trim();
    }
    
    if (listingType && listingType.trim() !== '') {
      filter.listingType = listingType.trim();
    }
    
    // Filter by unit type (if searching for specific BHK)
    if (unitType && unitType.trim() !== '') {
      filter['unitTypes.type'] = unitType.trim();
    }
    
    // Filter by bedrooms count (extract from unit type)
    if (bedrooms && !isNaN(bedrooms)) {
      const bedroomPattern = new RegExp(`${bedrooms}BHK`);
      filter['unitTypes.type'] = bedroomPattern;
    }
    
    // Price range filter (checks across all unit types)
    if (minPrice || maxPrice) {
      filter['unitTypes.price.amount'] = {};
      if (minPrice && !isNaN(minPrice)) {
        filter['unitTypes.price.amount'].$gte = Number(minPrice);
      }
      if (maxPrice && !isNaN(maxPrice)) {
        filter['unitTypes.price.amount'].$lte = Number(maxPrice);
      }
    }
    
    // Area filters
    if (carpetAreaMin && !isNaN(carpetAreaMin)) {
      filter['unitTypes.carpetArea'] = { $gte: Number(carpetAreaMin) };
    }
    if (carpetAreaMax && !isNaN(carpetAreaMax)) {
      if (!filter['unitTypes.carpetArea']) filter['unitTypes.carpetArea'] = {};
      filter['unitTypes.carpetArea'].$lte = Number(carpetAreaMax);
    }
    
    if (builtUpAreaMin && !isNaN(builtUpAreaMin)) {
      filter['unitTypes.builtUpArea'] = { $gte: Number(builtUpAreaMin) };
    }
    if (builtUpAreaMax && !isNaN(builtUpAreaMax)) {
      if (!filter['unitTypes.builtUpArea']) filter['unitTypes.builtUpArea'] = {};
      filter['unitTypes.builtUpArea'].$lte = Number(builtUpAreaMax);
    }
    
    // Specifications filters
    if (furnishing && furnishing.trim() !== '') {
      filter['commonSpecifications.furnishing'] = furnishing.trim();
    }
    
    if (possessionStatus && possessionStatus.trim() !== '') {
      filter['commonSpecifications.possessionStatus'] = possessionStatus.trim();
    }
    
    if (kitchenType && kitchenType.trim() !== '') {
      filter['commonSpecifications.kitchenType'] = kitchenType.trim();
    }
    
    // Parking filter
    if (parkingSpaces && !isNaN(parkingSpaces)) {
      filter.$or = [
        { 'commonSpecifications.parking.covered': { $gte: Number(parkingSpaces) } },
        { 'commonSpecifications.parking.open': { $gte: Number(parkingSpaces) } }
      ];
    }
    
    // Legal filters
    if (reraRegistered !== undefined && reraRegistered !== '') {
      filter['legalDetails.reraRegistered'] = reraRegistered === 'true';
    }
    
    if (khataStatus && khataStatus.trim() !== '') {
      filter['legalDetails.khataStatus'] = khataStatus.trim();
    }
    
    if (ownershipType && ownershipType.trim() !== '') {
      filter['legalDetails.ownershipType'] = ownershipType.trim();
    }
    
    // Plot-specific filters
    if (plotLandUse && plotLandUse.trim() !== '') {
      filter['unitTypes.plotDetails.landUse'] = plotLandUse.trim();
    }
    
    if (plotDevelopmentStatus && plotDevelopmentStatus.trim() !== '') {
      filter['unitTypes.plotDetails.developmentStatus'] = plotDevelopmentStatus.trim();
    }
    
    // Nearby amenities filter (check if locationNearby contains the amenity)
    if (nearbyAmenity && nearbyAmenity.trim() !== '') {
      const amenityFilter = { 'locationNearby.name': new RegExp(nearbyAmenity.trim(), 'i') };
      
      if (nearbyDistanceMax && !isNaN(nearbyDistanceMax)) {
        // For distance filtering, we'd need more complex logic
        // This is a simplified version
        amenityFilter['locationNearby.distance'] = { 
          $regex: new RegExp(`^(0|[1-9]${nearbyDistanceMax})\\.?\\d*km?$`, 'i')
        };
      }
      
      filter.$and = filter.$and || [];
      filter.$and.push(amenityFilter);
    }
    
    // Admin-only filters
    if (isAdmin) {
      if (isFeatured !== undefined && isFeatured !== '') {
        filter.isFeatured = isFeatured === 'true';
      }
      if (isVerified !== undefined && isVerified !== '') {
        filter.isVerified = isVerified === 'true';
      }
    }
    
    // Search filter
    if (searchQuery && searchQuery.trim() !== '') {
      const searchRegex = new RegExp(searchQuery.trim(), 'i');
      filter.$or = [
        { title: searchRegex },
        { description: searchRegex },
        { address: searchRegex },
        { city: searchRegex },
        { 'buildingDetails.name': searchRegex },
        { 'unitTypes.type': searchRegex },
        { 'locationNearby.name': searchRegex }
      ];
    }
    
    // Filter by creator
    if (createdBy && createdBy.trim() !== '') {
      filter.createdBy = createdBy.trim();
    }

    // Calculate pagination
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(Math.max(1, parseInt(limit) || 12), 100);
    const skip = (pageNum - 1) * limitNum;

    // Build sort object
    let sort = {};
    
    const allowedSortFields = {
      'displayOrder': 'displayOrder',
      'createdAt': 'createdAt',
      'updatedAt': 'updatedAt',
      'title': 'title',
      'city': 'city',
      'listingType': 'listingType',
      'isFeatured': 'isFeatured',
      'isVerified': 'isVerified',
      'availability': 'availability',
      'price': 'unitTypes.price.amount', // Special handling for price sorting
      'carpetArea': 'unitTypes.carpetArea',
      'builtUpArea': 'unitTypes.builtUpArea',
      'viewCount': 'viewCount'
    };

    const sortField = allowedSortFields[sortBy] || 'displayOrder';
    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    
    // If sorting by price or area, we need to handle it specially
    if (sortBy === 'price') {
      // Sort by minimum price across unit types
      sort = {
        'unitTypes.price.amount': sortDirection
      };
    } else if (sortBy === 'carpetArea' || sortBy === 'builtUpArea') {
      sort = {
        [sortField]: sortDirection
      };
    } else {
      // Normal sorting
      if (sortField === 'displayOrder') {
        sort = { 
          [sortField]: sortDirection,
          'createdAt': -1
        };
      } else {
        sort[sortField] = sortDirection;
        sort.displayOrder = -1;
      }
    }
    
    // If not sorting by isFeatured, add it as a sort criteria
    if (sortField !== 'isFeatured') {
      sort.isFeatured = -1;
    }

    // Execute query
    const query = PropertyUnit.find(filter);
    
    if (Object.keys(sort).length > 0) {
      query.sort(sort);
    }
    
    const propertyUnits = await query
      .skip(skip)
      .limit(limitNum)
      .populate('createdBy', 'name email phoneNumber avatar')
      .lean();

    // Get total count
    const total = await PropertyUnit.countDocuments(filter);

    // Transform data for frontend compatibility
    const transformedData = propertyUnits.map(unit => {
      // Get the first available unit type or the cheapest one
      const primaryUnitType = unit.unitTypes && unit.unitTypes.length > 0 
        ? unit.unitTypes.sort((a, b) => a.price.amount - b.price.amount)[0] 
        : null;
      
      // Calculate total parking spaces
      const totalParking = (unit.commonSpecifications?.parking?.covered || 0) + 
                          (unit.commonSpecifications?.parking?.open || 0);
      
      // Get bedrooms count from unit type
      const bedroomMatch = primaryUnitType?.type?.match(/\d+/);
      const bedroomsCount = bedroomMatch ? parseInt(bedroomMatch[0]) : 0;
      
      // Estimate bathrooms (basic estimation)
      const bathroomsCount = bedroomsCount > 0 ? bedroomsCount : 1;
      
      // Get price range from virtual field
      const priceRange = unit.priceRange;
      
      // Get available unit types from virtual field
      const availableUnitTypes = unit.availableUnitTypes;
      
      return {
        ...unit,
        // Add computed fields for frontend compatibility
        specifications: {
          furnishing: unit.commonSpecifications?.furnishing,
          possessionStatus: unit.commonSpecifications?.possessionStatus,
          kitchenType: unit.commonSpecifications?.kitchenType,
          parkingSpaces: totalParking,
          coveredParking: unit.commonSpecifications?.parking?.covered || 0,
          openParking: unit.commonSpecifications?.parking?.open || 0,
          carpetArea: primaryUnitType?.carpetArea || 0,
          builtUpArea: primaryUnitType?.builtUpArea || 0,
          superBuiltUpArea: primaryUnitType?.superBuiltUpArea || 0,
          bedrooms: bedroomsCount,
          bathrooms: bathroomsCount,
          floors: primaryUnitType?.floors || unit.buildingDetails?.totalFloors || 1,
          floorNumber: primaryUnitType?.floorNumber
        },
        // Add price object for frontend compatibility
        price: primaryUnitType?.price || null,
        priceRange: priceRange,
        // Add unit type info
        unitType: primaryUnitType?.type || null,
        // Add availability info
        totalUnits: primaryUnitType?.totalUnits || null,
        availableUnits: primaryUnitType?.availableUnits || null,
        // Add plot details if applicable
        plotDetails: unit.propertyType === 'Plot' && primaryUnitType?.plotDetails 
          ? primaryUnitType.plotDetails 
          : null,
        // Add location nearby details
        locationNearby: unit.locationNearby || [],
        // Add building details
        buildingDetails: unit.buildingDetails || null,
        // Add unit features
        unitFeatures: unit.unitFeatures || [],
        // Add legal details
        legalDetails: unit.legalDetails || null,
        // Keep original unitTypes for detailed view
        unitTypes: unit.unitTypes,
        // Add computed fields for statistics
        hasMultipleUnitTypes: unit.unitTypes && unit.unitTypes.length > 1,
        unitTypeCount: unit.unitTypes?.length || 0
      };
    });

    // Get available filters for dropdowns
    const availableCities = await PropertyUnit.distinct('city', filter).sort();
    const availablePropertyTypes = await PropertyUnit.distinct('propertyType', filter).sort();
    
    // Get available unit types from all properties
    const allUnitTypes = await PropertyUnit.aggregate([
      { $match: filter },
      { $unwind: '$unitTypes' },
      { $group: { _id: '$unitTypes.type' } },
      { $sort: { _id: 1 } }
    ]);
    const availableUnitTypes = allUnitTypes.map(item => item._id).filter(t => t);
    
    // Get available furnishing types
    const availableFurnishingTypes = await PropertyUnit.distinct('commonSpecifications.furnishing', filter);
    const availablePossessionStatuses = await PropertyUnit.distinct('commonSpecifications.possessionStatus', filter);
    const availableKitchenTypes = await PropertyUnit.distinct('commonSpecifications.kitchenType', filter);
    const availableListingTypes = await PropertyUnit.distinct('listingType', filter);
    
    // Get available legal filters
    const availableKhataStatuses = await PropertyUnit.distinct('legalDetails.khataStatus', filter);
    const availableOwnershipTypes = await PropertyUnit.distinct('legalDetails.ownershipType', filter);
    const availableLandUseTypes = await PropertyUnit.distinct('unitTypes.plotDetails.landUse', filter);
    
    // Get nearby amenities statistics
    const nearbyAmenities = await PropertyUnit.aggregate([
      { $match: filter },
      { $unwind: '$locationNearby' },
      { $group: { 
        _id: '$locationNearby.type', 
        names: { $addToSet: '$locationNearby.name' },
        count: { $sum: 1 }
      }},
      { $sort: { count: -1 } }
    ]);
    
    // Get price range statistics for the current filter
    const priceStats = await PropertyUnit.aggregate([
      { $match: filter },
      { $unwind: '$unitTypes' },
      { $group: {
        _id: null,
        minPrice: { $min: '$unitTypes.price.amount' },
        maxPrice: { $max: '$unitTypes.price.amount' },
        avgPrice: { $avg: '$unitTypes.price.amount' }
      }}
    ]);

    res.status(200).json({
      success: true,
      count: transformedData.length,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      data: transformedData,
      filters: {
        availableCities,
        availablePropertyTypes,
        availableUnitTypes,
        availableFurnishingTypes,
        availablePossessionStatuses,
        availableKitchenTypes,
        availableListingTypes,
        availableKhataStatuses,
        availableOwnershipTypes,
        availableLandUseTypes,
        nearbyAmenities: nearbyAmenities.map(amenity => ({
          type: amenity._id,
          examples: amenity.names.slice(0, 5),
          count: amenity.count
        })),
        priceRange: priceStats[0] ? {
          min: priceStats[0].minPrice,
          max: priceStats[0].maxPrice,
          avg: Math.round(priceStats[0].avgPrice)
        } : null,
        appliedFilters: {
          city,
          propertyType,
          unitType,
          furnishing,
          possessionStatus,
          kitchenType,
          listingType,
          minPrice,
          maxPrice,
          bedrooms,
          carpetAreaMin,
          carpetAreaMax,
          builtUpAreaMin,
          builtUpAreaMax,
          parkingSpaces,
          reraRegistered,
          khataStatus,
          ownershipType,
          plotLandUse,
          plotDevelopmentStatus,
          nearbyAmenity
        }
      }
    });

  } catch (error) {
    console.error('Get property units error:', error);
    console.error('Error stack:', error.stack);
    
    res.status(500).json({
      success: false,
      message: 'Error fetching property units',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// In batchService.js

// In your backend controller - remove or increase the limit
// Backend route - /api/property-units/featured
// Backend controller - Fixed version
const getFeaturedPropertyUnits = async (req, res) => {
  try {
    // Simple query without population first to test
    const propertyUnits = await PropertyUnit.find({
      isFeatured: true,
      approvalStatus: "approved",
      availability: "available"
    })
    .sort({ displayOrder: 1, createdAt: -1 })
    .lean();

    // If you need population, do it separately or with error handling
    // const populatedUnits = await PropertyUnit.populate(propertyUnits, [
    //   { path: "createdBy", select: "name email phoneNumber avatar" },
    //   { path: "parentProperty", select: "name title images" }
    // ]);

    res.status(200).json({
      success: true,
      count: propertyUnits.length,
      data: propertyUnits
    });

  } catch (error) {
    console.error("Get featured property units error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching featured property units",
      error: error.message // This will help debug
    });
  }
};

// Get property unit by ID (Public)
// propertyUnitController.js - Updated getPropertyUnitById
const getPropertyUnitById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid property unit ID format"
      });
    }

    console.log("Searching for property unit with ID:", id);

    // Check if user is admin to show pending/rejected properties
    const isAdmin = req.user && (req.user.userType === 'admin' || req.user.userType === 'superadmin');
    
    // Build filter based on user role
    const filter = { _id: id };
    if (!isAdmin) {
      filter.approvalStatus = "approved";
    }

    // Find property unit with proper population
    const propertyUnit = await PropertyUnit.findOne(filter)
      .populate("createdBy", "name email phoneNumber avatar")
      .lean();

    console.log("Found property unit:", propertyUnit ? "Yes" : "No");

    if (!propertyUnit) {
      return res.status(404).json({
        success: false,
        message: "Property unit not found"
      });
    }

    // Increment view count asynchronously (only for non-admin views)
    if (!isAdmin) {
      PropertyUnit.findByIdAndUpdate(id, { 
        $inc: { viewCount: 1 } 
      }).exec();
    }

    // Transform the data to match frontend expectations
    const transformedData = transformPropertyUnitForFrontend(propertyUnit);

    res.status(200).json({
      success: true,
      data: transformedData
    });
    
  } catch (error) {
    console.error("Get property unit by ID error:", error);
    console.error("Error stack:", error.stack);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: "Invalid property unit ID"
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Error fetching property unit",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Helper function to transform data for frontend
const transformPropertyUnitForFrontend = (unit) => {
  // Get all unit types
  const unitTypes = unit.unitTypes || [];
  
  // Get the primary unit type (first available or cheapest)
  let primaryUnitType = null;
  if (unitTypes.length > 0) {
    // Sort by price to get the cheapest as primary
    const sortedUnits = [...unitTypes].sort((a, b) => a.price.amount - b.price.amount);
    primaryUnitType = sortedUnits[0];
  }
  
  // Calculate price range from all unit types
  const priceRange = unit.priceRange || (unitTypes.length > 0 ? {
    min: Math.min(...unitTypes.map(u => u.price.amount)),
    max: Math.max(...unitTypes.map(u => u.price.amount))
  } : null);
  
  // Calculate price from primary unit type
  let price = null;
  if (primaryUnitType && primaryUnitType.price) {
    price = {
      amount: primaryUnitType.price.amount,
      currency: primaryUnitType.price.currency || 'INR',
      perUnit: primaryUnitType.price.perUnit || 'total'
    };
  }

  // Build specifications from unitTypes and commonSpecifications
  const specifications = {
    // From unit type
    bedrooms: primaryUnitType?.type ? parseInt(primaryUnitType.type.match(/\d+/)?.[0] || 0) : 0,
    unitType: primaryUnitType?.type || null,
    carpetArea: primaryUnitType?.carpetArea || 0,
    builtUpArea: primaryUnitType?.builtUpArea || 0,
    superBuiltUpArea: primaryUnitType?.superBuiltUpArea || 0,
    floorNumber: primaryUnitType?.floorNumber || 0,
    floors: primaryUnitType?.floors || 1,
    
    // From common specifications
    furnishing: unit.commonSpecifications?.furnishing || "unfurnished",
    possessionStatus: unit.commonSpecifications?.possessionStatus || "ready-to-move",
    ageOfProperty: unit.commonSpecifications?.ageOfProperty,
    parking: unit.commonSpecifications?.parking || { covered: 0, open: 0 },
    kitchenType: unit.commonSpecifications?.kitchenType || "regular"
  };

  // Get building details
  const buildingDetails = unit.buildingDetails || {};

  // Get rental details if applicable
  const rentalDetails = unit.listingType === 'rent' || unit.listingType === 'lease' ? {
    monthlyRent: price?.amount || null,
    securityDeposit: unit.securityDeposit || null,
    maintenanceCharges: unit.maintenanceCharges || null,
    leaseTerms: unit.leaseTerms || null
  } : null;

  // Get legal details
  const legalDetails = unit.legalDetails || {};

  // Get viewing schedule
  const viewingSchedule = unit.viewingSchedule || [];

  // Get contact preference
  const contactPreference = unit.contactPreference || ["call", "whatsapp"];

  // Get owner details
  const ownerDetails = unit.ownerDetails || {};

  // Get nearby amenities
  const locationNearby = unit.locationNearby || [];

  // Get unit features
  const unitFeatures = unit.unitFeatures || [];

  // Calculate available unit types count
  const availableUnitTypes = unit.availableUnitTypes || unitTypes.filter(ut => 
    ut.availability === 'available' && 
    (ut.availableUnits === undefined || ut.availableUnits > 0)
  );

  // Get plot area if property is plot
  let plotArea = null;
  if (unit.propertyType === 'Plot') {
    const plotUnit = unitTypes.find(ut => ut.type === 'Plot');
    if (plotUnit?.plotDetails?.area) {
      plotArea = {
        sqft: plotUnit.plotDetails.area.sqft,
        sqYards: plotUnit.plotDetails.area.sqYards,
        grounds: plotUnit.plotDetails.area.grounds,
        acres: plotUnit.plotDetails.area.acres,
        cents: plotUnit.plotDetails.area.cents,
        dimensions: plotUnit.plotDetails.dimensions,
        shape: plotUnit.plotDetails.shape,
        facing: plotUnit.plotDetails.facing,
        isCornerPlot: plotUnit.plotDetails.isCornerPlot,
        cornerRoads: plotUnit.plotDetails.cornerRoads,
        roadWidth: plotUnit.plotDetails.roadWidth,
        roadType: plotUnit.plotDetails.roadType,
        landUse: plotUnit.plotDetails.landUse,
        developmentStatus: plotUnit.plotDetails.developmentStatus,
        amenities: plotUnit.plotDetails.amenities,
        utilities: plotUnit.plotDetails.utilities,
        approvalDetails: plotUnit.plotDetails.approvalDetails
      };
    }
  }

  // Format full address
  const fullAddress = unit.unitNumber 
    ? `${unit.unitNumber}, ${unit.address || ''}, ${unit.city || ''}`.replace(/\s*,\s*,/g, ',').replace(/,\s*$/, '')
    : `${unit.address || ''}, ${unit.city || ''}`.replace(/\s*,\s*,/g, ',').replace(/,\s*$/, '');

  return {
    // Basic Information
    _id: unit._id,
    title: unit.title,
    description: unit.description,
    images: unit.images || [],
    city: unit.city,
    address: unit.address,
    fullAddress: fullAddress,
    unitNumber: unit.unitNumber,
    mapUrl: unit.mapUrl,
    
    // Location & Nearby
    locationNearby: locationNearby,
    
    // Property Type
    propertyType: unit.propertyType,
    
    // Unit Types (All configurations)
    unitTypes: unitTypes.map(ut => ({
      ...ut,
      // Add formatted price for frontend convenience
      formattedPrice: formatPriceForFrontend(ut.price)
    })),
    
    // Price Information
    price: price,
    priceRange: priceRange,
    
    // Availability & Status
    availability: unit.availability,
    isFeatured: unit.isFeatured,
    isVerified: unit.isVerified,
    approvalStatus: unit.approvalStatus,
    listingType: unit.listingType,
    
    // Specifications
    specifications: specifications,
    commonSpecifications: unit.commonSpecifications || {},
    
    // Building Details
    buildingDetails: buildingDetails,
    
    // Unit Features
    unitFeatures: unitFeatures,
    
    // Rental Details
    rentalDetails: rentalDetails,
    
    // Legal Details
    legalDetails: legalDetails,
    
    // Owner Information
    ownerDetails: ownerDetails,
    
    // Creator Information
    createdBy: unit.createdBy,
    
    // Plot Specific Details
    plotArea: plotArea,
    
    // Viewing & Contact
    viewingSchedule: viewingSchedule,
    contactPreference: contactPreference,
    
    // Statistics
    viewCount: unit.viewCount,
    inquiryCount: unit.inquiryCount,
    favoriteCount: unit.favoriteCount,
    likes: unit.likes,
    
    // SEO
    slug: unit.slug,
    
    // Timestamps
    createdAt: unit.createdAt,
    updatedAt: unit.updatedAt,
    
    // Computed Fields
    hasMultipleUnitTypes: unitTypes.length > 1,
    totalUnitTypes: unitTypes.length,
    availableUnitTypesCount: availableUnitTypes.length,
    availableUnitTypes: availableUnitTypes,
    
    // Additional Fields
    virtualTour: unit.virtualTour,
    floorPlan: unit.floorPlan,
    displayOrder: unit.displayOrder
  };
};

// Helper function to format price for frontend
const formatPriceForFrontend = (price) => {
  if (!price || !price.amount) return null;
  
  const amount = price.amount;
  const currency = price.currency || '₹';
  const perUnit = price.perUnit;
  
  const numberToWords = (num) => {
    const crore = 10000000;
    const lakh = 100000;
    const thousand = 1000;
    
    const formatDecimal = (value) => {
      const fixed = value.toFixed(2);
      return fixed.replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
    };
    
    if (num >= crore) {
      const crores = num / crore;
      if (num % crore === 0) {
        return `${Math.floor(crores).toLocaleString('en-IN')} Cr`;
      }
      return `${formatDecimal(crores)} Cr`;
    }
    
    if (num >= lakh) {
      const lakhs = num / lakh;
      if (num % lakh === 0) {
        return `${Math.floor(lakhs).toLocaleString('en-IN')} L`;
      }
      return `${formatDecimal(lakhs)} L`;
    }
    
    if (num >= thousand) {
      const thousands = num / thousand;
      if (num % thousand === 0) {
        return `${Math.floor(thousands).toLocaleString('en-IN')} K`;
      }
      return `${formatDecimal(thousands)} K`;
    }
    
    return `${Math.floor(num).toLocaleString('en-IN')}`;
  };
  
  let formattedPrice = `${currency} ${numberToWords(amount)}`;
  
  if (perUnit && perUnit !== 'total') {
    if (perUnit === 'sqft') formattedPrice += '/sq.ft';
    else if (perUnit === 'sqm') formattedPrice += '/sq.m';
    else if (perUnit === 'month') formattedPrice += '/month';
    else if (perUnit === 'perSqYard') formattedPrice += '/sq.yd';
    else if (perUnit === 'perGround') formattedPrice += '/ground';
  }
  
  return formattedPrice;
};
// Update property unit (Public)
const updatePropertyUnit = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find property unit
    const propertyUnit = await PropertyUnit.findById(id);
    if (!propertyUnit) {
      return res.status(404).json({
        success: false,
        message: 'Property unit not found'
      });
    }

    // Check permissions
    const isOwner = req.user._id.equals(propertyUnit.createdBy);
    const isAdmin = req.user.isAdmin === true;
    
    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this property unit'
      });
    }

    let updateData = {};
    
    // Parse JSON data from form
    let parsedData;
    if (req.body.data) {
      try {
        parsedData = JSON.parse(req.body.data);
      } catch (e) {
        console.error('Error parsing form data:', e);
        return res.status(400).json({
          success: false,
          message: 'Invalid form data format'
        });
      }
    } else {
      // If no data field, try to use req.body directly
      parsedData = req.body;
    }

    // ========== HANDLE IMAGE DELETION ==========
    // Delete images from Cloudinary if requested
    const deletedPublicIds = parsedData.deletedImages || [];
    const deletedDbIds = parsedData.deletedImageIds || [];
    
    // Get current images
    let currentImages = propertyUnit.images || [];
    
    // Filter out images that should be deleted from the array
    let remainingImages = currentImages;
    
    // Delete by database ID
    if (deletedDbIds.length > 0) {
      remainingImages = remainingImages.filter(img => !deletedDbIds.includes(img._id?.toString()));
    }
    
    // Delete by public_id - also need to remove them from Cloudinary
    if (deletedPublicIds.length > 0) {
      const cloudinary = require('cloudinary').v2;
      
      // Delete each image from Cloudinary
      for (const publicId of deletedPublicIds) {
        try {
          await cloudinary.uploader.destroy(publicId);
          console.log(`Deleted Cloudinary image: ${publicId}`);
        } catch (cloudinaryError) {
          console.error(`Failed to delete Cloudinary image ${publicId}:`, cloudinaryError);
          // Continue even if one deletion fails
        }
      }
      
      // Remove from the remaining images array
      remainingImages = remainingImages.filter(img => !deletedPublicIds.includes(img.public_id));
    }
    
    // Update the images array
    updateData.images = remainingImages;
    // ========== END IMAGE DELETION HANDLING ==========

    // If we have parsed data from the form
    if (parsedData) {
      // Handle basic fields
      const basicFields = [
        'title', 'description', 'city', 'address', 'mapUrl', 'locationNearby',
        'propertyType', 'listingType', 'availability', 'isFeatured', 'isVerified',
        'approvalStatus', 'rejectionReason', 'contactPreference', 'viewingSchedule',
        'displayOrder', 'unitFeatures'
      ];

      basicFields.forEach(field => {
        if (parsedData[field] !== undefined) {
          updateData[field] = parsedData[field];
        }
      });

      // Handle buildingDetails
      if (parsedData.buildingDetails) {
        updateData.buildingDetails = {
          name: parsedData.buildingDetails.name || '',
          totalFloors: parsedData.buildingDetails.totalFloors ? Number(parsedData.buildingDetails.totalFloors) : 0,
          totalUnits: parsedData.buildingDetails.totalUnits ? Number(parsedData.buildingDetails.totalUnits) : 0,
          yearBuilt: parsedData.buildingDetails.yearBuilt ? Number(parsedData.buildingDetails.yearBuilt) : 0,
          amenities: parsedData.buildingDetails.amenities || []
        };
      }

      // Handle commonSpecifications
      if (parsedData.commonSpecifications) {
        updateData.commonSpecifications = {
          furnishing: parsedData.commonSpecifications.furnishing || 'unfurnished',
          possessionStatus: parsedData.commonSpecifications.possessionStatus || 'ready-to-move',
          ageOfProperty: parsedData.commonSpecifications.ageOfProperty ? Number(parsedData.commonSpecifications.ageOfProperty) : 0,
          parking: {
            covered: parsedData.commonSpecifications.parking?.covered ? Number(parsedData.commonSpecifications.parking.covered) : 0,
            open: parsedData.commonSpecifications.parking?.open ? Number(parsedData.commonSpecifications.parking.open) : 0
          },
          kitchenType: parsedData.commonSpecifications.kitchenType || 'regular'
        };
      }

      // Handle ownerDetails
      if (parsedData.ownerDetails) {
        updateData.ownerDetails = {
          name: parsedData.ownerDetails.name || '',
          phoneNumber: parsedData.ownerDetails.phoneNumber || '',
          email: parsedData.ownerDetails.email || '',
          reasonForSelling: parsedData.ownerDetails.reasonForSelling || ''
        };
      }

      // Handle legalDetails
      if (parsedData.legalDetails) {
        updateData.legalDetails = {
          reraRegistered: parsedData.legalDetails.reraRegistered || false,
          reraNumber: parsedData.legalDetails.reraNumber || '',
          reraWebsiteLink: parsedData.legalDetails.reraWebsiteLink || '',
          sanctioningAuthority: parsedData.legalDetails.sanctioningAuthority || '',
          sanctionNumber: parsedData.legalDetails.sanctionNumber || '',
          sanctionDate: parsedData.legalDetails.sanctionDate || null,
          occupancyCertificate: parsedData.legalDetails.occupancyCertificate || false,
          occupancyCertificateNumber: parsedData.legalDetails.occupancyCertificateNumber || '',
          occupancyCertificateDate: parsedData.legalDetails.occupancyCertificateDate || null,
          commencementCertificate: parsedData.legalDetails.commencementCertificate || false,
          commencementCertificateNumber: parsedData.legalDetails.commencementCertificateNumber || '',
          commencementCertificateDate: parsedData.legalDetails.commencementCertificateDate || null,
          khataStatus: parsedData.legalDetails.khataStatus || 'Not Applicable',
          clearTitle: parsedData.legalDetails.clearTitle || false,
          motherDeedAvailable: parsedData.legalDetails.motherDeedAvailable || false,
          conversionCertificate: parsedData.legalDetails.conversionCertificate || false,
          conversionType: parsedData.legalDetails.conversionType || '',
          encumbranceCertificate: parsedData.legalDetails.encumbranceCertificate || false,
          encumbranceYears: parsedData.legalDetails.encumbranceYears ? Number(parsedData.legalDetails.encumbranceYears) : 0,
          ownershipType: parsedData.legalDetails.ownershipType || 'freehold',
          bankApprovals: parsedData.legalDetails.bankApprovals || [],
          legalStatusSummary: parsedData.legalDetails.legalStatusSummary || '',
          legalVerified: parsedData.legalDetails.legalVerified || false,
          legalVerificationDate: parsedData.legalDetails.legalVerificationDate || null,
          legalVerifier: parsedData.legalDetails.legalVerifier || ''
        };
      }

      // Handle unit types including plot details
      if (parsedData.unitTypes && Array.isArray(parsedData.unitTypes)) {
        updateData.unitTypes = parsedData.unitTypes.map(unit => {
          const baseUnit = {
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

          // Add plot details if this is a plot type
          if (unit.type === 'Plot') {
            baseUnit.plotDetails = {
              dimensions: {
                length: unit.plotDetails?.dimensions?.length ? Number(unit.plotDetails.dimensions.length) : 0,
                breadth: unit.plotDetails?.dimensions?.breadth ? Number(unit.plotDetails.dimensions.breadth) : 0,
                frontage: unit.plotDetails?.dimensions?.frontage ? Number(unit.plotDetails.dimensions.frontage) : 0
              },
              area: {
                sqft: unit.plotDetails?.area?.sqft ? Number(unit.plotDetails.area.sqft) : (unit.carpetArea ? Number(unit.carpetArea) : 0),
                sqYards: unit.plotDetails?.area?.sqYards ? Number(unit.plotDetails.area.sqYards) : 0,
                grounds: unit.plotDetails?.area?.grounds ? Number(unit.plotDetails.area.grounds) : 0,
                acres: unit.plotDetails?.area?.acres ? Number(unit.plotDetails.area.acres) : 0,
                cents: unit.plotDetails?.area?.cents ? Number(unit.plotDetails.area.cents) : 0
              },
              shape: unit.plotDetails?.shape || 'rectangle',
              facing: unit.plotDetails?.facing || '',
              isCornerPlot: unit.plotDetails?.isCornerPlot || false,
              cornerRoads: unit.plotDetails?.cornerRoads || [],
              roadWidth: unit.plotDetails?.roadWidth ? Number(unit.plotDetails.roadWidth) : 0,
              roadType: unit.plotDetails?.roadType || 'secondary',
              boundaryWalls: unit.plotDetails?.boundaryWalls || false,
              fencing: unit.plotDetails?.fencing || false,
              gate: unit.plotDetails?.gate || false,
              elevationAvailable: unit.plotDetails?.elevationAvailable || false,
              soilType: unit.plotDetails?.soilType || '',
              landUse: unit.plotDetails?.landUse || 'residential',
              developmentStatus: unit.plotDetails?.developmentStatus || 'developed',
              amenities: unit.plotDetails?.amenities || [],
              utilities: {
                electricity: unit.plotDetails?.utilities?.electricity || false,
                waterConnection: unit.plotDetails?.utilities?.waterConnection || false,
                sewageConnection: unit.plotDetails?.utilities?.sewageConnection || false,
                gasConnection: unit.plotDetails?.utilities?.gasConnection || false,
                internetFiber: unit.plotDetails?.utilities?.internetFiber || false
              },
              approvalDetails: {
                dtcpApproved: unit.plotDetails?.approvalDetails?.dtcpApproved || false,
                dtcpNumber: unit.plotDetails?.approvalDetails?.dtcpNumber || '',
                layoutApproved: unit.plotDetails?.approvalDetails?.layoutApproved || false,
                layoutNumber: unit.plotDetails?.approvalDetails?.layoutNumber || '',
                surveyNumber: unit.plotDetails?.approvalDetails?.surveyNumber || '',
                pattaNumber: unit.plotDetails?.approvalDetails?.pattaNumber || '',
                subdivisionApproved: unit.plotDetails?.approvalDetails?.subdivisionApproved || false
              }
            };
          }

          return baseUnit;
        });
      }

      // Handle viewing schedule
      if (parsedData.viewingSchedule && Array.isArray(parsedData.viewingSchedule)) {
        updateData.viewingSchedule = parsedData.viewingSchedule.map(slot => ({
          date: slot.date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          slotsAvailable: slot.slotsAvailable ? Number(slot.slotsAvailable) : 1
        }));
      }

      // Handle contact preference
      if (parsedData.contactPreference && Array.isArray(parsedData.contactPreference)) {
        updateData.contactPreference = parsedData.contactPreference;
      }
    }

    // Admin-only fields - only allow admin to modify these
    if (!isAdmin) {
      const adminOnlyFields = ['approvalStatus', 'isFeatured', 'isVerified', 'rejectionReason'];
      adminOnlyFields.forEach(field => {
        delete updateData[field];
      });
    }

    // Validate rejection reason
    if (isAdmin && updateData.approvalStatus === 'rejected' && !updateData.rejectionReason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required when rejecting a property unit'
      });
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
      
      // Merge remaining images (after deletions) with new ones
      updateData.images = [...(updateData.images || []), ...newImages];
    }

    // Remove undefined fields to avoid overwriting with empty values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    // Update the property unit
    const updatedPropertyUnit = await PropertyUnit.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email phoneNumber');

    res.status(200).json({
      success: true,
      message: 'Property unit updated successfully',
      data: updatedPropertyUnit
    });

  } catch (error) {
    console.error('Update property unit error:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate field value entered',
        error: error.keyPattern
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error updating property unit',
      error: error.message
    });
  }
};
// Delete property unit (Public)
const deletePropertyUnit = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find property unit
    const propertyUnit = await PropertyUnit.findById(id);
    if (!propertyUnit) {
      return res.status(404).json({
        success: false,
        message: 'Property unit not found'
      });
    }

    // Check permissions
    const isOwner = req.user._id.equals(propertyUnit.createdBy);
    const isAdmin = req.user.userType === 'admin' || req.user.userType === 'superadmin';
    
    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this property unit'
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

    // Delete floor plan from Cloudinary if exists
    if (propertyUnit.floorPlan && propertyUnit.floorPlan.public_id) {
      try {
        await cloudinary.uploader.destroy(propertyUnit.floorPlan.public_id);
      } catch (error) {
        console.error('Error deleting floor plan from Cloudinary:', error);
      }
    }

    // Delete from database
    await PropertyUnit.findByIdAndDelete(id);

    // Remove from user's postedProperties
    await User.findByIdAndUpdate(
      propertyUnit.createdBy,
      { $pull: { postedProperties: { property: id } } }
    );

    res.status(200).json({
      success: true,
      message: 'Property unit deleted successfully'
    });

  } catch (error) {
    console.error('Delete property unit error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting property unit',
      error: error.message
    });
  }


// Add to your exports

};
// Backend Controller - Get all property units without pagination
const getAllPropertyUnitsNoPagination = async (req, res) => {
  try {
    const {
      city,
      propertyType,
      minPrice,
      maxPrice,
      unitType,
      furnishing,
      possessionStatus,
      kitchenType,
      listingType,
      availability,
      isFeatured,
      isVerified,
      search: searchQuery,
      approvalStatus,
      createdBy,
      bedrooms,
      bathrooms,
      carpetAreaMin,
      carpetAreaMax,
      builtUpAreaMin,
      builtUpAreaMax,
      parkingSpaces,
      reraRegistered,
      khataStatus,
      ownershipType,
      plotLandUse,
      plotDevelopmentStatus,
      nearbyAmenity,
      nearbyDistanceMax,
      excludeBatch // New parameter to exclude units already in a batch
    } = req.query;

    // Build filter
    const filter = {};

    // User type check
    const isAdmin = req.user && (req.user.userType === 'admin' || req.user.userType === 'superadmin');

    // Set default filters for non-admin users
    if (!isAdmin) {
      filter.approvalStatus = 'approved';
      filter.availability = 'available';
    } else {
      if (approvalStatus) {
        filter.approvalStatus = approvalStatus;
      }
      if (availability) {
        filter.availability = availability;
      }
    }

    // Exclude units already in a batch - FIXED: Check if excludeBatch is valid
    if (excludeBatch && excludeBatch !== 'null' && excludeBatch !== 'undefined') {
      // Only add the filter if excludeBatch is a valid string
      filter.batchId = { $ne: excludeBatch };
    }

    // Apply basic filters (rest of your filters remain the same)
    if (city && city.trim() !== '') {
      filter.city = new RegExp(city.trim(), 'i');
    }
    
    if (propertyType && propertyType.trim() !== '') {
      filter.propertyType = propertyType.trim();
    }
    
    if (listingType && listingType.trim() !== '') {
      filter.listingType = listingType.trim();
    }
    
    // Filter by unit type
    if (unitType && unitType.trim() !== '') {
      filter['unitTypes.type'] = unitType.trim();
    }
    
    // Filter by bedrooms count
    if (bedrooms && !isNaN(bedrooms)) {
      const bedroomPattern = new RegExp(`${bedrooms}BHK`);
      filter['unitTypes.type'] = bedroomPattern;
    }
    
    // Price range filter
    if (minPrice || maxPrice) {
      filter['unitTypes.price.amount'] = {};
      if (minPrice && !isNaN(minPrice)) {
        filter['unitTypes.price.amount'].$gte = Number(minPrice);
      }
      if (maxPrice && !isNaN(maxPrice)) {
        filter['unitTypes.price.amount'].$lte = Number(maxPrice);
      }
    }
    
    // Area filters
    if (carpetAreaMin && !isNaN(carpetAreaMin)) {
      filter['unitTypes.carpetArea'] = { $gte: Number(carpetAreaMin) };
    }
    if (carpetAreaMax && !isNaN(carpetAreaMax)) {
      if (!filter['unitTypes.carpetArea']) filter['unitTypes.carpetArea'] = {};
      filter['unitTypes.carpetArea'].$lte = Number(carpetAreaMax);
    }
    
    if (builtUpAreaMin && !isNaN(builtUpAreaMin)) {
      filter['unitTypes.builtUpArea'] = { $gte: Number(builtUpAreaMin) };
    }
    if (builtUpAreaMax && !isNaN(builtUpAreaMax)) {
      if (!filter['unitTypes.builtUpArea']) filter['unitTypes.builtUpArea'] = {};
      filter['unitTypes.builtUpArea'].$lte = Number(builtUpAreaMax);
    }
    
    // Specifications filters
    if (furnishing && furnishing.trim() !== '') {
      filter['commonSpecifications.furnishing'] = furnishing.trim();
    }
    
    if (possessionStatus && possessionStatus.trim() !== '') {
      filter['commonSpecifications.possessionStatus'] = possessionStatus.trim();
    }
    
    if (kitchenType && kitchenType.trim() !== '') {
      filter['commonSpecifications.kitchenType'] = kitchenType.trim();
    }
    
    // Parking filter
    if (parkingSpaces && !isNaN(parkingSpaces)) {
      filter.$or = [
        { 'commonSpecifications.parking.covered': { $gte: Number(parkingSpaces) } },
        { 'commonSpecifications.parking.open': { $gte: Number(parkingSpaces) } }
      ];
    }
    
    // Legal filters
    if (reraRegistered !== undefined && reraRegistered !== '') {
      filter['legalDetails.reraRegistered'] = reraRegistered === 'true';
    }
    
    if (khataStatus && khataStatus.trim() !== '') {
      filter['legalDetails.khataStatus'] = khataStatus.trim();
    }
    
    if (ownershipType && ownershipType.trim() !== '') {
      filter['legalDetails.ownershipType'] = ownershipType.trim();
    }
    
    // Plot-specific filters
    if (plotLandUse && plotLandUse.trim() !== '') {
      filter['unitTypes.plotDetails.landUse'] = plotLandUse.trim();
    }
    
    if (plotDevelopmentStatus && plotDevelopmentStatus.trim() !== '') {
      filter['unitTypes.plotDetails.developmentStatus'] = plotDevelopmentStatus.trim();
    }
    
    // Nearby amenities filter
    if (nearbyAmenity && nearbyAmenity.trim() !== '') {
      const amenityFilter = { 'locationNearby.name': new RegExp(nearbyAmenity.trim(), 'i') };
      
      if (nearbyDistanceMax && !isNaN(nearbyDistanceMax)) {
        amenityFilter['locationNearby.distance'] = { 
          $regex: new RegExp(`^(0|[1-9]${nearbyDistanceMax})\\.?\\d*km?$`, 'i')
        };
      }
      
      filter.$and = filter.$and || [];
      filter.$and.push(amenityFilter);
    }
    
    // Admin-only filters
    if (isAdmin) {
      if (isFeatured !== undefined && isFeatured !== '') {
        filter.isFeatured = isFeatured === 'true';
      }
      if (isVerified !== undefined && isVerified !== '') {
        filter.isVerified = isVerified === 'true';
      }
    }
    
    // Search filter
    if (searchQuery && searchQuery.trim() !== '') {
      const searchRegex = new RegExp(searchQuery.trim(), 'i');
      filter.$or = [
        { title: searchRegex },
        { description: searchRegex },
        { address: searchRegex },
        { city: searchRegex },
        { 'buildingDetails.name': searchRegex },
        { 'unitTypes.type': searchRegex },
        { 'locationNearby.name': searchRegex }
      ];
    }
    
    // Filter by creator
    if (createdBy && createdBy.trim() !== '') {
      filter.createdBy = createdBy.trim();
    }

    // Build sort object
    let sort = { displayOrder: -1, createdAt: -1 };
    
    const sortBy = req.query.sortBy || 'displayOrder';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    
    const allowedSortFields = {
      'displayOrder': 'displayOrder',
      'createdAt': 'createdAt',
      'updatedAt': 'updatedAt',
      'title': 'title',
      'city': 'city',
      'listingType': 'listingType',
      'isFeatured': 'isFeatured',
      'isVerified': 'isVerified',
      'availability': 'availability',
      'price': 'unitTypes.price.amount',
      'carpetArea': 'unitTypes.carpetArea',
      'builtUpArea': 'unitTypes.builtUpArea',
      'viewCount': 'viewCount'
    };

    const sortField = allowedSortFields[sortBy] || 'displayOrder';
    
    if (sortField === 'displayOrder') {
      sort = { 
        [sortField]: sortOrder,
        'createdAt': -1
      };
    } else if (sortField === 'price') {
      sort = {
        'unitTypes.price.amount': sortOrder,
        displayOrder: -1
      };
    } else {
      sort = {
        [sortField]: sortOrder,
        displayOrder: -1,
        createdAt: -1
      };
    }

    // Execute query - NO PAGINATION, get ALL records
    const query = PropertyUnit.find(filter);
    
    if (Object.keys(sort).length > 0) {
      query.sort(sort);
    }
    
    const propertyUnits = await query
      .populate('createdBy', 'name email phoneNumber avatar')
      .lean();

    // Transform data for frontend compatibility (same as before)
    const transformedData = propertyUnits.map(unit => {
      const primaryUnitType = unit.unitTypes && unit.unitTypes.length > 0 
        ? unit.unitTypes.sort((a, b) => a.price.amount - b.price.amount)[0] 
        : null;
      
      const totalParking = (unit.commonSpecifications?.parking?.covered || 0) + 
                          (unit.commonSpecifications?.parking?.open || 0);
      
      const bedroomMatch = primaryUnitType?.type?.match(/\d+/);
      const bedroomsCount = bedroomMatch ? parseInt(bedroomMatch[0]) : 0;
      const bathroomsCount = bedroomsCount > 0 ? bedroomsCount : 1;
      
      return {
        ...unit,
        specifications: {
          furnishing: unit.commonSpecifications?.furnishing,
          possessionStatus: unit.commonSpecifications?.possessionStatus,
          kitchenType: unit.commonSpecifications?.kitchenType,
          parkingSpaces: totalParking,
          coveredParking: unit.commonSpecifications?.parking?.covered || 0,
          openParking: unit.commonSpecifications?.parking?.open || 0,
          carpetArea: primaryUnitType?.carpetArea || 0,
          builtUpArea: primaryUnitType?.builtUpArea || 0,
          superBuiltUpArea: primaryUnitType?.superBuiltUpArea || 0,
          bedrooms: bedroomsCount,
          bathrooms: bathroomsCount,
          floors: primaryUnitType?.floors || unit.buildingDetails?.totalFloors || 1,
          floorNumber: primaryUnitType?.floorNumber
        },
        price: primaryUnitType?.price || null,
        unitType: primaryUnitType?.type || null,
        totalUnits: primaryUnitType?.totalUnits || null,
        availableUnits: primaryUnitType?.availableUnits || null,
        plotDetails: unit.propertyType === 'Plot' && primaryUnitType?.plotDetails 
          ? primaryUnitType.plotDetails 
          : null,
        locationNearby: unit.locationNearby || [],
        buildingDetails: unit.buildingDetails || null,
        unitFeatures: unit.unitFeatures || [],
        legalDetails: unit.legalDetails || null,
        unitTypes: unit.unitTypes,
        hasMultipleUnitTypes: unit.unitTypes && unit.unitTypes.length > 1,
        unitTypeCount: unit.unitTypes?.length || 0
      };
    });

    // Get unique filter options from the actual data
    const cities = [...new Set(transformedData.map(unit => unit.city).filter(Boolean))];
    const propertyTypes = [...new Set(transformedData.map(unit => unit.propertyType).filter(Boolean))];
    
    // Get bedroom options
    const bedroomOptions = [...new Set(
      transformedData
        .map(unit => unit.specifications?.bedrooms)
        .filter(beds => beds && beds > 0)
        .sort((a, b) => a - b)
    )];

    res.status(200).json({
      success: true,
      count: transformedData.length,
      total: transformedData.length,
      data: transformedData,
      filters: {
        cities: cities,
        propertyTypes: propertyTypes,
        bedroomOptions: bedroomOptions
      }
    });

  } catch (error) {
    console.error('Get all property units error:', error);
    console.error('Error stack:', error.stack);
    
    res.status(500).json({
      success: false,
      message: 'Error fetching property units',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};




module.exports = {
  createPropertyUnit,
  getPropertyUnits,
  getPropertyUnitById,
  updatePropertyUnit,
  deletePropertyUnit,  
getFeaturedPropertyUnits,
createPropertyUnitN8n,getAllPropertyUnitsNoPagination
};