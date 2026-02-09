const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Review = require('../models/Review');
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const { protect, adminOnly } = require('../middleware/auth');

// @route   GET /api/reviews/product/:productId
// @desc    Get reviews for a product
// @access  Public
router.get('/product/:productId', async (req, res) => {
    try {
        const { page = 1, limit = 10, sort = 'newest' } = req.query;

        let sortOption = {};
        switch (sort) {
            case 'newest': sortOption = { createdAt: -1 }; break;
            case 'highest': sortOption = { rating: -1 }; break;
            case 'lowest': sortOption = { rating: 1 }; break;
            case 'helpful': sortOption = { helpfulCount: -1 }; break;
            default: sortOption = { createdAt: -1 };
        }

        const skip = (Number(page) - 1) * Number(limit);

        const reviews = await Review.find({
            product: req.params.productId,
            isApproved: true,
            type: 'product' // Explicitly fetch product reviews
        })
            .populate('user', 'name avatar')
            .sort(sortOption)
            .skip(skip)
            .limit(Number(limit));

        const total = await Review.countDocuments({
            product: req.params.productId,
            isApproved: true,
            type: 'product'
        });

        // Get rating distribution
        const ratingStats = await Review.aggregate([
            { $match: { product: new mongoose.Types.ObjectId(req.params.productId), isApproved: true, type: 'product' } },
            { $group: { _id: '$rating', count: { $sum: 1 } } },
            { $sort: { _id: -1 } }
        ]);

        res.json({
            success: true,
            data: reviews,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit))
            },
            ratingStats
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// @route   GET /api/reviews/delivery/:partnerId
// @desc    Get reviews for a delivery partner
// @access  Private (Admin, Inventory, Delivery Partner)
router.get('/delivery/:partnerId', protect, async (req, res) => {
    try {
        const { page = 1, limit = 10, sort = 'newest' } = req.query;

        // Access check: only admin, inventory, or the partner themselves can see these reviews?
        // User request: "displayed to the delivery person", "visible to admin and inventory manager".
        // Customer reviews of delivery are generally private to the company/partner, not public to other customers.
        if (req.user.role === 'customer') {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }
        // If delivery partner, can only see own reviews
        if (req.user.role === 'delivery_partner' && req.user._id.toString() !== req.params.partnerId) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        let sortOption = { createdAt: -1 };

        const skip = (Number(page) - 1) * Number(limit);

        const reviews = await Review.find({
            deliveryPartner: req.params.partnerId,
            isApproved: true,
            type: 'delivery'
        })
            .populate('user', 'name avatar') // Reviewer
            .sort(sortOption)
            .skip(skip)
            .limit(Number(limit));

        const total = await Review.countDocuments({
            deliveryPartner: req.params.partnerId,
            isApproved: true,
            type: 'delivery'
        });

        const ratingStats = await Review.aggregate([
            { $match: { deliveryPartner: new mongoose.Types.ObjectId(req.params.partnerId), isApproved: true, type: 'delivery' } },
            { $group: { _id: '$rating', count: { $sum: 1 } } },
            { $sort: { _id: -1 } }
        ]);

        res.json({
            success: true,
            data: reviews,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit))
            },
            ratingStats
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// @route   POST /api/reviews
// @desc    Add a review (Product or Delivery)
// @access  Private
router.post('/', protect, async (req, res) => {
    try {
        console.log('POST /api/reviews request body:', req.body);
        const { type = 'product', productId, orderId, rating, title, comment } = req.body;

        if (type === 'product') {
            // Check if product exists
            const product = await Product.findById(productId);
            if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

            // Check if user already reviewed this product
            // Assuming one review per product per user
            const existingReview = await Review.findOne({ product: productId, user: req.user._id, type: 'product' });
            if (existingReview) return res.status(400).json({ success: false, message: 'You have already reviewed this product' });

            // Check if verified purchase
            // Relaxes verification to "Has ordered this product anytime"
            const hasOrdered = await Order.findOne({
                user: req.user._id,
                'items.product': productId,
                status: { $in: ['delivered', 'completed'] }
            });

            console.log('Creating product review:', { productId, user: req.user._id, isVerified: !!hasOrdered });

            const review = await Review.create({
                type: 'product',
                product: productId,
                user: req.user._id,
                rating, title, comment,
                isVerifiedPurchase: !!hasOrdered,
                order: orderId || (hasOrdered ? hasOrdered._id : undefined) // Link to order if provided or found
            });

            // Update product ratings
            const reviews = await Review.find({ product: productId, isApproved: true, type: 'product' });
            const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
            await Product.findByIdAndUpdate(productId, {
                'ratings.average': Math.round(avgRating * 10) / 10,
                'ratings.count': reviews.length
            });

            return res.status(201).json({ success: true, data: await Review.findById(review._id).populate('user', 'name avatar') });

        } else if (type === 'delivery') {
            // For delivery reviews, we require orderId to identify the partner and interaction
            if (!orderId) return res.status(400).json({ success: false, message: 'Order ID is required for delivery reviews' });

            console.log('Processing delivery review for order:', orderId);

            const order = await Order.findById(orderId).populate('delivery.partner');
            if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

            console.log('Found order:', { id: order._id, partner: order.delivery?.partner });

            // Check authorization
            if (order.user.toString() !== req.user._id.toString()) {
                return res.status(403).json({ success: false, message: 'Not authorized to review this delivery' });
            }

            // Check status
            if (!['delivered', 'completed'].includes(order.status)) {
                return res.status(400).json({ success: false, message: 'Order must be delivered to leave a review' });
            }

            const deliveryPartnerId = order.delivery?.partner?._id;
            if (!deliveryPartnerId) {
                return res.status(400).json({ success: false, message: 'No delivery partner assigned to this order' });
            }

            // Check duplicate
            const existingReview = await Review.findOne({ order: orderId, type: 'delivery' });
            if (existingReview) {
                return res.status(400).json({ success: false, message: 'You have already reviewed this delivery' });
            }

            console.log('Creating delivery review');

            const review = await Review.create({
                type: 'delivery',
                deliveryPartner: deliveryPartnerId,
                order: orderId,
                user: req.user._id,
                rating, title, comment,
                isVerifiedPurchase: true, // Always verified for delivery tied to order
                isApproved: true
            });

            console.log('Review created, updating partner stats');

            // Update delivery partner ratings
            const reviews = await Review.find({ deliveryPartner: deliveryPartnerId, isApproved: true, type: 'delivery' });
            const avgRating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;

            await User.findByIdAndUpdate(deliveryPartnerId, {
                'rating.average': Math.round(avgRating * 10) / 10,
                'rating.count': reviews.length
            });

            console.log('Partner stats updated');

            return res.status(201).json({ success: true, data: await Review.findById(review._id).populate('user', 'name avatar') });

        } else {
            return res.status(400).json({ success: false, message: 'Invalid review type' });
        }

    } catch (error) {
        console.error('Error in POST /api/reviews:', error);
        res.status(500).json({ success: false, message: error.message, stack: error.stack });
    }
});

// @route   PUT /api/reviews/:id
// @desc    Update a review
// @access  Private (owner only)
router.put('/:id', protect, async (req, res) => {
    try {
        const { rating, title, comment } = req.body;
        const review = await Review.findById(req.params.id);

        if (!review) return res.status(404).json({ success: false, message: 'Review not found' });
        if (review.user.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: 'Not authorized' });

        review.rating = rating || review.rating;
        review.title = title || review.title;
        review.comment = comment || review.comment;
        await review.save();

        // Update ratings
        if (review.type === 'product') {
            const reviews = await Review.find({ product: review.product, isApproved: true, type: 'product' });
            const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
            await Product.findByIdAndUpdate(review.product, { 'ratings.average': Math.round(avgRating * 10) / 10 });
        } else if (review.type === 'delivery') {
            const reviews = await Review.find({ deliveryPartner: review.deliveryPartner, isApproved: true, type: 'delivery' });
            const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
            await User.findByIdAndUpdate(review.deliveryPartner, { 'rating.average': Math.round(avgRating * 10) / 10 });
        }

        res.json({ success: true, data: review });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// @route   DELETE /api/reviews/:id
// @desc    Delete a review
// @access  Private (owner or admin)
router.delete('/:id', protect, async (req, res) => {
    try {
        const review = await Review.findById(req.params.id);
        if (!review) return res.status(404).json({ success: false, message: 'Review not found' });

        if (review.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        await review.deleteOne();

        // Update ratings
        if (review.type === 'product') {
            const reviews = await Review.find({ product: review.product, isApproved: true, type: 'product' });
            const avgRating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;
            await Product.findByIdAndUpdate(review.product, { 'ratings.average': Math.round(avgRating * 10) / 10, 'ratings.count': reviews.length });
        } else if (review.type === 'delivery') {
            const reviews = await Review.find({ deliveryPartner: review.deliveryPartner, isApproved: true, type: 'delivery' });
            const avgRating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;
            await User.findByIdAndUpdate(review.deliveryPartner, { 'rating.average': Math.round(avgRating * 10) / 10, 'rating.count': reviews.length });
        }

        res.json({ success: true, message: 'Review deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// @route   PUT /api/reviews/:id/moderate
// @desc    Moderate a review (approve/reject)
// @access  Admin only
router.put('/:id/moderate', protect, adminOnly, async (req, res) => {
    try {
        const { isApproved } = req.body;
        const review = await Review.findByIdAndUpdate(req.params.id, { isApproved }, { new: true }).populate('user', 'name');

        if (!review) return res.status(404).json({ success: false, message: 'Review not found' });

        // Update ratings
        if (review.type === 'product') {
            const reviews = await Review.find({ product: review.product, isApproved: true, type: 'product' });
            const avgRating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;
            await Product.findByIdAndUpdate(review.product, { 'ratings.average': Math.round(avgRating * 10) / 10, 'ratings.count': reviews.length });
        } else if (review.type === 'delivery') {
            const reviews = await Review.find({ deliveryPartner: review.deliveryPartner, isApproved: true, type: 'delivery' });
            const avgRating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;
            await User.findByIdAndUpdate(review.deliveryPartner, { 'rating.average': Math.round(avgRating * 10) / 10, 'rating.count': reviews.length });
        }

        res.json({ success: true, data: review });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// @route   GET /api/reviews/pending
// @desc    Get pending reviews for moderation
// @access  Admin only
router.get('/pending', protect, adminOnly, async (req, res) => {
    try {
        const reviews = await Review.find({ isApproved: false })
            .populate('user', 'name email')
            .populate('product', 'name images')
            .populate('deliveryPartner', 'name email') // Link delivery partner if exists
            .sort({ createdAt: -1 });

        res.json({ success: true, data: reviews });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
