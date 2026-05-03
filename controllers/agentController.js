const Agent = require("../models/Agent");
const Property = require("../models/property");
const User = require("../models/user");
const cloudinary = require("cloudinary").v2;

// Admin creates property with all fields including images and agent details
exports.createPropertyByAdmin = async (req, res) => {
  try {
    console.log('Admin creating property, user:', req.user);
    console.log('Files received:', req.files);

    const {
      title,
      description,
      content,
      city,
      propertyLocation,
      coordinates,
      price,
      mapUrl,
      category,
      approvalStatus,
      displayOrder,
      forSale,
      isFeatured,
      isVerified,
      rejectionReason,
      agentDetails,
      attributes,
      distanceKey,
      features,
      nearby
    } = req.body;

    // Validate required fields
    if (!title || !city || !propertyLocation || !price || !category) {
      return res.status(400).json({
        success: false,
        message: "Required fields are missing: title, city, propertyLocation, price, category"
      });
    }

    // Validate category enum
    const validCategories = ["Outright", "Commercial", "Farmland", "JD/JV"];
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category. Must be one of: Outright, Commercial, Farmland, JD/JV"
      });
    }

    // Upload images to Cloudinary
    const uploadedImages = [];
    if (req.files && req.files.length > 0) {
      console.log(`Uploading ${req.files.length} images to Cloudinary...`);
      
      for (let file of req.files) {
        try {
          const result = await cloudinary.uploader.upload(file.path, {
            folder: "properties",
            quality: "auto",
            fetch_format: "auto"
          });
          uploadedImages.push({
            url: result.secure_url,
            public_id: result.public_id,
          });
          console.log(`Image uploaded successfully: ${result.secure_url}`);
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

    // Parse JSON fields with error handling
    let parsedAttributes = {};
    let parsedNearby = {};
    let parsedCoordinates = {};
    let parsedDistanceKey = [];
    let parsedFeatures = [];
    let parsedAgentDetails = {};

    try {
      parsedAttributes = attributes ? JSON.parse(attributes) : {};
      parsedNearby = nearby ? JSON.parse(nearby) : {};
      parsedCoordinates = coordinates ? JSON.parse(coordinates) : {};
      parsedDistanceKey = distanceKey ? JSON.parse(distanceKey) : [];
      parsedFeatures = features ? JSON.parse(features) : [];
      parsedAgentDetails = agentDetails ? JSON.parse(agentDetails) : {};
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return res.status(400).json({
        success: false,
        message: 'Invalid JSON format in one of the fields'
      });
    }

    // Validate agent details if provided
    if (parsedAgentDetails.agentId) {
      const agent = await Agent.findById(parsedAgentDetails.agentId);
      if (!agent) {
        return res.status(400).json({
          success: false,
          message: 'Referenced agent not found'
        });
      }
      
      // Auto-populate agent details from agent model if not provided
      if (!parsedAgentDetails.name) {
        parsedAgentDetails.name = agent.name;
      }
      if (!parsedAgentDetails.phoneNumber) {
        parsedAgentDetails.phoneNumber = agent.phoneNumber;
      }
      if (!parsedAgentDetails.email) {
        parsedAgentDetails.email = agent.email;
      }
      if (!parsedAgentDetails.company && agent.company) {
        parsedAgentDetails.company = agent.company;
      }
      if (!parsedAgentDetails.languages && agent.languages) {
        parsedAgentDetails.languages = agent.languages;
      }
      if (!parsedAgentDetails.officeAddress && agent.officeAddress) {
        parsedAgentDetails.officeAddress = agent.officeAddress;
      }
      
      // Increment agent's properties count
      await agent.incrementPropertiesCount();
    }

    // Validate features based on category
    const validFeatures = {
      Commercial: [
        "Conference Room", "CCTV Surveillance", "Power Backup", "Fire Safety",
        "Cafeteria", "Reception Area", "Parking", "Lift(s)"
      ],
      Farmland: [
        "Borewell", "Fencing", "Electricity Connection", "Water Source",
        "Drip Irrigation", "Storage Shed"
      ],
      Outright: [
        "Highway Access", "Legal Assistance", "Joint Development Approved",
        "Investor Friendly", "Gated Boundary"
      ],
      "JD/JV": [
        "Highway Access", "Legal Assistance", "Joint Development Approved",
        "Investor Friendly", "Gated Boundary"
      ]
    };

    // Filter features to only include valid ones for the category
    const categoryFeatures = validFeatures[category] || [];
    const filteredFeatures = parsedFeatures.filter(feature => 
      categoryFeatures.includes(feature)
    );

    // Create property with all fields including uploaded images
    const property = new Property({
      title,
      description: description || "",
      content: content || "",
      images: uploadedImages,
      city,
      propertyLocation,
      coordinates: parsedCoordinates || {},
      price,
      mapUrl: mapUrl || "",
      category,
      approvalStatus: approvalStatus || "approved",
      displayOrder: displayOrder || 0,
      forSale: forSale !== undefined ? forSale : true,
      isFeatured: isFeatured || false,
      isVerified: isVerified || false,
      rejectionReason: rejectionReason || "",
      agentDetails: parsedAgentDetails,
      attributes: {
        square: parsedAttributes?.square || "",
        propertyLabel: parsedAttributes?.propertyLabel || "",
        leaseDuration: parsedAttributes?.leaseDuration || "",
        typeOfJV: parsedAttributes?.typeOfJV || "",
        expectedROI: parsedAttributes?.expectedROI || null,
        irrigationAvailable: parsedAttributes?.irrigationAvailable || false,
        facing: parsedAttributes?.facing || "",
        roadWidth: parsedAttributes?.roadWidth || null,
        waterSource: parsedAttributes?.waterSource || "",
        soilType: parsedAttributes?.soilType || "",
        legalClearance: parsedAttributes?.legalClearance || false,
      },
      distanceKey: parsedDistanceKey || [],
      features: filteredFeatures || [],
      nearby: {
        Highway: parsedNearby?.Highway || null,
        Airport: parsedNearby?.Airport || null,
        BusStop: parsedNearby?.BusStop || null,
        Metro: parsedNearby?.Metro || null,
        CityCenter: parsedNearby?.CityCenter || null,
        IndustrialArea: parsedNearby?.IndustrialArea || null,
      },
      createdBy: req.user.id,
    });

    await property.save();

    // Populate the property with creator and agent details
    await property.populate('createdBy', 'name username userType');
    if (property.agentDetails.agentId) {
      await property.populate('agentDetails.agentId', 'name phoneNumber email company languages officeAddress');
    }

    res.status(201).json({
      success: true,
      message: "Property created successfully with agent details",
      data: property
    });

  } catch (error) {
    console.error("Error creating property:", error);
    
    // Clean up uploaded images if property creation fails
    if (req.files && req.files.length > 0) {
      console.log('Cleaning up uploaded images due to error...');
      // Add cleanup logic here if needed
    }
    
    res.status(500).json({
      success: false,
      message: "Error creating property",
      error: error.message
    });
  }
};

// Update property with all fields including agent details
exports.updatePropertyByAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      content,
      city,
      propertyLocation,
      coordinates,
      price,
      mapUrl,
      category,
      approvalStatus,
      displayOrder,
      forSale,
      isFeatured,
      isVerified,
      rejectionReason,
      agentDetails,
      attributes,
      distanceKey,
      features,
      nearby
    } = req.body;

    // Find existing property
    const existingProperty = await Property.findById(id);
    if (!existingProperty) {
      return res.status(404).json({
        success: false,
        message: "Property not found"
      });
    }

    // Upload new images to Cloudinary if provided
    let uploadedImages = [];
    if (req.files && req.files.length > 0) {
      console.log(`Uploading ${req.files.length} new images to Cloudinary...`);
      
      for (let file of req.files) {
        try {
          const result = await cloudinary.uploader.upload(file.path, {
            folder: "properties",
            quality: "auto",
            fetch_format: "auto"
          });
          uploadedImages.push({
            url: result.secure_url,
            public_id: result.public_id,
          });
        } catch (uploadError) {
          console.error('Cloudinary upload error:', uploadError);
          return res.status(500).json({
            success: false,
            message: 'Error uploading images to Cloudinary'
          });
        }
      }
    }

    // Parse JSON fields with error handling
    let parsedAttributes = {};
    let parsedNearby = {};
    let parsedCoordinates = {};
    let parsedDistanceKey = [];
    let parsedFeatures = [];
    let parsedAgentDetails = {};

    try {
      parsedAttributes = attributes ? JSON.parse(attributes) : existingProperty.attributes;
      parsedNearby = nearby ? JSON.parse(nearby) : existingProperty.nearby;
      parsedCoordinates = coordinates ? JSON.parse(coordinates) : existingProperty.coordinates;
      parsedDistanceKey = distanceKey ? JSON.parse(distanceKey) : existingProperty.distanceKey;
      parsedFeatures = features ? JSON.parse(features) : existingProperty.features;
      parsedAgentDetails = agentDetails ? JSON.parse(agentDetails) : existingProperty.agentDetails;
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return res.status(400).json({
        success: false,
        message: 'Invalid JSON format in one of the fields'
      });
    }

    // Handle agent details changes
    if (agentDetails !== undefined) {
      const oldAgentId = existingProperty.agentDetails?.agentId;
      const newAgentId = parsedAgentDetails.agentId;

      // If agent is being changed or set
      if (newAgentId && newAgentId !== oldAgentId?.toString()) {
        const agent = await Agent.findById(newAgentId);
        if (!agent) {
          return res.status(400).json({
            success: false,
            message: 'Referenced agent not found'
          });
        }

        // Auto-populate agent details from agent model if not provided
        if (!parsedAgentDetails.name) {
          parsedAgentDetails.name = agent.name;
        }
        if (!parsedAgentDetails.phoneNumber) {
          parsedAgentDetails.phoneNumber = agent.phoneNumber;
        }
        if (!parsedAgentDetails.email) {
          parsedAgentDetails.email = agent.email;
        }
        if (!parsedAgentDetails.company && agent.company) {
          parsedAgentDetails.company = agent.company;
        }
        if (!parsedAgentDetails.languages && agent.languages) {
          parsedAgentDetails.languages = agent.languages;
        }
        if (!parsedAgentDetails.officeAddress && agent.officeAddress) {
          parsedAgentDetails.officeAddress = agent.officeAddress;
        }

        // Increment new agent's properties count
        await agent.incrementPropertiesCount();
      }

      // Decrement old agent's properties count if agent changed or removed
      if (oldAgentId && oldAgentId.toString() !== newAgentId) {
        const oldAgent = await Agent.findById(oldAgentId);
        if (oldAgent) {
          await oldAgent.decrementPropertiesCount();
        }
      }
    }

    // Build update object
    const updateData = {};
    
    // Basic fields
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (content !== undefined) updateData.content = content;
    if (city !== undefined) updateData.city = city;
    if (propertyLocation !== undefined) updateData.propertyLocation = propertyLocation;
    if (coordinates !== undefined) updateData.coordinates = parsedCoordinates;
    if (price !== undefined) updateData.price = price;
    if (mapUrl !== undefined) updateData.mapUrl = mapUrl;
    if (category !== undefined) updateData.category = category;
    if (approvalStatus !== undefined) updateData.approvalStatus = approvalStatus;
    if (displayOrder !== undefined) updateData.displayOrder = displayOrder;
    if (forSale !== undefined) updateData.forSale = forSale;
    if (isFeatured !== undefined) updateData.isFeatured = isFeatured;
    if (isVerified !== undefined) updateData.isVerified = isVerified;
    if (rejectionReason !== undefined) updateData.rejectionReason = rejectionReason;
    
    // Handle images - if new images uploaded, replace all images
    if (uploadedImages.length > 0) {
      // Delete old images from Cloudinary
      for (let image of existingProperty.images) {
        try {
          await cloudinary.uploader.destroy(image.public_id);
        } catch (deleteError) {
          console.error('Error deleting old image:', deleteError);
        }
      }
      updateData.images = uploadedImages;
    }
    
    // Agent details
    if (agentDetails !== undefined) {
      updateData.agentDetails = parsedAgentDetails;
    }
    
    // Attributes
    if (attributes !== undefined) {
      updateData.attributes = parsedAttributes;
    }
    
    // Arrays
    if (distanceKey !== undefined) updateData.distanceKey = parsedDistanceKey;
    if (features !== undefined) updateData.features = parsedFeatures;
    
    // Nearby
    if (nearby !== undefined) {
      updateData.nearby = parsedNearby;
    }

    const property = await Property.findByIdAndUpdate(
      id,
      { $set: updateData },
      { 
        new: true, 
        runValidators: true,
        context: 'query'
      }
    )
    .populate('createdBy', 'name username userType')
    .populate('agentDetails.agentId', 'name phoneNumber email company languages officeAddress');

    res.json({
      success: true,
      message: "Property updated successfully",
      data: property
    });

  } catch (error) {
    console.error("Error updating property:", error);
    res.status(500).json({
      success: false,
      message: "Error updating property",
      error: error.message
    });
  }
};

