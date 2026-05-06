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

    // REMOVED slug generation code entirely

    // Get createdBy
    const createdBy = req.user?._id || req.body.createdBy;
    
    if (!createdBy) {
      return res.status(400).json({
        success: false,
        message: "createdBy is required"
      });
    }

    // Create blog post - WITHOUT slug
    const blog = await Blog.create({
      title: req.body.title,
      // NO slug field here
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

// @desc    Get all blogs with pagination, filtering, and search
// @route   GET /api/blogs
// @access  Public
const getAllBlogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      status = 'published',
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      author,
      keyword
    } = req.query;

    // Build filter object
    let filter = { status };

    if (author) {
      filter.createdBy = author;
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { question: { $regex: search, $options: 'i' } },
        { answer: { $regex: search, $options: 'i' } },
        { metaDescription: { $regex: search, $options: 'i' } }
      ];
    }

    if (keyword) {
      filter.keywords = { $in: [new RegExp(keyword, 'i')] };
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    const sortOptions = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const [blogs, totalCount] = await Promise.all([
      Blog.find(filter)
        .populate('createdBy', 'name email profilePicture')
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Blog.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      data: blogs,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalCount / limitNum),
        totalCount,
        limit: limitNum,
        hasNextPage: pageNum < Math.ceil(totalCount / limitNum),
        hasPrevPage: pageNum > 1
      }
    });
  } catch (error) {
    console.error('Error fetching blogs:', error);
    res.status(500).json({
      success: false,
      message: "Error fetching blogs",
      error: error.message
    });
  }
};

// @desc    Get single blog by ID or slug
// @route   GET /api/blogs/:id
// @access  Public
const getSingleBlog = async (req, res) => {
  try {
    const { id } = req.params;
    let blog;

    // Check if id is MongoDB ObjectId or slug
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      blog = await Blog.findById(id)
        .populate('createdBy', 'name email profilePicture bio');
    } else {
      blog = await Blog.findOne({ slug: id })
        .populate('createdBy', 'name email profilePicture bio');
    }

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found"
      });
    }

    // Increment view count
    blog.views += 1;
    await blog.save();

    res.status(200).json({
      success: true,
      data: blog
    });
  } catch (error) {
    console.error('Error fetching blog:', error);
    res.status(500).json({
      success: false,
      message: "Error fetching blog",
      error: error.message
    });
  }
};

// @desc    Get blogs by author
// @route   GET /api/blogs/author/:authorId
// @access  Public
const getBlogsByAuthor = async (req, res) => {
  try {
    const { authorId } = req.params;
    const { page = 1, limit = 10, status = 'published' } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Check if author exists
    const author = await User.findById(authorId);
    if (!author) {
      return res.status(404).json({
        success: false,
        message: "Author not found"
      });
    }

    const filter = {
      createdBy: authorId,
      status
    };

    const [blogs, totalCount] = await Promise.all([
      Blog.find(filter)
        .populate('createdBy', 'name email profilePicture bio')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Blog.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(totalCount / limitNum);

    res.status(200).json({
      success: true,
      data: blogs,
      author: {
        id: author._id,
        name: author.name,
        email: author.email,
        profilePicture: author.profilePicture
      },
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalCount,
        limit: limitNum,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      }
    });
  } catch (error) {
    console.error('Error fetching blogs by author:', error);
    res.status(500).json({
      success: false,
      message: "Error fetching author's blogs",
      error: error.message
    });
  }
};

// @desc    Get related blogs based on keywords
// @route   GET /api/blogs/:id/related
// @access  Public
const getRelatedBlogs = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 4 } = req.query;

    // Find the current blog
    const currentBlog = await Blog.findById(id);
    if (!currentBlog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found"
      });
    }

    // Find related blogs based on shared keywords
    const relatedBlogs = await Blog.find({
      _id: { $ne: id },
      status: 'published',
      keywords: { $in: currentBlog.keywords || [] }
    })
      .populate('createdBy', 'name email profilePicture')
      .sort({ views: -1, createdAt: -1 })
      .limit(parseInt(limit))
      .lean();

    res.status(200).json({
      success: true,
      data: relatedBlogs,
      count: relatedBlogs.length
    });
  } catch (error) {
    console.error('Error fetching related blogs:', error);
    res.status(500).json({
      success: false,
      message: "Error fetching related blogs",
      error: error.message
    });
  }
};

