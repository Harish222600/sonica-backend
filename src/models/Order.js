const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    name: String,
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    price: {
        type: Number,
        required: true
    }
});

const orderSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    orderNumber: {
        type: String,
        unique: true
    },
    items: [orderItemSchema],
    shippingAddress: {
        street: { type: String, required: true },
        city: { type: String, required: true },
        state: { type: String, required: true },
        pincode: { type: String, required: true }
    },
    status: {
        type: String,
        enum: ['created', 'paid', 'packed', 'shipped', 'delivered', 'completed', 'cancelled'],
        default: 'created'
    },
    payment: {
        razorpayOrderId: String,
        razorpayPaymentId: String,
        razorpaySignature: String,
        method: String,
        status: {
            type: String,
            enum: ['pending', 'completed', 'failed', 'refunded'],
            default: 'pending'
        },
        paidAt: Date
    },
    delivery: {
        partner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        estimatedDate: Date,
        actualDate: Date,
        notes: String
    },
    totalAmount: {
        type: Number,
        required: true
    },
    statusHistory: [{
        status: String,
        timestamp: { type: Date, default: Date.now },
        note: String,
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }],
    cancellationReason: String,
    invoice: {
        number: String,
        generatedAt: Date
    }
}, {
    timestamps: true
});

// Generate order number before saving
orderSchema.pre('save', async function () {
    if (!this.orderNumber) {
        const count = await mongoose.model('Order').countDocuments();
        this.orderNumber = `SON-${Date.now()}-${(count + 1).toString().padStart(4, '0')}`;
    }
});

module.exports = mongoose.model('Order', orderSchema);
