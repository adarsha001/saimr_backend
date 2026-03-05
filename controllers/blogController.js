const Blog = require('../models/Blog');
const User = require('../models/user');
const cloudinary = require('../config/cloudinary');

// Create a new blog post (with or without image)
const createBlog = async (req, res) => {
  try {
    let imageData = {};

    // Handle image if uploaded
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "blog-images"
      });
      imageData = {
        url: result.secure_url,
        public_id: result.public_id,
        altText: req.body.imageAlt || req.body.title
      };
    } 
    // Handle image URL if provided directly
    else if (req.body.imageUrl) {
      imageData = {
        url: req.body.imageUrl,
        public_id: null,
        altText: req.body.imageAlt || req.body.title
      };
    } else if (req.body.image && req.body.image.url) {
      // Handle image object from n8n
      imageData = {
        url: req.body.image.url,
        public_id: req.body.image.public_id || null,
        altText: req.body.image.altText || req.body.title
      };
    }

    // Handle keywords
    let keywords = [];
    if (req.body.keywords) {
      if (Array.isArray(req.body.keywords)) {
        keywords = req.body.keywords;
      } else if (typeof req.body.keywords === 'string') {
        keywords = req.body.keywords.split(',').map(k => k.trim());
      }
    }

    // Generate slug from title - FIX HERE
    const slug = req.body.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    // Get createdBy
    const createdBy = req.user?._id || req.body.createdBy;
    
    if (!createdBy) {
      return res.status(400).json({
        success: false,
        message: "createdBy is required"
      });
    }

    // Create blog post - NOW INCLUDING SLUG
    const blog = await Blog.create({
      title: req.body.title,
      slug: slug, // 👈 ADD THIS LINE
      question: req.body.question,
      answer: req.body.answer,
      image: imageData,
      metaDescription: req.body.metaDescription || req.body.question.substring(0, 160),
      keywords: keywords,
      createdBy,
      status: req.body.status || 'published'
    });

    res.status(201).json({
      success: true,
      message: "Blog post created successfully",
      data: blog
    });

  } catch (error) {
    console.error("Error creating blog:", error);
    res.status(500).json({
      success: false,
      message: "Server error while creating blog",
      error: error.message
    });
  }
};
module.exports = {
  createBlog,

};