// Get properties with agent details and all fields
exports.getPropertiesWithAgents = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      city,
      hasAgent = false,
      approvalStatus,
      forSale,
      isFeatured,
      isVerified,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      agentName,
      agentCompany
    } = req.query;

    console.log('📥 Received query parameters:', req.query);

    const filter = {};
    
    // Build filter object
    if (category) filter.category = category;
    if (city) filter.city = new RegExp(city, 'i');
    if (approvalStatus) filter.approvalStatus = approvalStatus;
    if (forSale !== undefined) filter.forSale = forSale === 'true';
    if (isFeatured !== undefined) filter.isFeatured = isFeatured === 'true';
    if (isVerified !== undefined) filter.isVerified = isVerified === 'true';
    
    // Agent-related filters
    if (hasAgent === 'true') {
      filter['agentDetails.name'] = { $exists: true, $ne: '' };
    } else if (hasAgent === 'false') {
      filter['agentDetails.name'] = { $exists: false };
    }
    
    if (agentName) {
      filter['agentDetails.name'] = new RegExp(agentName, 'i');
    }
    if (agentCompany) {
      filter['agentDetails.company'] = new RegExp(agentCompany, 'i');
    }

    console.log('🔍 Final filter object:', JSON.stringify(filter, null, 2));

    // Build sort object
    const sort = {};
    if (sortBy === 'displayOrder') {
      sort.displayOrder = -1;
      sort.createdAt = -1;
    } else if (sortBy === 'price') {
      sort.price = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'title') {
      sort.title = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'agentName') {
      sort['agentDetails.name'] = sortOrder === 'asc' ? 1 : -1;
    } else {
      sort.createdAt = sortOrder === 'asc' ? 1 : -1;
    }

    console.log('📊 Sort object:', sort);

    const properties = await Property.find(filter)
      .populate('createdBy', 'name username userType email phoneNumber')
      .populate('agentDetails.agentId', 'name phoneNumber email company languages officeAddress')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    console.log('✅ Found properties:', properties.length);
    
    const total = await Property.countDocuments(filter);
    console.log('📈 Total properties matching filter:', total);

    res.json({
      success: true,
      data: properties,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalProperties: total,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error("❌ Error fetching properties:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching properties",
      error: error.message
    });
  }
};

