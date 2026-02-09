const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { protect, adminOnly } = require('../middleware/auth');

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// @route   POST /api/payments/create-order
// @desc    Create Razorpay order
// @access  Private
router.post('/create-order', protect, async (req, res) => {
    try {
        const { orderId } = req.body;

        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        if (order.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized'
            });
        }

        if (order.payment.status === 'completed') {
            return res.status(400).json({
                success: false,
                message: 'Order already paid'
            });
        }

        const options = {
            amount: Math.round(order.totalAmount * 100), // Amount in paise
            currency: 'INR',
            receipt: order.orderNumber,
            notes: {
                orderId: order._id.toString(),
                userId: req.user._id.toString()
            }
        };

        const razorpayOrder = await razorpay.orders.create(options);

        // Store Razorpay order ID
        order.payment.razorpayOrderId = razorpayOrder.id;
        await order.save();

        res.json({
            success: true,
            data: {
                orderId: razorpayOrder.id,
                amount: razorpayOrder.amount,
                currency: razorpayOrder.currency,
                key: process.env.RAZORPAY_KEY_ID
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// @route   POST /api/payments/verify
// @desc    Verify Razorpay payment
// @access  Private
router.post('/verify', protect, async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            orderId
        } = req.body;

        // Verify signature
        const body = razorpay_order_id + '|' + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest('hex');

        if (expectedSignature !== razorpay_signature) {
            return res.status(400).json({
                success: false,
                message: 'Invalid payment signature'
            });
        }

        // Update order
        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Get payment details from Razorpay
        const paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);

        order.payment = {
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
            razorpaySignature: razorpay_signature,
            method: paymentDetails.method,
            status: 'completed',
            paidAt: new Date()
        };

        order.status = 'paid';
        order.statusHistory.push({
            status: 'paid',
            note: `Payment completed via ${paymentDetails.method}`,
            updatedBy: req.user._id
        });

        // Update product stock (move from reserved to sold)
        for (const item of order.items) {
            await Product.findByIdAndUpdate(item.product, {
                $inc: {
                    stock: -item.quantity,
                    reservedStock: -item.quantity
                }
            });
        }

        await order.save();

        res.json({
            success: true,
            message: 'Payment verified successfully',
            data: order
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// @route   POST /api/payments/webhook
// @desc    Razorpay webhook handler
// @access  Public (verified via signature)
router.post('/webhook', async (req, res) => {
    try {
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
        const signature = req.headers['x-razorpay-signature'];

        const shasum = crypto.createHmac('sha256', webhookSecret);
        shasum.update(JSON.stringify(req.body));
        const digest = shasum.digest('hex');

        if (digest !== signature) {
            return res.status(400).json({
                success: false,
                message: 'Invalid webhook signature'
            });
        }

        const event = req.body.event;
        const payload = req.body.payload;

        switch (event) {
            case 'payment.captured':
                // Payment successful - update order if not already updated
                const paymentEntity = payload.payment.entity;
                const order = await Order.findOne({
                    'payment.razorpayOrderId': paymentEntity.order_id
                });

                if (order && order.payment.status !== 'completed') {
                    order.payment.status = 'completed';
                    order.payment.razorpayPaymentId = paymentEntity.id;
                    order.payment.method = paymentEntity.method;
                    order.payment.paidAt = new Date();
                    order.status = 'paid';
                    await order.save();
                }
                break;

            case 'payment.failed':
                // Payment failed
                const failedPayment = payload.payment.entity;
                const failedOrder = await Order.findOne({
                    'payment.razorpayOrderId': failedPayment.order_id
                });

                if (failedOrder) {
                    failedOrder.payment.status = 'failed';
                    failedOrder.statusHistory.push({
                        status: failedOrder.status,
                        note: `Payment failed: ${failedPayment.error_description}`
                    });
                    await failedOrder.save();
                }
                break;

            case 'refund.created':
                // Refund initiated
                const refundEntity = payload.refund.entity;
                const refundOrder = await Order.findOne({
                    'payment.razorpayPaymentId': refundEntity.payment_id
                });

                if (refundOrder) {
                    refundOrder.payment.status = 'refunded';
                    refundOrder.statusHistory.push({
                        status: 'refunded',
                        note: `Refund of ₹${refundEntity.amount / 100} initiated`
                    });
                    await refundOrder.save();
                }
                break;
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// @route   POST /api/payments/refund
// @desc    Process refund
// @access  Admin only
router.post('/refund', protect, adminOnly, async (req, res) => {
    try {
        const { orderId, amount, reason } = req.body;

        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        if (!order.payment.razorpayPaymentId) {
            return res.status(400).json({
                success: false,
                message: 'No payment to refund'
            });
        }

        const refundAmount = amount ? Math.round(amount * 100) : Math.round(order.totalAmount * 100);

        const refund = await razorpay.payments.refund(order.payment.razorpayPaymentId, {
            amount: refundAmount,
            notes: {
                reason: reason || 'Customer refund request'
            }
        });

        order.payment.status = 'refunded';
        order.status = 'cancelled';
        order.statusHistory.push({
            status: 'cancelled',
            note: `Refund processed: ₹${refundAmount / 100}. ${reason || ''}`,
            updatedBy: req.user._id
        });

        await order.save();

        res.json({
            success: true,
            data: {
                refundId: refund.id,
                amount: refund.amount / 100,
                status: refund.status
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// @route   GET /api/payments/transactions
// @desc    Get payment transactions
// @access  Admin only
router.get('/transactions', protect, adminOnly, async (req, res) => {
    try {
        const { page = 1, limit = 20, status } = req.query;

        let query = { 'payment.razorpayPaymentId': { $exists: true } };

        if (status) {
            query['payment.status'] = status;
        }

        const skip = (Number(page) - 1) * Number(limit);

        const orders = await Order.find(query)
            .select('orderNumber payment totalAmount user createdAt')
            .populate('user', 'name email')
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

module.exports = router;
