const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const propertyRoutes = require("./routes/propertyRoutes");
// const ClickAnalytics = require('../models/ClickAnalytics'); 
dotenv.config();

const app = express();

// Middleware
// ✅ Enable CORS
const allowedOrigins = [ 
  "http://localhost:5173","https://cleartitle1.vercel.app","https://www.cleartitle1.com",
  "https://saimr-frontend1.vercel.app","https://www.saimrgroups.com",
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

// ✅ ADD CLICK ROUTES HERE
app.use('/api/clicks', require('./routes/clicks'));

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

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("MongoDB connected"))
.catch((err) => console.error(err));

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));