// Get single property by ID with all details including agent
exports.getPropertyById = async (req, res) => {
  try {
    const { id } = req.params;

    const property = await Property.findById(id)
      .populate('createdBy', 'name username userType email phoneNumber')
      .populate('agentDetails.agentId', 'name phoneNumber email company languages officeAddress');

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found"
      });
    }

    res.json({
      success: true,
      data: property
    });

  } catch (error) {
    console.error("Error fetching property:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching property",
      error: error.message
    });
  }
};

// Delete property by admin
exports.deletePropertyByAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const property = await Property.findById(id);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found"
      });
    }

    // Delete images from Cloudinary
    for (let image of property.images) {
      try {
        await cloudinary.uploader.destroy(image.public_id);
      } catch (deleteError) {
        console.error('Error deleting image from Cloudinary:', deleteError);
      }
    }

    // Decrement agent's properties count if exists
    if (property.agentDetails?.agentId) {
      const agent = await Agent.findById(property.agentDetails.agentId);
      if (agent) {
        await agent.decrementPropertiesCount();
      }
    }

    await Property.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "Property deleted successfully",
      data: property
    });

  } catch (error) {
    console.error("Error deleting property:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting property",
      error: error.message
    });
  }
};

// Get agents list for admin (from Agent model)
// Get agents list for admin (from Agent model)
exports.getAgentsList = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      isActive = 'true'
    } = req.query;

    console.log('📥 Agent list query parameters:', req.query);

    // Build filter object
    const filter = {};
    
    // Handle isActive filter - convert string to boolean
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }
    
    // Handle search filter
    if (search) {
      filter.$or = [
        { name: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') },
        { company: new RegExp(search, 'i') },
        { phoneNumber: new RegExp(search, 'i') }
      ];
    }

    console.log('🔍 Agent filter:', JSON.stringify(filter, null, 2));

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    console.log(`📊 Pagination: skip=${skip}, limit=${limitNum}`);

    // Get agents with pagination
    const agents = await Agent.find(filter)
      .select('name phoneNumber email company languages officeAddress isActive propertiesCount createdAt')
      .sort({ name: 1 })
      .limit(limitNum)
      .skip(skip)
      .lean();

    console.log(`✅ Found ${agents.length} agents in database`);

    // Get total count for pagination
    const total = await Agent.countDocuments(filter);
    console.log(`📈 Total agents matching filter: ${total}`);

    // If no agents found, return empty array
    if (agents.length === 0) {
      return res.json({
        success: true,
        data: [],
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limitNum),
          totalAgents: total,
          hasNextPage: page * limitNum < total,
          hasPrevPage: page > 1
        }
      });
    }

    // Get properties for each agent
    console.log('🔄 Fetching properties for each agent...');
    const agentsWithProperties = await Promise.all(
      agents.map(async (agent) => {
        try {
          const properties = await Property.find({ 
            'agentDetails.agentId': agent._id 
          }).select('title city category approvalStatus images price');
          
          console.log(`📋 Agent ${agent.name} has ${properties.length} properties`);
          
          return {
            ...agent,
            postedProperties: properties,
            propertiesCount: properties.length
          };
        } catch (error) {
          console.error(`❌ Error fetching properties for agent ${agent._id}:`, error);
          return {
            ...agent,
            postedProperties: [],
            propertiesCount: 0
          };
        }
      })
    );

    console.log('✅ Successfully processed all agents with properties');

    res.json({
      success: true,
      data: agentsWithProperties,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limitNum),
        totalAgents: total,
        hasNextPage: page * limitNum < total,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error("❌ Error fetching agents:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching agents list",
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};
// Get property statistics for admin dashboard
exports.getPropertyStats = async (req, res) => {
  try {
    const stats = await Property.aggregate([
      {
        $group: {
          _id: null,
          totalProperties: { $sum: 1 },
          totalApproved: { 
            $sum: { $cond: [{ $eq: ["$approvalStatus", "approved"] }, 1, 0] } 
          },
          totalPending: { 
            $sum: { $cond: [{ $eq: ["$approvalStatus", "pending"] }, 1, 0] } 
          },
          totalRejected: { 
            $sum: { $cond: [{ $eq: ["$approvalStatus", "rejected"] }, 1, 0] } 
          },
          totalFeatured: { 
            $sum: { $cond: ["$isFeatured", 1, 0] } 
          },
          totalVerified: { 
            $sum: { $cond: ["$isVerified", 1, 0] } 
          },
          totalWithAgents: {
            $sum: { 
              $cond: [
                { $and: [
                  { $ifNull: ["$agentDetails.name", false] },
                  { $ne: ["$agentDetails.name", ""] }
                ]}, 
                1, 0 
              ] 
            }
          },
          totalWithRegisteredAgents: {
            $sum: { 
              $cond: [
                { $ifNull: ["$agentDetails.agentId", false] }, 
                1, 0 
              ] 
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          totalProperties: 1,
          totalApproved: 1,
          totalPending: 1,
          totalRejected: 1,
          totalFeatured: 1,
          totalVerified: 1,
          totalWithAgents: 1,
          totalWithRegisteredAgents: 1
        }
      }
    ]);

    const categoryStats = await Property.aggregate([
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 }
        }
      }
    ]);

    const agentStats = await Property.aggregate([
      {
        $match: {
          "agentDetails.agentId": { $exists: true }
        }
      },
      {
        $lookup: {
          from: "agents",
          localField: "agentDetails.agentId",
          foreignField: "_id",
          as: "agent"
        }
      },
      {
        $unwind: "$agent"
      },
      {
        $group: {
          _id: "$agent._id",
          agentName: { $first: "$agent.name" },
          propertyCount: { $sum: 1 },
          company: { $first: "$agent.company" }
        }
      },
      {
        $sort: { propertyCount: -1 }
      },
      {
        $limit: 10
      }
    ]);

    res.json({
      success: true,
      data: {
        overall: stats[0] || {},
        byCategory: categoryStats,
        topAgents: agentStats
      }
    });

  } catch (error) {
    console.error("Error fetching property stats:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching property statistics",
      error: error.message
    });
  }
};

