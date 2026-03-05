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
    }

    // Get createdBy (from auth or from body for n8n)
    const createdBy = req.user?._id || req.body.createdBy;
    
    if (!createdBy) {
      return res.status(400).json({
        success: false,
        message: "createdBy is required"
      });
    }

    // Create blog post
    const blog = await Blog.create({
      title: req.body.title,
      question: req.body.question,
      answer: req.body.answer,
      image: imageData,
      metaDescription: req.body.metaDescription || req.body.question.substring(0, 160),
      keywords: req.body.keywords ? req.body.keywords.split(',').map(k => k.trim()) : [],
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