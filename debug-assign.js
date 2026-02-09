
const mongoose = require('mongoose');
const Order = require('./src/models/Order');
const User = require('./src/models/User');
const Delivery = require('./src/models/Delivery');
require('dotenv').config();

async function debugAssign() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        // Find an order
        const order = await Order.findOne({ status: { $in: ['paid', 'packed'] } });
        if (!order) {
            console.log('No eligible order found');
            return;
        }
        console.log('Found Order:', order._id);

        // Find a delivery partner
        const partner = await User.findOne({ role: 'delivery_partner' });
        if (!partner) {
            console.log('No delivery partner found');
            return;
        }
        console.log('Found Partner:', partner._id);

        const assignData = {
            orderId: order._id.toString(),
            partnerId: partner._id.toString(),
            estimatedDate: '' // Test empty string
        };

        console.log('Attempting assignment with:', assignData);

        // Simulate logic from route
        let delivery = await Delivery.findOne({ order: assignData.orderId });
        if (delivery) {
            delivery.partner = assignData.partnerId;
            delivery.estimatedDate = assignData.estimatedDate;
        } else {
            delivery = new Delivery({
                order: assignData.orderId,
                partner: assignData.partnerId,
                estimatedDate: assignData.estimatedDate,
                deliveryAddress: order.shippingAddress, // Potential issue if shippingAddress is missing
                statusHistory: [{ status: 'assigned', note: 'Debug', timestamp: new Date() }]
            });
        }

        console.log('Delivery object created, trying to save...');
        await delivery.save();
        console.log('Delivery saved successfully');

    } catch (error) {
        console.error('Debug verify failed:', error);
    } finally {
        await mongoose.disconnect();
    }
}

debugAssign();
