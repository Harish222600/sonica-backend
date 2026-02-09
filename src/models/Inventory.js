const mongoose = require('mongoose');

const stockHistorySchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['in', 'out', 'reserved', 'released', 'returned', 'adjustment'],
        required: true
    },
    quantity: {
        type: Number,
        required: true
    },
    previousStock: Number,
    newStock: Number,
    reason: String,
    reference: {
        type: String // Order ID or other reference
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

const inventorySchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
        unique: true
    },
    totalStock: {
        type: Number,
        required: true,
        default: 0,
        min: 0
    },
    reservedStock: {
        type: Number,
        default: 0,
        min: 0
    },
    lowStockThreshold: {
        type: Number,
        default: 5
    },
    location: {
        warehouse: String,
        shelf: String,
        bin: String
    },
    stockHistory: [stockHistorySchema],
    lastRestocked: Date,
    lastSold: Date
}, {
    timestamps: true
});

// Virtual for available stock
inventorySchema.virtual('availableStock').get(function () {
    return this.totalStock - this.reservedStock;
});

// Check if low stock
inventorySchema.virtual('isLowStock').get(function () {
    return (this.totalStock - this.reservedStock) <= this.lowStockThreshold;
});

inventorySchema.set('toJSON', { virtuals: true });
inventorySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Inventory', inventorySchema);
