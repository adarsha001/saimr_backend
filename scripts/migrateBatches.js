// scripts/migrateBatches.js
const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

async function migrateBatches() {
  try {
    console.log("MONGO_URI:", process.env.MONGO_URI ? "Found" : "Not found");
    
    // Connect to MongoDB
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is not defined in .env file");
    }
    
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");
    
    // Import model AFTER connection
    const PropertyBatch = require("../models/PropertyBatch");
    
    // Find all batches
    const batches = await PropertyBatch.find({});
    console.log(`Found ${batches.length} batches to migrate`);
    
    if (batches.length === 0) {
      console.log("No batches found to migrate");
      process.exit(0);
    }
    
    for (const batch of batches) {
      console.log(`\n📦 Processing batch: ${batch.batchName}`);
      
      // Check if batch already has the new structure
      if (batch.propertyUnits.length > 0 && batch.propertyUnits[0] && batch.propertyUnits[0].propertyId) {
        console.log(`  ✓ Batch already migrated, skipping...`);
        continue;
      }
      
      // Convert old format (array of ObjectIds) to new format (array of objects)
      const oldPropertyUnits = [...batch.propertyUnits];
      const newPropertyUnits = oldPropertyUnits.map(propertyId => ({
        propertyId: propertyId,
        userViews: [],
        propertyStats: {
          totalViews: 0,
          uniqueViewers: 0,
          totalViewDuration: 0,
          avgViewDuration: 0
        }
      }));
      
      batch.propertyUnits = newPropertyUnits;
      batch.stats.totalProperties = newPropertyUnits.length;
      batch.stats.totalViews = 0;
      batch.stats.uniqueViewers = 0;
      
      await batch.save();
      console.log(`  ✓ Migrated ${newPropertyUnits.length} properties`);
    }
    
    console.log("\n✅ Migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

// Run migration
migrateBatches();