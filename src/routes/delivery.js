const express = require('express');
const router = express.Router();
const Delivery = require('../models/Delivery');
const Order = require('../models/Order');
const { protect, deliveryAccess, adminOnly } = require('../middleware/auth');

// @route   GET /api/delivery/assigned
// @desc    Get assigned deliveries for current delivery partner
// @access  Delivery Partner
router.get('/assigned', protect, deliveryAccess, async (req, res) => {
    try {
        const { status } = req.query;

        let query = {};

        // If delivery partner, only show their deliveries
        if (req.user.role === 'delivery_partner') {
            query.partner = req.user._id;
        }

        if (status) {
            query.status = status;
        }

        const deliveries = await Delivery.find(query)
            .populate({
                path: 'order',
                select: 'orderNumber items totalAmount shippingAddress status',
                populate: {
                    path: 'items.product',
                    select: 'name images'
                }
            })
            .populate('partner', 'name phone')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            data: deliveries
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// @route   GET /api/delivery/:id
// @desc    Get single delivery details
// @access  Delivery Partner / Admin
router.get('/:id', protect, deliveryAccess, async (req, res) => {
    try {
        const delivery = await Delivery.findById(req.params.id)
            .populate({
                path: 'order',
                populate: [
                    { path: 'user', select: 'name phone email' },
                    { path: 'items.product', select: 'name images' }
                ]
            })
            .populate('partner', 'name phone');

        if (!delivery) {
            return res.status(404).json({
                success: false,
                message: 'Delivery not found'
            });
        }

        // Check access
        if (req.user.role === 'delivery_partner' &&
            delivery.partner._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized'
            });
        }

        res.json({
            success: true,
            data: delivery
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// @route   PUT /api/delivery/:id/status
// @desc    Update delivery status
// @access  Delivery Partner / Admin
router.put('/:id/status', protect, deliveryAccess, async (req, res) => {
    try {
        const { status, note, location } = req.body;

        const validStatuses = ['assigned', 'picked', 'in_transit', 'out_for_delivery', 'delivered', 'failed'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status'
            });
        }

        const delivery = await Delivery.findById(req.params.id);

        if (!delivery) {
            return res.status(404).json({
                success: false,
                message: 'Delivery not found'
            });
        }

        // Check access
        if (req.user.role === 'delivery_partner' &&
            delivery.partner.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized'
            });
        }

        delivery.status = status;
        delivery.statusHistory.push({
            status,
            location,
            note,
            timestamp: new Date()
        });

        // Update order status based on delivery status
        const order = await Order.findById(delivery.order);
        if (order) {
            if (status === 'picked') {
                order.status = 'packed';
            } else if (status === 'in_transit' || status === 'out_for_delivery') {
                order.status = 'shipped';
            } else if (status === 'delivered') {
                order.status = 'delivered';
                delivery.actualDeliveryDate = new Date();
            }

            order.statusHistory.push({
                status: order.status,
                note: `Delivery status: ${status}`,
                updatedBy: req.user._id
            });

            await order.save();
        }

        await delivery.save();

        res.json({
            success: true,
            data: delivery
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// @route   POST /api/delivery/:id/confirm
// @desc    Confirm delivery completion
// @access  Delivery Partner
router.post('/:id/confirm', protect, deliveryAccess, async (req, res) => {
    try {
        const { signature, proofImage, note } = req.body;

        const delivery = await Delivery.findById(req.params.id);

        if (!delivery) {
            return res.status(404).json({
                success: false,
                message: 'Delivery not found'
            });
        }

        // Check access
        if (req.user.role === 'delivery_partner' &&
            delivery.partner.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized'
            });
        }

        delivery.status = 'delivered';
        delivery.actualDeliveryDate = new Date();
        delivery.customerSignature = signature;
        delivery.proofOfDelivery = proofImage;

        delivery.statusHistory.push({
            status: 'delivered',
            note: note || 'Delivery confirmed',
            timestamp: new Date()
        });

        await delivery.save();

        // Update order to completed
        const order = await Order.findById(delivery.order);
        if (order) {
            order.status = 'completed';
            order.delivery.actualDate = new Date();
            order.statusHistory.push({
                status: 'completed',
                note: 'Order delivered and confirmed',
                updatedBy: req.user._id
            });
            await order.save();
        }

        res.json({
            success: true,
            message: 'Delivery confirmed successfully',
            data: delivery
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// @route   POST /api/delivery/assign
// @desc    Assign delivery to partner
// @access  Admin only
router.post('/assign', protect, adminOnly, async (req, res) => {
    try {
        const { orderId, partnerId, estimatedDate, pickupAddress } = req.body;

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Check if delivery already exists
        let delivery = await Delivery.findOne({ order: orderId });

        if (delivery) {
            // Update existing delivery
            delivery.partner = partnerId;
            delivery.estimatedDate = estimatedDate;
            if (pickupAddress) delivery.pickupAddress = pickupAddress;
        } else {
            // Create new delivery
            delivery = new Delivery({
                order: orderId,
                partner: partnerId,
                estimatedDate,
                pickupAddress,
                deliveryAddress: order.shippingAddress,
                statusHistory: [{
                    status: 'assigned',
                    note: 'Delivery assigned',
                    timestamp: new Date()
                }]
            });
        }

        await delivery.save();

        // Update order with delivery info
        order.delivery = {
            partner: partnerId,
            estimatedDate
        };
        await order.save();

        const populatedDelivery = await Delivery.findById(delivery._id)
            .populate('partner', 'name phone')
            .populate('order', 'orderNumber');

        res.json({
            success: true,
            data: populatedDelivery
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// @route   GET /api/delivery/all
// @desc    Get all deliveries
// @access  Admin only
router.get('/all', protect, adminOnly, async (req, res) => {
    try {
        const { status, partnerId, page = 1, limit = 20 } = req.query;

        let query = {};

        if (status) query.status = status;
        if (partnerId) query.partner = partnerId;

        const skip = (Number(page) - 1) * Number(limit);

        const deliveries = await Delivery.find(query)
            .populate('order', 'orderNumber totalAmount shippingAddress')
            .populate('partner', 'name phone')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit));

        const total = await Delivery.countDocuments(query);

        res.json({
            success: true,
            data: deliveries,
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

// @route   GET /api/delivery/stats
// @desc    Get delivery partner performance stats
// @access  Delivery Partner only
router.get('/stats', protect, deliveryAccess, async (req, res) => {
    try {
        const partnerId = req.user._id;

        // Fetch all deliveries for this partner
        const deliveries = await Delivery.find({ partner: partnerId }).sort({ createdAt: -1 });

        const totalDeliveries = deliveries.length;
        const deliveredCount = deliveries.filter(d => d.status === 'delivered').length;
        const failedCount = deliveries.filter(d => d.status === 'failed').length;

        // Calculate Success Rate
        const successRate = totalDeliveries > 0
            ? Math.round((deliveredCount / totalDeliveries) * 100)
            : 0;

        // Mock Earnings (Assumes ₹50 per delivery)
        const RATE_PER_DELIVERY = 50;
        const totalEarnings = deliveredCount * RATE_PER_DELIVERY;

        // Mock Earnings History (Last 7 Days)
        const today = new Date();
        const earningsHistory = Array.from({ length: 7 }, (_, i) => {
            const date = new Date(today);
            date.setDate(date.getDate() - (6 - i));

            // Randomly distribute deliveries over the week
            const dailyCount = Math.floor(Math.random() * 5);
            const dailyEarnings = dailyCount * RATE_PER_DELIVERY;

            return {
                date: date.toLocaleDateString('en-US', { weekday: 'short' }),
                earnings: dailyEarnings,
                deliveries: dailyCount
            };
        });

        // Activity Heatmap (Mocked - Busiest Hours)
        const activityHeatmap = [
            { time: 'Morning (8-12)', value: 30 },
            { time: 'Afternoon (12-4)', value: 55 },
            { time: 'Evening (4-8)', value: 85 },
            { time: 'Night (8-12)', value: 20 }
        ];

        // Status Distribution for Pie Chart
        const statusDistribution = [
            { name: 'Delivered', value: deliveredCount, fill: '#00C49F' },
            { name: 'Failed', value: failedCount, fill: '#FF8042' },
            { name: 'In Progress', value: totalDeliveries - deliveredCount - failedCount, fill: '#FFBB28' }
        ];

        res.json({
            success: true,
            data: {
                metrics: {
                    totalEarnings,
                    totalDeliveries,
                    successRate,
                    avgDeliveryTime: '45 mins', // Mocked
                    rating: 4.8 // Mocked
                },
                charts: {
                    earningsHistory,
                    activityHeatmap,
                    statusDistribution
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;
