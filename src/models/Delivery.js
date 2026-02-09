const mongoose = require('mongoose');

const deliverySchema = new mongoose.Schema({
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true
    },
    partner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['assigned', 'picked', 'in_transit', 'out_for_delivery', 'delivered', 'failed'],
        default: 'assigned'
    },
    estimatedDate: {
        type: Date
    },
    actualDeliveryDate: {
        type: Date
    },
    pickupAddress: {
        street: String,
        city: String,
        state: String,
        pincode: String
    },
    deliveryAddress: {
        street: String,
        city: String,
        state: String,
        pincode: String
    },
    notes: String,
    customerSignature: String,
    proofOfDelivery: String,
    statusHistory: [{
        status: String,
        timestamp: { type: Date, default: Date.now },
        location: String,
        note: String
    }],
    failureReason: String,
    attempts: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Delivery', deliverySchema);