// Assign agent to property
exports.assignAgentToProperty = async (req, res) => {
  try {
    const { id } = req.params;
    const { agentId, agentDetails } = req.body;

    if (!agentId && !agentDetails) {
      return res.status(400).json({
        success: false,
        message: "Either agentId or agentDetails is required"
      });
    }

    const property = await Property.findById(id);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found"
      });
    }

    let updateData = {};
    let agent;

    if (agentId) {
      // Existing agent
      agent = await Agent.findById(agentId);
      if (!agent) {
        return res.status(400).json({
          success: false,
          message: 'Agent not found'
        });
      }

      updateData.agentDetails = {
        agentId: agent._id,
        name: agent.name,
        phoneNumber: agent.phoneNumber,
        alternativePhoneNumber: agent.alternativePhoneNumber,
        email: agent.email,
        company: agent.company,
        languages: agent.languages,
        officeAddress: agent.officeAddress
      };

      // Increment agent's properties count
      await agent.incrementPropertiesCount();

    } else {
      // Create new agent from manual details
      const { name, phoneNumber, alternativePhoneNumber, email, company, languages, officeAddress } = agentDetails;

      if (!name || !phoneNumber || !email) {
        return res.status(400).json({
          success: false,
          message: 'Name, phoneNumber, and email are required for new agent'
        });
      }

      // Check if agent with same email or phone exists
      const existingAgent = await Agent.findOne({
        $or: [
          { email: email.toLowerCase() },
          { phoneNumber: phoneNumber }
        ]
      });

      if (existingAgent) {
        // Use existing agent
        agent = existingAgent;
        updateData.agentDetails = {
          agentId: agent._id,
          name: agent.name,
          phoneNumber: agent.phoneNumber,
          alternativePhoneNumber: agent.alternativePhoneNumber,
          email: agent.email,
          company: agent.company,
          languages: agent.languages,
          officeAddress: agent.officeAddress
        };
      } else {
        // Create new agent
        agent = new Agent({
          name,
          phoneNumber,
          alternativePhoneNumber,
          email: email.toLowerCase(),
          company,
          languages: languages || [],
          officeAddress: officeAddress || {}
        });

        await agent.save();

        updateData.agentDetails = {
          agentId: agent._id,
          name: agent.name,
          phoneNumber: agent.phoneNumber,
          alternativePhoneNumber: agent.alternativePhoneNumber,
          email: agent.email,
          company: agent.company,
          languages: agent.languages,
          officeAddress: agent.officeAddress
        };
      }

      // Increment properties count
      await agent.incrementPropertiesCount();
    }

    // Remove property from old agent's count if exists
    if (property.agentDetails?.agentId) {
      const oldAgent = await Agent.findById(property.agentDetails.agentId);
      if (oldAgent) {
        await oldAgent.decrementPropertiesCount();
      }
    }

    const updatedProperty = await Property.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    )
    .populate('agentDetails.agentId', 'name phoneNumber email company languages officeAddress');

    res.json({
      success: true,
      message: agentId ? "Agent assigned to property successfully" : "New agent created and assigned to property",
      data: updatedProperty
    });

  } catch (error) {
    console.error("Error assigning agent:", error);
    res.status(500).json({
      success: false,
      message: "Error assigning agent to property",
      error: error.message
    });
  }
};

