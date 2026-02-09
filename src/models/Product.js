const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Product name is required'],
        trim: true
    },
    description: {
        type: String,
        required: [true, 'Product description is required']
    },
    category: {
        type: String,
        required: [true, 'Category is required'],
        enum: ['mountain', 'road', 'hybrid', 'electric', 'kids', 'accessories']
    },
    price: {
        type: Number,
        required: [true, 'Price is required'],
        min: 0
    },
    discountPrice: {
        type: Number,
        min: 0,
        default: 0
    },
    specifications: {
        brand: { type: String, default: '' },
        model: { type: String, default: '' },
        frameSize: { type: String, default: '' },
        wheelSize: { type: String, default: '' },
        weight: { type: String, default: '' },
        color: { type: String, default: '' },
        material: { type: String, default: '' },
        gears: { type: Number, default: 1 },
        brakeType: { type: String, default: '' }
    },
    images: [{
        type: String
    }],
    stock: {
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
    isAvailable: {
        type: Boolean,
        default: true
    },
    isFeatured: {
        type: Boolean,
        default: false
    },
    ratings: {
        average: { type: Number, default: 0, min: 0, max: 5 },
        count: { type: Number, default: 0 }
    },
    tags: [{
        type: String
    }]
}, {
    timestamps: true
});

// Virtual for available stock
productSchema.virtual('availableStock').get(function () {
    return this.stock - this.reservedStock;
});

// Index for search
productSchema.index({ name: 'text', description: 'text', 'specifications.brand': 'text' });

module.exports = mongoose.model('Product', productSchema);
