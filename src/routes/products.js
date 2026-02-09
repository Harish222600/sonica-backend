const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const User = require('../models/User');
const Order = require('../models/Order');
const { protect, adminOnly } = require('../middleware/auth');

// @route   GET /api/products/stats
// @desc    Get homepage stats (public)
// @access  Public
router.get('/stats', async (req, res) => {
    try {
        // Get total products
        const totalProducts = await Product.countDocuments({ isAvailable: true });

        // Get total customers (registered users)
        const totalCustomers = await User.countDocuments({ role: 'customer' });

        // Get total completed orders
        const totalOrders = await Order.countDocuments({ status: { $in: ['delivered', 'completed'] } });

        // Get average rating across all products
        const ratingResult = await Product.aggregate([
            { $match: { 'ratings.count': { $gt: 0 } } },
            {
                $group: {
                    _id: null,
                    avgRating: { $avg: '$ratings.average' },
                    totalReviews: { $sum: '$ratings.count' }
                }
            }
        ]);

        const avgRating = ratingResult[0]?.avgRating || 0;

        // Get cities delivered (unique cities from orders)
        const citiesResult = await Order.aggregate([
            { $match: { status: { $in: ['delivered', 'completed'] } } },
            { $group: { _id: '$shippingAddress.city' } },
            { $count: 'total' }
        ]);

        const citiesDelivered = citiesResult[0]?.total || 0;

        res.json({
            success: true,
            data: {
                totalProducts,
                totalCustomers,
                totalOrders,
                avgRating: avgRating.toFixed(1),
                citiesDelivered
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// @route   GET /api/products
// @desc    Get all products with filters
// @access  Public
router.get('/', async (req, res) => {
    try {
        const {
            category,
            minPrice,
            maxPrice,
            brand,
            search,
            sort,
            page = 1,
            limit = 12,
            featured
        } = req.query;

        let query = { isAvailable: true };

        // Category filter
        if (category) {
            query.category = category;
        }

        // Price range filter
        if (minPrice || maxPrice) {
            query.price = {};
            if (minPrice) query.price.$gte = Number(minPrice);
            if (maxPrice) query.price.$lte = Number(maxPrice);
        }

        // Brand filter
        if (brand) {
            query['specifications.brand'] = { $regex: brand, $options: 'i' };
        }

        // Search
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { 'specifications.brand': { $regex: search, $options: 'i' } }
            ];
        }

        // Featured filter
        if (featured === 'true') {
            query.isFeatured = true;
        }

        // Sorting
        let sortOption = {};
        switch (sort) {
            case 'price_asc':
                sortOption = { price: 1 };
                break;
            case 'price_desc':
                sortOption = { price: -1 };
                break;
            case 'rating':
                sortOption = { 'ratings.average': -1 };
                break;
            case 'newest':
                sortOption = { createdAt: -1 };
                break;
            default:
                sortOption = { createdAt: -1 };
        }

        const skip = (Number(page) - 1) * Number(limit);

        const products = await Product.find(query)
            .sort(sortOption)
            .skip(skip)
            .limit(Number(limit));

        const total = await Product.countDocuments(query);

        res.json({
            success: true,
            data: products,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit))
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// @route   GET /api/products/categories
// @desc    Get all categories with counts
// @access  Public
router.get('/categories', async (req, res) => {
    try {
        const categoryCounts = await Product.aggregate([
            { $match: { isAvailable: true } },
            { $group: { _id: '$category', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        res.json({
            success: true,
            data: categoryCounts.map(cat => ({
                name: cat._id,
                count: cat.count
            }))
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// @route   GET /api/products/featured
// @desc    Get featured products
// @access  Public
router.get('/featured', async (req, res) => {
    try {
        const products = await Product.find({ isFeatured: true, isAvailable: true })
            .limit(8)
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            data: products
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// @route   GET /api/products/:id
// @desc    Get single product
// @access  Public
router.get('/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        res.json({
            success: true,
            data: product
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// @route   POST /api/products
// @desc    Create a product
// @access  Admin only
router.post('/', protect, adminOnly, async (req, res) => {
    try {
        const product = await Product.create(req.body);

        res.status(201).json({
            success: true,
            data: product
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// @route   PUT /api/products/:id
// @desc    Update a product
// @access  Admin only
router.put('/:id', protect, adminOnly, async (req, res) => {
    try {
        const product = await Product.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        res.json({
            success: true,
            data: product
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// @route   DELETE /api/products/:id
// @desc    Delete a product
// @access  Admin only
router.delete('/:id', protect, adminOnly, async (req, res) => {
    try {
        const product = await Product.findByIdAndDelete(req.params.id);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        res.json({
            success: true,
            message: 'Product deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;
