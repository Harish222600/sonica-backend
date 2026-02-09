const express = require('express');
const router = express.Router();
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { protect } = require('../middleware/auth');

// @route   GET /api/cart
// @desc    Get user's cart
// @access  Private
router.get('/', protect, async (req, res) => {
    try {
        console.log('Cart GET - User ID:', req.user?._id);
        let cart = await Cart.findOne({ user: req.user._id })
            .populate('items.product', 'name price discountPrice images stock');

        if (!cart) {
            console.log('Creating new cart for user:', req.user._id);
            cart = await Cart.create({ user: req.user._id, items: [] });
            console.log('Cart created:', cart._id);
        }

        res.json({
            success: true,
            data: cart
        });
    } catch (error) {
        console.error('Cart GET Error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// @route   POST /api/cart/add
// @desc    Add item to cart
// @access  Private
router.post('/add', protect, async (req, res) => {
    try {
        const { productId, quantity = 1 } = req.body;

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        if (!product.isAvailable) {
            return res.status(400).json({
                success: false,
                message: 'Product is not available'
            });
        }

        // Check stock availability
        const stockValue = product.stock || 0;
        const reservedValue = product.reservedStock || 0;
        const availableStock = stockValue - reservedValue;
        if (quantity > availableStock) {
            return res.status(400).json({
                success: false,
                message: `Only ${availableStock} units available`
            });
        }

        let cart = await Cart.findOne({ user: req.user._id });

        if (!cart) {
            cart = new Cart({ user: req.user._id, items: [] });
        }

        // Check if product already in cart
        const existingItemIndex = cart.items.findIndex(
            item => item.product.toString() === productId
        );

        const price = product.discountPrice > 0 ? product.discountPrice : product.price;

        if (existingItemIndex > -1) {
            // Update quantity
            const newQuantity = cart.items[existingItemIndex].quantity + quantity;
            if (newQuantity > availableStock) {
                return res.status(400).json({
                    success: false,
                    message: `Cannot add more. Only ${availableStock} units available`
                });
            }
            cart.items[existingItemIndex].quantity = newQuantity;
            cart.items[existingItemIndex].price = price;
        } else {
            // Add new item
            cart.items.push({
                product: productId,
                quantity,
                price
            });
        }

        await cart.save();

        cart = await Cart.findById(cart._id)
            .populate('items.product', 'name price discountPrice images stock');

        res.json({
            success: true,
            data: cart
        });
    } catch (error) {
        console.error('Cart ADD Error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// @route   PUT /api/cart/update
// @desc    Update item quantity
// @access  Private
router.put('/update', protect, async (req, res) => {
    try {
        const { productId, quantity } = req.body;

        if (quantity < 1) {
            return res.status(400).json({
                success: false,
                message: 'Quantity must be at least 1'
            });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        const stockValue = product.stock || 0;
        const reservedValue = product.reservedStock || 0;
        const availableStock = stockValue - reservedValue;
        if (quantity > availableStock) {
            return res.status(400).json({
                success: false,
                message: `Only ${availableStock} units available`
            });
        }

        const cart = await Cart.findOne({ user: req.user._id });

        if (!cart) {
            return res.status(404).json({
                success: false,
                message: 'Cart not found'
            });
        }

        const itemIndex = cart.items.findIndex(
            item => item.product.toString() === productId
        );

        if (itemIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Item not found in cart'
            });
        }

        cart.items[itemIndex].quantity = quantity;
        await cart.save();

        const updatedCart = await Cart.findById(cart._id)
            .populate('items.product', 'name price discountPrice images stock');

        res.json({
            success: true,
            data: updatedCart
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// @route   DELETE /api/cart/remove/:productId
// @desc    Remove item from cart
// @access  Private
router.delete('/remove/:productId', protect, async (req, res) => {
    try {
        const cart = await Cart.findOne({ user: req.user._id });

        if (!cart) {
            return res.status(404).json({
                success: false,
                message: 'Cart not found'
            });
        }

        cart.items = cart.items.filter(
            item => item.product.toString() !== req.params.productId
        );

        await cart.save();

        const updatedCart = await Cart.findById(cart._id)
            .populate('items.product', 'name price discountPrice images stock');

        res.json({
            success: true,
            data: updatedCart
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// @route   DELETE /api/cart/clear
// @desc    Clear entire cart
// @access  Private
router.delete('/clear', protect, async (req, res) => {
    try {
        const cart = await Cart.findOne({ user: req.user._id });

        if (cart) {
            cart.items = [];
            await cart.save();
        }

        res.json({
            success: true,
            message: 'Cart cleared'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;
