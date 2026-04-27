const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const helmet = require("helmet");

const propertyRoutes = require("./routes/propertyRoutes");
const agentRoutes = require("./routes/agentroute");
const propertyUnitRoutes = require('./routes/propertyUnitRoutes');
const adminPropertyUnitRoutes = require('./routes/adminPropertyUnitRoutes');
const propertyBatchRoutes = require('./routes/propertyBatchRoutes');
const carouselRoutes = require('./routes/carouselRoutes');
const blogRoutes = require('./routes/blogRoutes');
const truecallerRoutes = require('./routes/truecaller');
const batchViewRoutes = require("./routes/batchViewRoutes");
const PropertyBatch = require("./models/PropertyBatch");
dotenv.config();

const app = express();

/* =========================
   ✅ ALLOWED ORIGINS
========================= */

const allowedOrigins = [ 
  "http://localhost:5173",
  "http://localhost:5555",
  "https://cleartitle1.vercel.app",
  "https://www.cleartitle1.com",
  "https://saimr-frontend1.vercel.app",
  "https://www.saimrgroups.com",
  "https://saimr-frontend-ebon.vercel.app"
];

/* =========================
   ✅ CORS CONFIGURATION
========================= */

// Main CORS middleware
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log("❌ Blocked by CORS:", origin);
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  credentials: true,
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Cache-Control",
    "Pragma",
    "Expires",
    "Accept",
    "Origin"
  ],
  exposedHeaders: ["Content-Range", "X-Content-Range"],
  maxAge: 86400, // 24 hours
  optionsSuccessStatus: 200
}));

// ✅ FIXED: Handle OPTIONS preflight requests manually
// This is the correct way to handle all OPTIONS requests
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.origin;
    
    // Set CORS headers
    if (allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
    }
    
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header('Access-Control-Allow-Headers', 
      'Content-Type, Authorization, X-Requested-With, Cache-Control, Pragma, Expires, Accept, Origin'
    );
    res.header('Access-Control-Max-Age', '86400');
    
    // Respond with 200 OK
    return res.status(200).end();
  }
  
  next();
});

/* =========================
   ✅ MIDDLEWARE
========================= */

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Configure Helmet to work with CORS
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false
}));

// Request logging for debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - Origin: ${req.headers.origin || 'No Origin'}`);
  
  // Log CORS-related headers in development
  if (process.env.NODE_ENV === 'development') {
    console.log('CORS Headers:', {
      origin: req.headers.origin,
      'access-control-request-method': req.headers['access-control-request-method'],
      'access-control-request-headers': req.headers['access-control-request-headers']
    });
  }
  
  next();
});

/* =========================
   ✅ STATIC FILES
========================= */

app.use('/robots.txt', express.static('public/robots.txt'));
app.use('/sitemap.xml', express.static('public/sitemap.xml'));

/* =========================
   ✅ ROUTES
========================= */
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use("/api/properties", propertyRoutes);
app.use('/api/admin/batches', propertyBatchRoutes);
app.use('/api/carousel', carouselRoutes);
app.use('/api/auth/truecaller', truecallerRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/employee/admin',require("./routes/adminEmployeeRoutes"))

app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/admin/agent', require('./routes/agentroute'));
app.use('/api/clicks', require('./routes/clicks'));
app.use("/api/agents", agentRoutes);
app.use("/api/admin/agents", require('./routes/adminAgentroute'));
app.use('/api/property-units', propertyUnitRoutes);
app.use('/api/admin/property-units', adminPropertyUnitRoutes);
app.use("/api/batch-views", batchViewRoutes);

app.use('/api/employee',require('./routes/employeeuserroute'))
/* =========================
   ✅ ROOT & HEALTH CHECK
========================= */

app.get('/', (req, res) => {
  res.json({
    message: 'ClearTitle API Server',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Server is running', 
    timestamp: new Date().toISOString(),
    cors: {
      allowedOrigins: allowedOrigins,
      origin: req.headers.origin || 'none'
    }
  });
});

app.get('/api/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Click API is working' 
  });
});

/* =========================
   ✅ 404 HANDLER
========================= */

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path
  });
});

/* =========================
   ✅ ERROR HANDLER
========================= */

app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  
  // Handle CORS errors specifically
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      message: 'CORS error: Origin not allowed',
      origin: req.headers.origin
    });
  }
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

/* =========================
   ✅ MONGODB CONNECTION
========================= */

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log("✅ MongoDB connected");
})
.catch((err) => {
  console.error("❌ MongoDB connection error:", err);
  process.exit(1);
});

/* =========================
   ✅ START SERVER
========================= */

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Allowed origins: ${allowedOrigins.join(', ')}`);
  console.log(`✅ CORS configured with Cache-Control header support`);
  console.log(`✅ OPTIONS preflight requests handled correctly`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
});

// Handle unhandled rejections
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
  server.close(() => process.exit(1));
});

module.exports = app;



