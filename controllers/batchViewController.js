// controllers/batchViewController.js
const PropertyBatch = require("../models/PropertyBatch");
const PropertyUnit = require("../models/PropertyUnit");
const User = require("../models/user"); // Make sure this matches your file name

// Record property view and add user to batch
exports.recordPropertyView = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { duration = 0, sessionId = null, source = "direct", timeWindowHours = 24 } = req.body;
    const userId = req.user.id;
    
    console.log("Recording view for property:", propertyId);
    console.log("User ID:", userId);
    
    // Get user details
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    
    // Get property unit
    const propertyUnit = await PropertyUnit.findById(propertyId);
    if (!propertyUnit) {
      return res.status(404).json({ success: false, message: "Property not found" });
    }
    
    // Find batches containing this property
    const batches = await PropertyBatch.find({
      "propertyUnits.propertyId": propertyId,
      isActive: true
    });
    
    console.log("Batches found:", batches.length);
    
    if (batches.length === 0) {
      return res.status(200).json({
        success: true,
        message: "Property not in any batch",
        data: { batchesUpdated: 0 }
      });
    }
    
    // Record view in each batch
    const results = [];
    for (const batch of batches) {
      const propertyIndex = batch.propertyUnits.findIndex(
        p => p.propertyId.toString() === propertyId.toString()
      );
      
      if (propertyIndex === -1) continue;
      
      const property = batch.propertyUnits[propertyIndex];
      
      // Check for existing view within time window
      const existingViewIndex = property.userViews.findIndex(
        view => view.userId.toString() === userId.toString() &&
        new Date(view.viewedAt) > new Date(Date.now() - timeWindowHours * 60 * 60 * 1000)
      );
      
      let isNewView = false;
      
      if (existingViewIndex !== -1) {
        // Update existing view
        const existingView = property.userViews[existingViewIndex];
        existingView.viewDuration = Math.max(existingView.viewDuration, duration);
        if (sessionId) existingView.sessionId = sessionId;
        existingView.viewedAt = new Date();
        existingView.viewCount = (existingView.viewCount || 1) + 1;
      } else {
        // Add new view record
        property.userViews.push({
          userId: userId,
          userName: user.name || "Unknown",
          userEmail: user.gmail || "",
          userType: user.userType || "unknown",
          userPhone: user.phoneNumber || "",
          viewedAt: new Date(),
          viewDuration: duration,
          sessionId: sessionId,
          source: source,
          viewCount: 1
        });
        isNewView = true;
      }
      
      // Recalculate property stats
      const uniqueViewers = new Set(property.userViews.map(v => v.userId.toString()));
      const totalDuration = property.userViews.reduce((sum, v) => sum + v.viewDuration, 0);
      const totalViewRecords = property.userViews.length;
      
      property.propertyStats = {
        totalViews: totalViewRecords,
        uniqueViewers: uniqueViewers.size,
        totalViewDuration: totalDuration,
        avgViewDuration: totalViewRecords > 0 ? Math.round(totalDuration / totalViewRecords) : 0,
        lastViewedAt: new Date()
      };
      
      // Update batch stats
      const allViews = batch.propertyUnits.flatMap(p => p.userViews || []);
      const allUniqueViewers = new Set(allViews.map(v => v.userId.toString()));
      
      batch.stats.totalViews = allViews.length;
      batch.stats.uniqueViewers = allUniqueViewers.size;
      batch.stats.lastViewedAt = new Date();
      
      await batch.save();
      
      results.push({
        batchId: batch._id,
        batchName: batch.batchName,
        isNewView: isNewView,
        propertyStats: property.propertyStats,
        batchStats: {
          totalViews: batch.stats.totalViews,
          uniqueViewers: batch.stats.uniqueViewers
        }
      });
    }
    
    // Update property's own view count
    await PropertyUnit.findByIdAndUpdate(propertyId, {
      $inc: { viewCount: 1 }
    });
    
    res.status(200).json({
      success: true,
      message: "View recorded successfully",
      data: {
        propertyViews: propertyUnit.viewCount + 1,
        batchesUpdated: results.length,
        details: results
      }
    });
    
  } catch (error) {
    console.error("Error recording view:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get batch analytics (accessible by batch owner or admin)
exports.getBatchAnalytics = async (req, res) => {
  try {
    const { batchId } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.isAdmin === true || req.user.userType === 'admin' || req.user.userType === 'superadmin';
    
    const batch = await PropertyBatch.findById(batchId)
      .populate('propertyUnits.propertyId', 'title propertyType city price images description')
      .populate('createdBy', 'name email username');
    
    if (!batch) {
      return res.status(404).json({ success: false, message: "Batch not found" });
    }
    
    // Check if user has access (owner or admin)
    if (batch.createdBy._id.toString() !== userId && !isAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. You can only view analytics for your own batches." 
      });
    }
    
    const analytics = batch.getAnalytics();
    
    res.status(200).json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error("Error getting analytics:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get user's own batches
exports.getUserBatches = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const batches = await PropertyBatch.find({ 
      createdBy: userId, 
      isActive: true 
    })
    .populate('propertyUnits.propertyId', 'title propertyType city price images')
    .sort({ createdAt: -1 });
    
    const batchesData = batches.map(batch => ({
      id: batch._id,
      name: batch.batchName,
      location: batch.locationName,
      code: batch.batchCode,
      totalProperties: batch.stats.totalProperties,
      totalViews: batch.stats.totalViews,
      uniqueViewers: batch.stats.uniqueViewers,
      image: batch.image,
      createdAt: batch.createdAt,
      updatedAt: batch.updatedAt
    }));
    
    res.status(200).json({
      success: true,
      count: batchesData.length,
      data: batchesData
    });
  } catch (error) {
    console.error("Error getting user batches:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ============= ADMIN ONLY FUNCTIONS =============

// Get all batches (admin only)
exports.getAllBatches = async (req, res) => {
  try {
    // Check if user is admin
    const isAdmin = req.user.isAdmin === true || req.user.userType === 'admin' || req.user.userType === 'superadmin';
    
    if (!isAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. Admin privileges required." 
      });
    }
    
    const batches = await PropertyBatch.find({ isActive: true })
      .populate('propertyUnits.propertyId', 'title propertyType city price images')
      .populate('createdBy', 'name email username userType')
      .sort({ createdAt: -1 });
    
    // Calculate additional stats for admin view
    const batchesWithStats = batches.map(batch => ({
      id: batch._id,
      name: batch.batchName,
      location: batch.locationName,
      code: batch.batchCode,
      totalProperties: batch.stats.totalProperties,
      totalViews: batch.stats.totalViews,
      uniqueViewers: batch.stats.uniqueViewers,
      avgPrice: batch.stats.avgPrice,
      createdBy: batch.createdBy,
      image: batch.image,
      createdAt: batch.createdAt,
      updatedAt: batch.updatedAt,
      isActive: batch.isActive
    }));
    
    // Calculate overall stats
    const overallStats = {
      totalBatches: batches.length,
      totalProperties: batches.reduce((sum, b) => sum + (b.stats.totalProperties || 0), 0),
      totalViews: batches.reduce((sum, b) => sum + (b.stats.totalViews || 0), 0),
      totalUniqueViewers: batches.reduce((sum, b) => sum + (b.stats.uniqueViewers || 0), 0)
    };
    
    res.status(200).json({
      success: true,
      count: batchesWithStats.length,
      data: batchesWithStats,
      overallStats: overallStats
    });
  } catch (error) {
    console.error("Error getting all batches:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get batch by ID (admin only - can view any batch)
exports.getBatchById = async (req, res) => {
  try {
    const { batchId } = req.params;
    const isAdmin = req.user.isAdmin === true || req.user.userType === 'admin' || req.user.userType === 'superadmin';
    
    if (!isAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. Admin privileges required." 
      });
    }
    
    const batch = await PropertyBatch.findById(batchId)
      .populate('propertyUnits.propertyId', 'title propertyType city price images description unitTypes')
      .populate('createdBy', 'name email username userType phoneNumber');
    
    if (!batch) {
      return res.status(404).json({ success: false, message: "Batch not found" });
    }
    
    // Get detailed analytics
    const analytics = batch.getAnalytics();
    
    res.status(200).json({
      success: true,
      data: {
        batch: batch,
        analytics: analytics
      }
    });
  } catch (error) {
    console.error("Error getting batch by ID:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get company-wide analytics (admin only)
exports.getCompanyAnalytics = async (req, res) => {
  try {
    const isAdmin = req.user.isAdmin === true || req.user.userType === 'admin' || req.user.userType === 'superadmin';
    
    if (!isAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. Admin privileges required." 
      });
    }
    
    const { startDate, endDate, companyId } = req.query;
    let dateFilter = {};
    
    if (startDate && endDate) {
      dateFilter = {
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };
    }
    
    let batchFilter = { isActive: true };
    if (companyId) {
      batchFilter.createdBy = companyId;
    }
    
    const batches = await PropertyBatch.find(batchFilter)
      .populate('createdBy', 'name email userType company');
    
    // Calculate company-wide stats
    const companyStats = {
      totalBatches: batches.length,
      totalProperties: batches.reduce((sum, b) => sum + (b.stats.totalProperties || 0), 0),
      totalViews: batches.reduce((sum, b) => sum + (b.stats.totalViews || 0), 0),
      totalUniqueViewers: batches.reduce((sum, b) => sum + (b.stats.uniqueViewers || 0), 0),
      batchesByType: {},
      topPerformingBatches: [],
      userTypeBreakdown: {}
    };
    
    // Calculate batches by type
    batches.forEach(batch => {
      const type = batch.batchType;
      companyStats.batchesByType[type] = (companyStats.batchesByType[type] || 0) + 1;
    });
    
    // Get top performing batches
    companyStats.topPerformingBatches = batches
      .sort((a, b) => (b.stats.totalViews || 0) - (a.stats.totalViews || 0))
      .slice(0, 5)
      .map(b => ({
        id: b._id,
        name: b.batchName,
        location: b.locationName,
        totalViews: b.stats.totalViews,
        totalProperties: b.stats.totalProperties
      }));
    
    res.status(200).json({
      success: true,
      data: companyStats,
      batches: batches.map(b => ({
        id: b._id,
        name: b.batchName,
        location: b.locationName,
        createdBy: b.createdBy,
        stats: b.stats
      }))
    });
  } catch (error) {
    console.error("Error getting company analytics:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};



exports.deleteBatch = async (req, res) => {
  try {
    const { batchId } = req.params;
    const isAdmin = req.user.isAdmin === true || req.user.userType === 'admin' || req.user.userType === 'superadmin';
    
    console.log("Delete batch request:", { batchId, isAdmin });
    
    if (!isAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. Admin privileges required." 
      });
    }
    
    const batch = await PropertyBatch.findById(batchId);
    if (!batch) {
      return res.status(404).json({ success: false, message: "Batch not found" });
    }
    
    // Use findByIdAndDelete instead of deleteOne
    const deletedBatch = await PropertyBatch.findByIdAndDelete(batchId);
    
    if (!deletedBatch) {
      return res.status(404).json({ success: false, message: "Batch not found or already deleted" });
    }
    
    console.log(`Batch "${deletedBatch.batchName}" deleted successfully`);
    
    res.status(200).json({
      success: true,
      message: `Batch "${deletedBatch.batchName}" deleted successfully`,
      data: deletedBatch
    });
  } catch (error) {
    console.error("Error deleting batch:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Toggle batch active status (admin only)
exports.toggleBatchStatus = async (req, res) => {
  try {
    const { batchId } = req.params;
    const isAdmin = req.user.isAdmin === true || req.user.userType === 'admin' || req.user.userType === 'superadmin';
    
    if (!isAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. Admin privileges required." 
      });
    }
    
    const batch = await PropertyBatch.findById(batchId);
    if (!batch) {
      return res.status(404).json({ success: false, message: "Batch not found" });
    }
    
    batch.isActive = !batch.isActive;
    await batch.save();
    
    res.status(200).json({
      success: true,
      message: `Batch "${batch.batchName}" is now ${batch.isActive ? 'active' : 'inactive'}`,
      data: { isActive: batch.isActive }
    });
  } catch (error) {
    console.error("Error toggling batch status:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Add these functions to your batchViewController.js

// Get batch property click stats (admin only)
exports.getBatchPropertyClickStats = async (req, res) => {
  try {
    const { batchId } = req.params;
    const isAdmin = req.user.isAdmin === true || req.user.userType === 'admin' || req.user.userType === 'superadmin';
    
    if (!isAdmin) {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }
    
    const batch = await PropertyBatch.findById(batchId)
      .populate('propertyUnits.propertyId', 'title propertyType city price images');
    
    if (!batch) {
      return res.status(404).json({ success: false, message: "Batch not found" });
    }
    
    const propertyStats = batch.propertyUnits.map(property => ({
      propertyId: property.propertyId,
      totalViews: property.propertyStats?.totalViews || 0,
      uniqueViewers: property.propertyStats?.uniqueViewers || 0,
      avgViewDuration: property.propertyStats?.avgViewDuration || 0,
      lastViewedAt: property.propertyStats?.lastViewedAt,
      userViews: property.userViews?.slice(-10) || []
    }));
    
    propertyStats.sort((a, b) => b.totalViews - a.totalViews);
    
    res.status(200).json({
      success: true,
      data: propertyStats
    });
  } catch (error) {
    console.error("Error getting property click stats:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get batch user click stats (admin only)
exports.getBatchUserClickStats = async (req, res) => {
  try {
    const { batchId } = req.params;
    const isAdmin = req.user.isAdmin === true || req.user.userType === 'admin' || req.user.userType === 'superadmin';
    
    if (!isAdmin) {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }
    
    const batch = await PropertyBatch.findById(batchId);
    
    if (!batch) {
      return res.status(404).json({ success: false, message: "Batch not found" });
    }
    
    // Aggregate user views across all properties in batch
    const userMap = new Map();
    
    batch.propertyUnits.forEach(property => {
      property.userViews.forEach(view => {
        const userId = view.userId.toString();
        if (!userMap.has(userId)) {
          userMap.set(userId, {
            userId: view.userId,
            name: view.userName,
            email: view.userEmail,
            userType: view.userType,
            phone: view.userPhone,
            totalViews: 0,
            totalDuration: 0,
            propertiesViewed: [],
            firstView: view.viewedAt,
            lastView: view.viewedAt
          });
        }
        
        const user = userMap.get(userId);
        user.totalViews++;
        user.totalDuration += view.viewDuration;
        user.propertiesViewed.push({
          propertyId: property.propertyId,
          viewedAt: view.viewedAt,
          duration: view.viewDuration
        });
        
        if (view.viewedAt < user.firstView) user.firstView = view.viewedAt;
        if (view.viewedAt > user.lastView) user.lastView = view.viewedAt;
      });
    });
    
    const userStats = Array.from(userMap.values())
      .map(user => ({
        ...user,
        avgViewDuration: user.totalViews > 0 ? Math.round(user.totalDuration / user.totalViews) : 0,
        uniquePropertiesViewed: new Set(user.propertiesViewed.map(p => p.propertyId.toString())).size,
        recentViews: user.propertiesViewed.sort((a, b) => b.viewedAt - a.viewedAt).slice(0, 5)
      }))
      .sort((a, b) => b.totalViews - a.totalViews);
    
    res.status(200).json({
      success: true,
      count: userStats.length,
      data: userStats
    });
  } catch (error) {
    console.error("Error getting user click stats:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Export batch analytics (admin only)
exports.exportBatchAnalytics = async (req, res) => {
  try {
    const { batchId } = req.params;
    const { format = 'csv' } = req.query;
    const isAdmin = req.user.isAdmin === true || req.user.userType === 'admin' || req.user.userType === 'superadmin';
    
    if (!isAdmin) {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }
    
    const batch = await PropertyBatch.findById(batchId)
      .populate('propertyUnits.propertyId', 'title propertyType city price');
    
    if (!batch) {
      return res.status(404).json({ success: false, message: "Batch not found" });
    }
    
    if (format === 'csv') {
      // Create CSV data
      const rows = [
        ['Property ID', 'Property Title', 'Property Type', 'City', 'Total Views', 'Unique Viewers', 'Avg View Duration (s)', 'Last Viewed']
      ];
      
      batch.propertyUnits.forEach(property => {
        rows.push([
          property.propertyId?._id || property.propertyId,
          property.propertyId?.title || 'Unknown',
          property.propertyId?.propertyType || 'Unknown',
          property.propertyId?.city || 'Unknown',
          property.propertyStats?.totalViews || 0,
          property.propertyStats?.uniqueViewers || 0,
          property.propertyStats?.avgViewDuration || 0,
          property.propertyStats?.lastViewedAt ? new Date(property.propertyStats.lastViewedAt).toLocaleDateString() : 'Never'
        ]);
      });
      
      const csvContent = rows.map(row => row.join(',')).join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=batch_${batch.batchName}_analytics.csv`);
      res.send(csvContent);
    } else {
      res.status(200).json({
        success: true,
        data: {
          batch: {
            id: batch._id,
            name: batch.batchName,
            location: batch.locationName,
            code: batch.batchCode
          },
          properties: batch.propertyUnits.map(property => ({
            property: property.propertyId,
            stats: property.propertyStats,
            userViews: property.userViews?.slice(-20) || []
          })),
          summary: batch.stats,
          exportedAt: new Date()
        }
      });
    }
  } catch (error) {
    console.error("Error exporting analytics:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};