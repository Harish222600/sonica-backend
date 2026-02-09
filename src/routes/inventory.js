const express = require('express');
const router = express.Router();
const Inventory = require('../models/Inventory');
const Product = require('../models/Product');
const { protect, inventoryAccess } = require('../middleware/auth');

// @route   GET /api/inventory
// @desc    Get all inventory
// @access  Inventory Manager / Admin
router.get('/', protect, inventoryAccess, async (req, res) => {
    try {
        const { lowStock, search, page = 1, limit = 20 } = req.query;

        let query = {};

        const skip = (Number(page) - 1) * Number(limit);

        let inventoryItems = await Inventory.find(query)
            .populate('product', 'name category images price')
            .sort({ updatedAt: -1 })
            .skip(skip)
            .limit(Number(limit));

        // Filter low stock in memory (since it's a virtual)
        if (lowStock === 'true') {
            inventoryItems = inventoryItems.filter(item => item.isLowStock);
        }

        // Search filter
        if (search) {
            const searchLower = search.toLowerCase();
            inventoryItems = inventoryItems.filter(item =>
                item.product && item.product.name.toLowerCase().includes(searchLower)
            );
        }

        const total = await Inventory.countDocuments(query);

        res.json({
            success: true,
            data: inventoryItems,
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

// @route   GET /api/inventory/low-stock
// @desc    Get low stock items
// @access  Inventory Manager / Admin
router.get('/low-stock', protect, inventoryAccess, async (req, res) => {
    try {
        const inventoryItems = await Inventory.find()
            .populate('product', 'name category images price');

        const lowStockItems = inventoryItems.filter(item => item.isLowStock);

        res.json({
            success: true,
            data: lowStockItems,
            count: lowStockItems.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// @route   GET /api/inventory/analytics
// @desc    Get inventory analytics
// @access  Inventory Manager / Admin
router.get('/analytics', protect, inventoryAccess, async (req, res) => {
    try {
        const inventory = await Inventory.find().populate('product', 'name category price');

        let totalStock = 0;
        let reservedStock = 0;
        let totalValue = 0;
        let lowStockCount = 0;
        let outOfStockCount = 0;
        const categoryBreakdown = {};

        inventory.forEach(item => {
            totalStock += item.totalStock;
            reservedStock += item.reservedStock;

            if (item.product) {
                totalValue += item.totalStock * item.product.price;

                const category = item.product.category || 'uncategorized';
                if (!categoryBreakdown[category]) {
                    categoryBreakdown[category] = { count: 0, stock: 0, value: 0 };
                }
                categoryBreakdown[category].count++;
                categoryBreakdown[category].stock += item.totalStock;
                categoryBreakdown[category].value += item.totalStock * item.product.price;
            }

            if (item.totalStock === 0) {
                outOfStockCount++;
            }

            if (item.isLowStock) {
                lowStockCount++;
            }
        });

        // Mock stock trend data for the last 7 days (since we don't have a daily snapshot model yet)
        const today = new Date();
        const stockTrend = Array.from({ length: 7 }, (_, i) => {
            const date = new Date(today);
            date.setDate(date.getDate() - (6 - i));
            return {
                date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                value: Math.floor(totalValue * (0.9 + Math.random() * 0.2)), // Random variation around total value
                stock: Math.floor(totalStock * (0.95 + Math.random() * 0.1))
            };
        });

        const categoryData = Object.entries(categoryBreakdown).map(([name, data]) => ({
            name,
            value: data.value,
            stock: data.stock,
            count: data.count
        }));

        res.json({
            success: true,
            data: {
                totalProducts: inventory.length,
                totalStock,
                reservedStock,
                availableStock: totalStock - reservedStock,
                totalInventoryValue: totalValue,
                lowStockCount,
                outOfStockCount,
                categoryBreakdown: categoryData,
                stockTrend
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// @route   GET /api/inventory/:productId
// @desc    Get inventory for a product
// @access  Inventory Manager / Admin
router.get('/:productId', protect, inventoryAccess, async (req, res) => {
    try {
        const inventory = await Inventory.findOne({ product: req.params.productId })
            .populate('product', 'name category images price');

        if (!inventory) {
            return res.status(404).json({
                success: false,
                message: 'Inventory record not found'
            });
        }

        res.json({
            success: true,
            data: inventory
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// @route   POST /api/inventory/add-stock
// @desc    Add stock for a product
// @access  Inventory Manager / Admin
router.post('/add-stock', protect, inventoryAccess, async (req, res) => {
    try {
        const { productId, quantity, reason, location } = req.body;

        if (!productId || !quantity || quantity < 1) {
            return res.status(400).json({
                success: false,
                message: 'Product ID and quantity are required'
            });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        let inventory = await Inventory.findOne({ product: productId });

        if (!inventory) {
            inventory = new Inventory({
                product: productId,
                totalStock: 0,
                location
            });
        }

        const previousStock = inventory.totalStock;
        inventory.totalStock += quantity;
        inventory.lastRestocked = new Date();

        if (location) {
            inventory.location = location;
        }

        inventory.stockHistory.push({
            type: 'in',
            quantity,
            previousStock,
            newStock: inventory.totalStock,
            reason: reason || 'Stock added',
            updatedBy: req.user._id
        });

        await inventory.save();

        // Update product stock as well
        await Product.findByIdAndUpdate(productId, {
            stock: inventory.totalStock
        });

        res.json({
            success: true,
            data: inventory
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// @route   PUT /api/inventory/:productId
// @desc    Update inventory (set absolute value)
// @access  Inventory Manager / Admin
router.put('/:productId', protect, inventoryAccess, async (req, res) => {
    try {
        const { totalStock, lowStockThreshold, location, reason } = req.body;

        let inventory = await Inventory.findOne({ product: req.params.productId });

        if (!inventory) {
            return res.status(404).json({
                success: false,
                message: 'Inventory record not found'
            });
        }

        const previousStock = inventory.totalStock;

        if (totalStock !== undefined) {
            inventory.totalStock = totalStock;

            inventory.stockHistory.push({
                type: 'adjustment',
                quantity: totalStock - previousStock,
                previousStock,
                newStock: totalStock,
                reason: reason || 'Manual adjustment',
                updatedBy: req.user._id
            });

            // Update product stock
            await Product.findByIdAndUpdate(req.params.productId, {
                stock: totalStock
            });
        }

        if (lowStockThreshold !== undefined) {
            inventory.lowStockThreshold = lowStockThreshold;
        }

        if (location) {
            inventory.location = location;
        }

        await inventory.save();

        res.json({
            success: true,
            data: inventory
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// @route   POST /api/inventory/:productId/remove-stock
// @desc    Remove stock (damaged, returned, etc.)
// @access  Inventory Manager / Admin
router.post('/:productId/remove-stock', protect, inventoryAccess, async (req, res) => {
    try {
        const { quantity, reason, type = 'out' } = req.body;

        if (!quantity || quantity < 1) {
            return res.status(400).json({
                success: false,
                message: 'Quantity is required'
            });
        }

        const inventory = await Inventory.findOne({ product: req.params.productId });

        if (!inventory) {
            return res.status(404).json({
                success: false,
                message: 'Inventory record not found'
            });
        }

        const availableStock = inventory.totalStock - inventory.reservedStock;
        if (quantity > availableStock) {
            return res.status(400).json({
                success: false,
                message: `Cannot remove ${quantity}. Only ${availableStock} available (unreserved).`
            });
        }

        const previousStock = inventory.totalStock;
        inventory.totalStock -= quantity;

        inventory.stockHistory.push({
            type,
            quantity: -quantity,
            previousStock,
            newStock: inventory.totalStock,
            reason: reason || 'Stock removed',
            updatedBy: req.user._id
        });

        await inventory.save();

        // Update product stock
        await Product.findByIdAndUpdate(req.params.productId, {
            stock: inventory.totalStock
        });

        res.json({
            success: true,
            data: inventory
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;
