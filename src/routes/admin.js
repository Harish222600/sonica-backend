const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Inventory = require('../models/Inventory');
const { protect, adminOnly } = require('../middleware/auth');
const { uploadProductImage, deleteProductImages } = require('../services/fileService');
const multer = require('multer');

// Multer setup for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// All routes require admin access
router.use(protect, adminOnly);

// ========== USER MANAGEMENT ==========

// @route   GET /api/admin/users
// @desc    Get all users
// @access  Admin only
router.get('/users', async (req, res) => {
    try {
        const { role, search, status, page = 1, limit = 20 } = req.query;

        let query = {};

        if (role) query.role = role;
        if (status === 'active') query.isActive = true;
        if (status === 'inactive') query.isActive = false;

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (Number(page) - 1) * Number(limit);

        const users = await User.find(query)
            .select('-password')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit));

        const total = await User.countDocuments(query);

        res.json({
            success: true,
            data: users,
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

// @route   GET /api/admin/users/:id
// @desc    Get single user
// @access  Admin only
router.get('/users/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Get user's order history
        const orders = await Order.find({ user: req.params.id })
            .select('orderNumber totalAmount status createdAt')
            .sort({ createdAt: -1 })
            .limit(10);

        res.json({
            success: true,
            data: {
                user,
                recentOrders: orders
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// @route   POST /api/admin/users
// @desc    Create a new user (staff accounts)
// @access  Admin only
router.post('/users', async (req, res) => {
    try {
        const { name, email, password, phone, role } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User already exists with this email'
            });
        }

        const user = await User.create({
            name,
            email,
            password,
            phone,
            role: role || 'customer'
        });

        res.status(201).json({
            success: true,
            data: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// @route   PUT /api/admin/users/:id
// @desc    Update user
// @access  Admin only
router.put('/users/:id', async (req, res) => {
    try {
        const { name, phone, role, isActive } = req.body;

        const user = await User.findByIdAndUpdate(
            req.params.id,
            { name, phone, role, isActive },
            { new: true, runValidators: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            data: user
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// @route   DELETE /api/admin/users/:id
// @desc    Delete/deactivate user
// @access  Admin only
router.delete('/users/:id', async (req, res) => {
    try {
        // Soft delete - just deactivate
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { isActive: false },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            message: 'User deactivated successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ========== PRODUCT MANAGEMENT ==========

// @route   POST /api/admin/products
// @desc    Create product with image upload
// @access  Admin only
router.post('/products', upload.array('images', 5), async (req, res) => {
    try {
        const productData = JSON.parse(req.body.data || '{}');

        const product = new Product(productData);
        await product.save();

        // Upload images to Supabase
        if (req.files && req.files.length > 0) {
            const imageUrls = [];
            for (let i = 0; i < req.files.length; i++) {
                const file = req.files[i];
                const result = await uploadProductImage(
                    file.buffer,
                    product._id.toString(),
                    i,
                    file.mimetype
                );
                imageUrls.push(result.url);
            }
            product.images = imageUrls;
            await product.save();
        }

        // Create inventory record
        await Inventory.create({
            product: product._id,
            totalStock: product.stock || 0,
            lowStockThreshold: product.lowStockThreshold || 5
        });

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

// @route   PUT /api/admin/products/:id
// @desc    Update product with image upload
// @access  Admin only
router.put('/products/:id', upload.array('images', 5), async (req, res) => {
    try {
        const productData = JSON.parse(req.body.data || '{}');
        const keepImages = req.body.keepImages ? JSON.parse(req.body.keepImages) : [];

        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        // Update product fields
        Object.assign(product, productData);

        // Handle images
        let finalImages = keepImages; // Images to keep from existing

        // Upload new images
        if (req.files && req.files.length > 0) {
            for (let i = 0; i < req.files.length; i++) {
                const file = req.files[i];
                const result = await uploadProductImage(
                    file.buffer,
                    product._id.toString(),
                    finalImages.length + i,
                    file.mimetype
                );
                finalImages.push(result.url);
            }
        }

        product.images = finalImages;
        await product.save();

        // Update inventory if stock changed
        await Inventory.findOneAndUpdate(
            { product: product._id },
            {
                totalStock: product.stock,
                lowStockThreshold: product.lowStockThreshold || 5
            },
            { upsert: true }
        );

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

// @route   DELETE /api/admin/products/:id
// @desc    Delete product
// @access  Admin only
router.delete('/products/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        // Delete images from Supabase
        try {
            await deleteProductImages(product._id.toString());
        } catch (err) {
            console.error('Error deleting product images:', err);
        }

        // Delete inventory record
        await Inventory.deleteOne({ product: product._id });

        // Delete product
        await product.deleteOne();

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

// ========== ORDER MANAGEMENT ==========

// @route   GET /api/admin/orders
// @desc    Get all orders with filters
// @access  Admin only
router.get('/orders', async (req, res) => {
    try {
        const { status, startDate, endDate, search, page = 1, limit = 20 } = req.query;

        let query = {};

        if (status) query.status = status;

        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        if (search) {
            query.$or = [
                { orderNumber: { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (Number(page) - 1) * Number(limit);

        const orders = await Order.find(query)
            .populate('user', 'name email phone')
            .populate('delivery.partner', 'name phone')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit));

        const total = await Order.countDocuments(query);

        res.json({
            success: true,
            data: orders,
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

// @route   GET /api/admin/delivery-partners
// @desc    Get all delivery partners
// @access  Admin only
router.get('/delivery-partners', async (req, res) => {
    try {
        const partners = await User.find({ role: 'delivery_partner', isActive: true })
            .select('name email phone');

        res.json({
            success: true,
            data: partners
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// @route   GET /api/admin/inventory-managers
// @desc    Get all inventory managers
// @access  Admin only
router.get('/inventory-managers', async (req, res) => {
    try {
        const managers = await User.find({ role: 'inventory_manager', isActive: true })
            .select('name email phone');

        res.json({
            success: true,
            data: managers
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});



module.exports = router;