// Create new agent
exports.createAgent = async (req, res) => {
  try {
    const {
      name,
      phoneNumber,
      alternativePhoneNumber,
      email,
      company,
      languages,
      officeAddress
    } = req.body;

    // Check if agent with same email or phone exists
    const existingAgent = await Agent.findOne({
      $or: [
        { email: email.toLowerCase() },
        { phoneNumber: phoneNumber }
      ]
    });

    if (existingAgent) {
      return res.status(400).json({
        success: false,
        message: 'Agent with this email or phone number already exists'
      });
    }

    const agent = new Agent({
      name,
      phoneNumber,
      alternativePhoneNumber,
      email: email.toLowerCase(),
      company,
      languages: languages || [],
      officeAddress: officeAddress || {}
    });

    await agent.save();

    res.status(201).json({
      success: true,
      message: "Agent created successfully",
      data: agent
    });

  } catch (error) {
    console.error("Error creating agent:", error);
    res.status(500).json({
      success: false,
      message: "Error creating agent",
      error: error.message
    });
  }
};

// Update agent
exports.updateAgent = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (updateData.email) {
      updateData.email = updateData.email.toLowerCase();
    }

    const agent = await Agent.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: "Agent not found"
      });
    }

    res.json({
      success: true,
      message: "Agent updated successfully",
      data: agent
    });

  } catch (error) {
    console.error("Error updating agent:", error);
    res.status(500).json({
      success: false,
      message: "Error updating agent",
      error: error.message
    });
  }
};

