const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const propertyRoutes = require("./routes/propertyRoutes");
const agentRoutes = require("./routes/agentroute");
dotenv.config();

const app = express();

// Middleware
const allowedOrigins = [ 
  "http://localhost:5173",
  "https://cleartitle1.vercel.app",
  "https://www.cleartitle1.com",
  "https://saimr-frontend1.vercel.app",
  "https://www.saimrgroups.com",
  "https://saimr-frontend-ebon.vercel.app"
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

app.use(express.json({ limit: "10mb" }));
app.use('/robots.txt', express.static('public/robots.txt'));
app.use('/sitemap.xml', express.static('public/sitemap.xml'));

// Routes
app.use("/api/properties", propertyRoutes);
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/admin/agent', require('./routes/agentroute'));
app.use('/api/clicks', require('./routes/clicks'));
app.use("/api/agents", agentRoutes);

// ✅ Health check route
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Server is running', 
    timestamp: new Date().toISOString() 
  });
});

// ✅ Test route for clicks
app.get('/api/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Click API is working' 
  });
});

// MongoDB connection - Use the same variable name
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log("✅ MongoDB connected");
  // Run the update script after connection
  // updateExistingProperties();
})
.catch((err) => console.error("❌ MongoDB connection error:", err));

// Function to update existing properties
// async function updateExistingProperties() {
//   try {
//     // Already connected, no need to connect again
//     console.log('🔄 Updating existing properties with websiteAssignment...');
    
//     const Property = require("./models/property"); // Make sure to require the model
    
//     // Get all properties without websiteAssignment
//     const properties = await Property.find({
//       $or: [
//         { websiteAssignment: { $exists: false } },
//         { websiteAssignment: { $eq: null } },
//         { websiteAssignment: [] } // Also handle empty arrays
//       ]
//     });
    
//     console.log(`📊 Found ${properties.length} properties without websiteAssignment`);
    
//     if (properties.length > 0) {
//       // Update all to have default ["cleartitle"]
//       const result = await Property.updateMany(
//         { 
//           $or: [
//             { websiteAssignment: { $exists: false } },
//             { websiteAssignment: { $eq: null } },
//             { websiteAssignment: [] }
//           ]
//         },
//         { $set: { websiteAssignment: ["cleartitle"] } }
//       );
      
//       console.log(`✅ Updated ${result.modifiedCount} properties with default websiteAssignment ["cleartitle"]`);
//     } else {
//       console.log('✅ All properties already have websiteAssignment');
//     }
    
//     // Verify
//     const totalWithAssignment = await Property.countDocuments({
//       websiteAssignment: { $exists: true, $ne: null, $ne: [] }
//     });
//     const totalProperties = await Property.countDocuments({});
    
//     console.log(`📈 Total properties: ${totalProperties}`);
//     console.log(`📈 Properties with websiteAssignment: ${totalWithAssignment}`);
    
//     // Check distribution
//     const cleartitleCount = await Property.countDocuments({ websiteAssignment: { $in: ["cleartitle", "both"] } });
//     const saimrCount = await Property.countDocuments({ websiteAssignment: { $in: ["saimr", "both"] } });
//     const bothCount = await Property.countDocuments({ websiteAssignment: "both" });
    
//     console.log(`🌐 Website Assignment Distribution:`);
//     console.log(`   - ClearTitle: ${cleartitleCount}`);
//     console.log(`   - SAIMR: ${saimrCount}`);
//     console.log(`   - Both: ${bothCount}`);
    
//   } catch (error) {
//     console.error('❌ Error updating properties:', error.message);
//     // Don't exit process, just log error
//   }
// }

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Allowed origins: ${allowedOrigins.join(', ')}`);
});