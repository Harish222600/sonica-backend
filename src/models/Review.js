const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['product', 'delivery'],
        default: 'product',
        required: true
    },
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: function () { return this.type === 'product'; }
    },
    deliveryPartner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: function () { return this.type === 'delivery'; }
    },
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order'
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    rating: {
        type: Number,
        required: [true, 'Rating is required'],
        min: 1,
        max: 5
    },
    title: {
        type: String,
        trim: true
    },
    comment: {
        type: String,
        required: [true, 'Review comment is required']
    },
    isVerifiedPurchase: {
        type: Boolean,
        default: false
    },
    isApproved: {
        type: Boolean,
        default: true
    },
    helpfulCount: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Ensure one review per user per product
reviewSchema.index({ product: 1, user: 1 }, { unique: true, partialFilterExpression: { type: 'product' } });

// Ensure one review per order per delivery partner (or just per order for delivery review)
reviewSchema.index({ order: 1, type: 1 }, { unique: true, partialFilterExpression: { type: 'delivery' } });

module.exports = mongoose.model('Review', reviewSchema);