// @desc    Get blog statistics
// @route   GET /api/blogs/stats
// @access  Public
const getBlogStats = async (req, res) => {
  try {
    const [totalBlogs, publishedBlogs, draftBlogs, totalViews, topBlogs, blogsByMonth] = await Promise.all([
      Blog.countDocuments(),
      Blog.countDocuments({ status: 'published' }),
      Blog.countDocuments({ status: 'draft' }),
      Blog.aggregate([
        { $group: { _id: null, total: { $sum: '$views' } } }
      ]),
      Blog.find({ status: 'published' })
        .sort({ views: -1 })
        .limit(5)
        .select('title slug views createdAt')
        .lean(),
      Blog.aggregate([
        {
          $match: { status: 'published' }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            count: { $sum: 1 },
            monthName: {
              $let: {
                vars: {
                  monthsInString: [null, "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
                },
                in: { $arrayElemAt: ["$$monthsInString", { $month: '$createdAt' }] }
              }
            }
          }
        },
        { $sort: { '_id.year': -1, '_id.month': -1 } },
        { $limit: 12 }
      ])
    ]);

    res.status(200).json({
      success: true,
      stats: {
        totalBlogs,
        publishedBlogs,
        draftBlogs,
        totalViews: totalViews[0]?.total || 0,
        topBlogs,
        blogsByMonth: blogsByMonth.map(item => ({
          year: item._id.year,
          month: item._id.month,
          monthName: item.monthName,
          count: item.count
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching blog stats:', error);
    res.status(500).json({
      success: false,
      message: "Error fetching blog statistics",
      error: error.message
    });
  }
};



// @desc    Update a blog post
// @route   PUT /api/blogs/:id
// @access  Private
const updateBlog = async (req, res) => {
  try {
    const { id } = req.params;
    let blog = await Blog.findById(id);

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found"
      });
    }

    // Check authorization (optional - if you want to restrict)
    if (req.user && blog.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this blog"
      });
    }

    // Update fields
    if (req.body.title) {
      blog.title = req.body.title;
      blog.slug = req.body.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }
    if (req.body.question) blog.question = req.body.question;
    if (req.body.answer) blog.answer = req.body.answer;
    if (req.body.metaDescription) blog.metaDescription = req.body.metaDescription;
    if (req.body.status) blog.status = req.body.status;
    
    if (req.body.keywords) {
      if (Array.isArray(req.body.keywords)) {
        blog.keywords = req.body.keywords;
      } else if (typeof req.body.keywords === 'string') {
        blog.keywords = req.body.keywords.split(',').map(k => k.trim());
      }
    }

    await blog.save();
    await blog.populate('createdBy', 'name email');

    res.status(200).json({
      success: true,
      message: "Blog updated successfully",
      data: blog
    });
  } catch (error) {
    console.error("Error updating blog:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating blog",
      error: error.message
    });
  }
};

// @desc    Delete a blog post
// @route   DELETE /api/blogs/:id
// @access  Private
const deleteBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const blog = await Blog.findById(id);

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found"
      });
    }

    // Check authorization
    if (req.user && blog.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this blog"
      });
    }

    // Delete image from Cloudinary if exists
    if (blog.image && blog.image.public_id) {
      try {
        await cloudinary.uploader.destroy(blog.image.public_id);
      } catch (err) {
        console.error("Error deleting image from Cloudinary:", err);
      }
    }

    await blog.deleteOne();

    res.status(200).json({
      success: true,
      message: "Blog deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting blog:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting blog",
      error: error.message
    });
  }
};

module.exports = {
  getAllBlogs,
  getSingleBlog,
  getBlogsByAuthor,
  getRelatedBlogs,
  getBlogStats,
  createBlog,
  updateBlog,
  deleteBlog
};