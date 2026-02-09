const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { protect, adminOnly } = require('../middleware/auth');

// @route   POST /api/orders
// @desc    Create new order from cart
// @access  Private
router.post('/', protect, async (req, res) => {
    try {
        const { shippingAddress } = req.body;

        if (!shippingAddress) {
            return res.status(400).json({
                success: false,
                message: 'Shipping address is required'
            });
        }

        const cart = await Cart.findOne({ user: req.user._id })
            .populate('items.product');

        if (!cart || cart.items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Cart is empty'
            });
        }

        // Validate stock availability
        for (const item of cart.items) {
            const product = item.product;
            const availableStock = product.stock - product.reservedStock;

            if (item.quantity > availableStock) {
                return res.status(400).json({
                    success: false,
                    message: `Insufficient stock for ${product.name}. Only ${availableStock} available.`
                });
            }
        }

        // Reserve stock
        for (const item of cart.items) {
            await Product.findByIdAndUpdate(item.product._id, {
                $inc: { reservedStock: item.quantity }
            });
        }

        // Create order items
        const orderItems = cart.items.map(item => ({
            product: item.product._id,
            name: item.product.name,
            quantity: item.quantity,
            price: item.price
        }));

        const order = await Order.create({
            user: req.user._id,
            items: orderItems,
            shippingAddress,
            totalAmount: cart.totalAmount,
            statusHistory: [{
                status: 'created',
                note: 'Order placed'
            }]
        });

        // Clear cart
        cart.items = [];
        await cart.save();

        res.status(201).json({
            success: true,
            data: order
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// @route   GET /api/orders
// @desc    Get user orders (customers) or all orders (admin)
// @access  Private
router.get('/', protect, async (req, res) => {
    try {
        const { status, page = 1, limit = 10 } = req.query;

        let query = {};

        // If not admin, only show user's orders
        if (req.user.role !== 'admin') {
            query.user = req.user._id;
        }

        if (status) {
            query.status = status;
        }

        const skip = (Number(page) - 1) * Number(limit);

        const orders = await Order.find(query)
            .populate('user', 'name email phone')
            .populate('items.product', 'name images')
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

// @route   GET /api/orders/:id
// @desc    Get single order
// @access  Private
router.get('/:id', protect, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('user', 'name email phone')
            .populate('items.product', 'name images price')
            .populate('delivery.partner', 'name phone');

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Check access
        if (req.user.role !== 'admin' && order.user._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view this order'
            });
        }

        res.json({
            success: true,
            data: order
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// @route   PUT /api/orders/:id/status
// @desc    Update order status
// @access  Admin only
router.put('/:id/status', protect, adminOnly, async (req, res) => {
    try {
        const { status, note } = req.body;

        const validStatuses = ['created', 'paid', 'packed', 'shipped', 'delivered', 'completed', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status'
            });
        }

        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        order.status = status;
        order.statusHistory.push({
            status,
            note,
            updatedBy: req.user._id
        });

        await order.save();

        res.json({
            success: true,
            data: order
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// @route   POST /api/orders/:id/cancel
// @desc    Cancel order
// @access  Private
router.post('/:id/cancel', protect, async (req, res) => {
    try {
        const { reason } = req.body;

        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Check access
        if (req.user.role !== 'admin' && order.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized'
            });
        }

        // Can only cancel if not shipped yet
        const nonCancellable = ['shipped', 'delivered', 'completed', 'cancelled'];
        if (nonCancellable.includes(order.status)) {
            return res.status(400).json({
                success: false,
                message: `Cannot cancel order in ${order.status} status`
            });
        }

        // Release reserved stock
        for (const item of order.items) {
            await Product.findByIdAndUpdate(item.product, {
                $inc: { reservedStock: -item.quantity }
            });
        }

        order.status = 'cancelled';
        order.cancellationReason = reason;
        order.statusHistory.push({
            status: 'cancelled',
            note: reason || 'Order cancelled',
            updatedBy: req.user._id
        });

        await order.save();

        res.json({
            success: true,
            data: order
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// @route   PUT /api/orders/:id/assign-delivery
// @desc    Assign delivery partner
// @access  Admin only
router.put('/:id/assign-delivery', protect, adminOnly, async (req, res) => {
    try {
        const { partnerId, estimatedDate } = req.body;

        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        order.delivery = {
            partner: partnerId,
            estimatedDate: estimatedDate ? new Date(estimatedDate) : undefined
        };

        order.statusHistory.push({
            status: order.status,
            note: 'Delivery partner assigned',
            updatedBy: req.user._id
        });

        await order.save();

        const updatedOrder = await Order.findById(order._id)
            .populate('delivery.partner', 'name phone');

        res.json({
            success: true,
            data: updatedOrder
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;