// Delete agent
exports.deleteAgent = async (req, res) => {
  try {
    const { id } = req.params;

    const agent = await Agent.findById(id);
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: "Agent not found"
      });
    }

    // Check if agent has properties assigned
    const propertiesCount = await Property.countDocuments({ 
      'agentDetails.agentId': id 
    });

    if (propertiesCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete agent. ${propertiesCount} properties are still assigned to this agent.`
      });
    }

    await Agent.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "Agent deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting agent:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting agent",
      error: error.message
    });
  }
};






// Create Agent
exports.createAgent = async (req, res) => {
  try {
    const agent = await Agent.create(req.body);
    res.status(201).json({ success: true, data: agent });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Get all agents (with search + pagination)
exports.getAllAgents = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "" } = req.query;

    const query = search
      ? {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { phoneNumber: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
            { company: { $regex: search, $options: "i" } }
          ],
        }
      : {};

    const agents = await Agent.find(query)
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    const total = await Agent.countDocuments(query);

    res.status(200).json({
      success: true,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      data: agents,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get single agent by ID
exports.getAgentById = async (req, res) => {
  try {
    const agent = await Agent.findById(req.params.id).populate("properties");

    if (!agent) {
      return res.status(404).json({ success: false, message: "Agent not found" });
    }

    res.status(200).json({ success: true, data: agent });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update Agent
exports.updateAgent = async (req, res) => {
  try {
    const agent = await Agent.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!agent) {
      return res.status(404).json({ success: false, message: "Agent not found" });
    }

    res.status(200).json({ success: true, data: agent });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Delete Agent
exports.deleteAgent = async (req, res) => {
  try {
    const agent = await Agent.findByIdAndDelete(req.params.id);

    if (!agent) {
      return res.status(404).json({ success: false, message: "Agent not found" });
    }

    res.status(200).json({ success: true, message: "Agent deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all properties of an agent
exports.getAgentProperties = async (req, res) => {
  try {
    const agent = await Agent.findById(req.params.id).populate("properties");

    if (!agent) {
      return res.status(404).json({ success: false, message: "Agent not found" });
    }

    res.status(200).json({ success: true, data: agent.properties });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};




// controllers/agentController.js

// @desc    Apply for agent status (called when user selects agent type)
// @route   POST /api/users/apply-agent
// @access  Private
exports.applyForAgentStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const { referralCode } = req.body;

    console.log('Applying for agent - User ID:', userId);
    console.log('Referral code provided:', referralCode);

    // Get user details
    const user = await User.findById(userId);
    if (!user) {
      console.log('User not found:', userId);
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log('User found:', user.email, 'User type:', user.userType);

    // Check if user already has an agent profile
    const existingAgent = await Agent.findOne({ user: userId });
    if (existingAgent) {
      console.log('Existing agent profile found:', existingAgent.agentId);
      return res.status(400).json({
        success: false,
        message: 'You already have an agent profile',
        data: {
          agentId: existingAgent.agentId,
          referralCode: existingAgent.referralCode
        }
      });
    }

    // Check if user type is agent
    if (user.userType !== 'agent') {
      console.log('User type is not agent:', user.userType);
      return res.status(400).json({
        success: false,
        message: 'Please set your user type to "agent" first'
      });
    }

    // Process referral if provided (OPTIONAL - no error if invalid)
    let referredByAgent = null;
    let referringAgentData = null;
    
    if (referralCode && referralCode.trim() !== '') {
      console.log('Looking for referring agent with code:', referralCode);
      const referringAgent = await Agent.findOne({ referralCode: referralCode })
        .populate('user', 'name email');
      
      if (referringAgent) {
        referredByAgent = referringAgent._id;
        referringAgentData = {
          name: referringAgent.name,
          agentId: referringAgent.agentId,
          referralCode: referringAgent.referralCode
        };
        
        console.log('Referring agent found:', referringAgent.agentId);
        
        // Add referral to the referring agent
        await referringAgent.addReferral(userId, null);
      } else {
        console.log('Invalid referral code provided, continuing without referral');
        // Invalid referral code - just ignore and continue
      }
    }

    // Create agent profile - let the pre-save hook generate agentId and referralCode
    console.log('Creating agent profile for user:', userId);
    
    const agentData = {
      user: userId,
      name: user.name,
      email: user.gmail,
      phoneNumber: user.phoneNumber,
      referredBy: referredByAgent,
      isActive: true,
      company: user.company || '',
      officeAddress: user.officeAddress || {},
      specializationAreas: user.specialization || []
    };

    console.log('Agent data being saved:', JSON.stringify(agentData, null, 2));

    const agent = await Agent.create(agentData);
    
    console.log('Agent created successfully:', {
      id: agent._id,
      agentId: agent.agentId,
      referralCode: agent.referralCode
    });

    // Update user with agent profile reference
    user.agentProfile = agent._id;
    user.agentApproval = {
      status: 'approved',
      appliedAt: new Date(),
      reviewedAt: new Date()
    };
    await user.save();

    console.log('User updated with agent profile reference');

    // Return only the agent data - NO URL LINKS
    res.status(201).json({
      success: true,
      message: 'Agent profile created successfully!',
      data: {
        agentId: agent.agentId,
        referralCode: agent.referralCode,
        referredBy: referringAgentData,
        agentDetails: {
          id: agent._id,
          name: agent.name,
          email: agent.email,
          phoneNumber: agent.phoneNumber
        }
      }
    });
  } catch (error) {
    console.error('Apply for agent status error:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    
    res.status(500).json({
      success: false,
      message: 'Error creating agent profile',
      error: error.message
    });
  }
};

// @desc    Check if user has agent profile
// @route   GET /api/users/check-agent-status
// @access  Private
exports.checkAgentStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const agent = await Agent.findOne({ user: userId })
      .populate('referredBy', 'name agentId referralCode');
    
    if (agent) {
      return res.status(200).json({
        success: true,
        hasAgentProfile: true,
        data: {
          agentId: agent.agentId,
          referralCode: agent.referralCode,
          referralCount: agent.referralCount,
          rewards: agent.rewards,
          referredBy: agent.referredBy,
          createdAt: agent.createdAt
        }
      });
    }
    
    res.status(200).json({
      success: true,
      hasAgentProfile: false
    });
  } catch (error) {
    console.error('Check agent status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking agent status'
    });
  }
};

// @desc    Get agent profile
// @route   GET /api/agent/profile
// @access  Private
exports.getAgentProfile = async (req, res) => {
  try {
    const agent = await Agent.findOne({ user: req.user.id })
      .populate('user', 'name email phoneNumber username avatar')
      .populate('referredBy', 'name agentId referralCode')
      .populate('referralHistory.referredUser', 'name email')
      .populate('referralHistory.referredAgent', 'name agentId');

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent profile not found'
      });
    }

    res.status(200).json({
      success: true,
      data: agent
    });
  } catch (error) {
    console.error('Get agent profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching agent profile',
      error: error.message
    });
  }
};

// @desc    Get agent referral info (code only, no link generation)
// @route   GET /api/agent/referral-info
// @access  Private
exports.getReferralInfo = async (req, res) => {
  try {
    const agent = await Agent.findOne({ user: req.user.id });
    
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent profile not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        referralCode: agent.referralCode,
        referralCount: agent.referralCount,
        rewards: agent.rewards
      }
    });
  } catch (error) {
    console.error('Get referral info error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching referral info',
      error: error.message
    });
  }
};

// @desc    Schedule an appointment (client onboarding)
// @route   POST /api/agent/appointments
// @access  Private (Agent only)
exports.scheduleAppointment = async (req, res) => {
  try {
    const { 
      clientId, 
      propertyId, 
      appointmentDate, 
      appointmentTime,
      notes 
    } = req.body;

    // Validate inputs
    if (!clientId || !propertyId || !appointmentDate || !appointmentTime) {
      return res.status(400).json({
        success: false,
        message: 'Please provide clientId, propertyId, appointmentDate, and appointmentTime'
      });
    }

    // Get agent
    const agent = await Agent.findOne({ user: req.user.id });
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent profile not found'
      });
    }

    // Check if client exists
    const client = await User.findById(clientId);
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    // Check if property exists
    const property = await PropertyUnit.findById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Add appointment
    await agent.addOnboardedClient({
      client: clientId,
      property: propertyId,
      appointmentDate: new Date(appointmentDate),
      appointmentTime,
      notes: notes || '',
      status: 'scheduled'
    });

    res.status(201).json({
      success: true,
      message: 'Appointment scheduled successfully',
      data: {
        client: {
          id: client._id,
          name: client.name,
          email: client.email,
          phone: client.phoneNumber
        },
        property: {
          id: property._id,
          title: property.title,
          address: property.address
        },
        appointmentDate,
        appointmentTime
      }
    });
  } catch (error) {
    console.error('Schedule appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error scheduling appointment',
      error: error.message
    });
  }
};

// @desc    Get all appointments for agent
// @route   GET /api/agent/appointments
// @access  Private
exports.getAppointments = async (req, res) => {
  try {
    const { status, startDate, endDate } = req.query;
    
    const agent = await Agent.findOne({ user: req.user.id })
      .populate({
        path: 'appointments.client',
        select: 'name email phoneNumber'
      })
      .populate({
        path: 'appointments.property',
        select: 'title address city propertyType images'
      });

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent profile not found'
      });
    }

    let appointments = agent.appointments;

    // Filter by status
    if (status) {
      appointments = appointments.filter(apt => apt.status === status);
    }

    // Filter by date range
    if (startDate || endDate) {
      appointments = appointments.filter(apt => {
        const aptDate = new Date(apt.appointmentDate);
        if (startDate && aptDate < new Date(startDate)) return false;
        if (endDate && aptDate > new Date(endDate)) return false;
        return true;
      });
    }

    // Sort by date (newest first)
    appointments.sort((a, b) => b.appointmentDate - a.appointmentDate);

    res.status(200).json({
      success: true,
      count: appointments.length,
      data: appointments
    });
  } catch (error) {
    console.error('Get appointments error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching appointments',
      error: error.message
    });
  }
};

// @desc    Update appointment status
// @route   PUT /api/agent/appointments/:appointmentId
// @access  Private
exports.updateAppointmentStatus = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { status, feedback, dealValue } = req.body;

    const agent = await Agent.findOne({ user: req.user.id });
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent profile not found'
      });
    }

    const appointment = agent.appointments.id(appointmentId);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Update status
    appointment.status = status;
    
    // Update corresponding onboarded client record
    const clientRecord = agent.onboardedClients.find(
      c => c.client.toString() === appointment.client.toString() && 
           c.property.toString() === appointment.property.toString()
    );
    
    if (clientRecord) {
      clientRecord.status = status;
      
      if (dealValue) {
        clientRecord.dealValue = dealValue;
      }
      
      // Calculate reward (5% of deal value)
      if (status === 'closed' && dealValue) {
        const rewardAmount = dealValue * 0.05;
        clientRecord.rewardEarned = rewardAmount;
        agent.rewards += rewardAmount;
        agent.stats.totalDealValue += dealValue;
        agent.stats.completedVisits += 1;
        agent.stats.conversionRate = (agent.stats.completedVisits / agent.stats.totalAppointments) * 100;
      }
      
      if (feedback) {
        clientRecord.feedback = feedback;
      }
    }

    // Update stats
    if (status === 'cancelled' || status === 'rejected') {
      agent.stats.totalAppointments -= 1;
    }

    await agent.save();

    res.status(200).json({
      success: true,
      message: 'Appointment status updated successfully',
      data: appointment
    });
  } catch (error) {
    console.error('Update appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating appointment',
      error: error.message
    });
  }
};

// @desc    Get referral statistics
// @route   GET /api/agent/referral-stats
// @access  Private
exports.getReferralStats = async (req, res) => {
  try {
    const agent = await Agent.findOne({ user: req.user.id })
      .populate('referralHistory.referredUser', 'name email createdAt')
      .populate('referralHistory.referredAgent', 'name agentId');

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent profile not found'
      });
    }

    const activeReferrals = agent.referralHistory.filter(r => r.status === 'active');
    const convertedReferrals = agent.referralHistory.filter(r => r.status === 'converted');

    res.status(200).json({
      success: true,
      data: {
        totalReferrals: agent.referralCount,
        activeReferrals: activeReferrals.length,
        convertedReferrals: convertedReferrals.length,
        totalRewards: agent.rewards,
        referralHistory: agent.referralHistory,
        referralCode: agent.referralCode
      }
    });
  } catch (error) {
    console.error('Get referral stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching referral statistics',
      error: error.message
    });
  }
};

// @desc    Get agent dashboard stats
// @route   GET /api/agent/dashboard
// @access  Private
exports.getDashboardStats = async (req, res) => {
  try {
    const agent = await Agent.findOne({ user: req.user.id });

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent profile not found'
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const upcomingAppointments = agent.appointments.filter(apt => 
      apt.status === 'scheduled' && new Date(apt.appointmentDate) >= today
    );

    const recentActivities = agent.onboardedClients
      .sort((a, b) => b.visitedAt - a.visitedAt)
      .slice(0, 5);

    res.status(200).json({
      success: true,
      data: {
        stats: {
          totalReferrals: agent.referralCount,
          totalRewards: agent.rewards,
          totalAppointments: agent.stats?.totalAppointments || 0,
          completedVisits: agent.stats?.completedVisits || 0,
          totalDealValue: agent.stats?.totalDealValue || 0,
          conversionRate: agent.stats?.conversionRate || 0,
          clientsCount: agent.clientsCount
        },
        upcomingAppointments: upcomingAppointments.length,
        recentActivities: recentActivities
      }
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard stats',
      error: error.message
    });
  }
};

// @desc    Track referral signup (called during user registration)
// @route   POST /api/agent/track-referral
// @access  Public
exports.trackReferralSignup = async (req, res) => {
  try {
    const { referralCode, userId } = req.body;

    if (!referralCode || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Referral code and user ID are required'
      });
    }

    const agent = await Agent.findOne({ referralCode });
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Invalid referral code'
      });
    }

    await agent.trackReferralSignup(userId);

    res.status(200).json({
      success: true,
      message: 'Referral tracked successfully'
    });
  } catch (error) {
    console.error('Track referral error:', error);
    res.status(500).json({
      success: false,
      message: 'Error tracking referral',
      error: error.message
    });
  }
};