const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models
const User = require('./models/User');
const Product = require('./models/Product');
const Order = require('./models/Order');
const Inventory = require('./models/Inventory');
const Review = require('./models/Review');
const Delivery = require('./models/Delivery');

// MongoDB Connection
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sonica');
        console.log('✅ MongoDB Connected');
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error);
        process.exit(1);
    }
};

// Hash password helper
const hashPassword = async (password) => {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
};

// Seed Function
const seedDatabase = async (isStandalone = false) => {
    try {
        if (isStandalone) {
            await connectDB();
        }

        // Check if data exists
        const userCount = await User.countDocuments();
        const productCount = await Product.countDocuments();

        if (userCount > 0 || productCount > 0) {
            console.log('✅ Data already exists. Skipping seed.');
            if (isStandalone) process.exit(0);
            return;
        }

        console.log('🗑️  Clearing existing data...');
        // ... (rest of the clearing and seeding logic matches original but wrapped) ...
        // Wait, I need to include the FULL logic here if I'm replacing the whole block.
        // It's better to just replace the header and check, and keep the rest?
        // But the original code deletes unconditionally.

        // I will replace the START of the function up to the deleteMany part, 
        // and also the END to handle export.

        // Actually, the previous code had `await Promise.all([ User.deleteMany ... ])`.
        // I should remove that if I want to be purely additive or check existence?
        // If data exists, I RETURN. So I only reach deleteMany if NO data exists (count == 0).
        // So keeping deleteMany is fine (it deletes 0 documents).

        /* 
           The user said: "make sure all the data that is going to be seeded is up to the current changes"
           And "if the same data already exist then it should not upload".
           
           I'll overwrite the whole file content to be safe and clean.
        */

        await Promise.all([
            User.deleteMany({}),
            Product.deleteMany({}),
            Order.deleteMany({}),
            Inventory.deleteMany({}),
            Review.deleteMany({}),
            Delivery.deleteMany({})
        ]);

        // Pre-hash passwords
        const hashedAdminPass = await hashPassword('admin123');
        const hashedCustomerPass = await hashPassword('customer123');
        const hashedInventoryPass = await hashPassword('inventory123');
        const hashedDeliveryPass = await hashPassword('delivery123');

        console.log('👤 Creating users...');
        const usersData = [
            { name: 'John Admin', email: 'admin@sonica.com', password: hashedAdminPass, phone: '9876543210', role: 'admin', isActive: true },
            { name: 'Priya Sharma', email: 'customer@sonica.com', password: hashedCustomerPass, phone: '9876543211', role: 'customer', isActive: true },
            { name: 'Rahul Kumar', email: 'customer2@sonica.com', password: hashedCustomerPass, phone: '9876543212', role: 'customer', isActive: true },
            { name: 'Amit Inventory', email: 'inventory@sonica.com', password: hashedInventoryPass, phone: '9876543213', role: 'inventory_manager', isActive: true },
            { name: 'Vikram Delivery', email: 'delivery@sonica.com', password: hashedDeliveryPass, phone: '9876543214', role: 'delivery_partner', isActive: true },
            { name: 'Neha Customer', email: 'neha@example.com', password: hashedCustomerPass, phone: '9876543215', role: 'customer', isActive: true },
            { name: 'Suresh Delivery', email: 'delivery2@sonica.com', password: hashedDeliveryPass, phone: '9876543216', role: 'delivery_partner', isActive: true }
        ];

        const createdUsers = await User.insertMany(usersData);
        console.log(`   Created ${createdUsers.length} users`);

        console.log('🚲 Creating products...');
        const products = [
            // Mountain Bikes
            {
                name: 'SONICA Thunder X500',
                description: 'Experience the thrill of mountain trails with our flagship Thunder X500. Featuring a lightweight aluminum alloy frame, 21-speed Shimano gears, and hydraulic disc brakes for superior control. Perfect for professional riders.',
                category: 'mountain',
                price: 45999,
                discountPrice: 39999,
                images: ['https://images.unsplash.com/photo-1576435728678-68d0fbf94e91?w=800', 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800'],
                specifications: { brand: 'SONICA', model: 'Thunder X500', frameSize: '18"', wheelSize: '27.5"', weight: '14.5 kg', color: 'Black/Orange', material: 'Aluminum Alloy', gears: 21, brakeType: 'Hydraulic Disc' },
                stock: 25,
                ratings: { average: 4.7, count: 128 },
                isFeatured: true,
                tags: ['bestseller', 'mountain', 'professional']
            },
            {
                name: 'SONICA Trail Blazer Pro',
                description: 'Conquer any terrain with the Trail Blazer Pro. Built for endurance with carbon fiber fork, 24-speed gear system, and puncture-resistant tires. Ideal for long-distance adventures.',
                category: 'mountain',
                price: 55999,
                discountPrice: 49999,
                images: ['https://images.unsplash.com/photo-1571068316344-75bc76f77890?w=800', 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=800'],
                specifications: { brand: 'SONICA', model: 'Trail Blazer Pro', frameSize: '19"', wheelSize: '29"', weight: '13.8 kg', color: 'Green/Black', material: 'Aluminum 7005', gears: 24, brakeType: 'Shimano Hydraulic' },
                stock: 18,
                ratings: { average: 4.8, count: 89 },
                isFeatured: true,
                tags: ['trail', 'endurance', 'professional']
            },
            {
                name: 'SONICA Peak Climber',
                description: 'Lightweight and agile, the Peak Climber is designed for steep ascents and technical descents. Features advanced suspension geometry.',
                category: 'mountain',
                price: 38999,
                images: ['https://images.unsplash.com/photo-1559348349-86f1f65817fe?w=800'],
                specifications: { brand: 'SONICA', model: 'Peak Climber', frameSize: '17"', wheelSize: '26"', weight: '15.2 kg', color: 'Red/Black', material: 'Aluminum', gears: 21, brakeType: 'Mechanical Disc' },
                stock: 30,
                ratings: { average: 4.5, count: 67 },
                isFeatured: false,
                tags: ['climbing', 'lightweight']
            },
            // Road Bikes
            {
                name: 'SONICA Velocity Carbon R1',
                description: 'Engineered for speed, the Velocity Carbon R1 features a full carbon frame, aero design, and precision components. Built for competitive cyclists who demand performance.',
                category: 'road',
                price: 125999,
                discountPrice: 109999,
                images: ['https://images.unsplash.com/photo-1532298229144-0ec0c57515c7?w=800', 'https://images.unsplash.com/photo-1507035895480-2b3156c31fc8?w=800'],
                specifications: { brand: 'SONICA', model: 'Velocity R1', frameSize: '56cm', wheelSize: '700c', weight: '8.2 kg', color: 'Matte Black', material: 'Carbon Fiber T800', gears: 22, brakeType: 'Shimano 105 Hydraulic' },
                stock: 12,
                ratings: { average: 4.9, count: 45 },
                isFeatured: true,
                tags: ['racing', 'carbon', 'premium']
            },
            {
                name: 'SONICA Sprint Elite',
                description: 'The perfect balance of speed and comfort. Aluminum frame with carbon fork delivers responsive ride quality for long distances.',
                category: 'road',
                price: 65999,
                discountPrice: 59999,
                images: ['https://images.unsplash.com/photo-1571333250630-f0230c320b6d?w=800'],
                specifications: { brand: 'SONICA', model: 'Sprint Elite', frameSize: '54cm', wheelSize: '700c', weight: '9.8 kg', color: 'White/Blue', material: 'Aluminum 6061', gears: 20, brakeType: 'Shimano Tiagra Disc' },
                stock: 20,
                ratings: { average: 4.6, count: 78 },
                isFeatured: true,
                tags: ['fitness', 'endurance']
            },
            // Hybrid Bikes
            {
                name: 'SONICA City Cruiser',
                description: 'Your perfect city companion. Comfortable upright riding position, integrated lights, and fenders make daily commuting a breeze.',
                category: 'hybrid',
                price: 28999,
                discountPrice: 24999,
                images: ['https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?w=800'],
                specifications: { brand: 'SONICA', model: 'City Cruiser', frameSize: '18"', wheelSize: '700c', weight: '13.5 kg', color: 'Cream', material: 'Aluminum', gears: 7, brakeType: 'V-Brakes' },
                stock: 35,
                ratings: { average: 4.4, count: 156 },
                isFeatured: true,
                tags: ['city', 'commute', 'casual']
            },
            {
                name: 'SONICA Commute X',
                description: 'Built for the modern commuter. Disc brakes for all-weather stopping power, rack mounts for panniers, and puncture-resistant tires.',
                category: 'hybrid',
                price: 35999,
                discountPrice: 32999,
                images: ['https://images.unsplash.com/photo-1505705694340-019e1e335916?w=800'],
                specifications: { brand: 'SONICA', model: 'Commute X', frameSize: '19"', wheelSize: '700c', weight: '12.8 kg', color: 'Gray', material: 'Aluminum', gears: 21, brakeType: 'Mechanical Disc' },
                stock: 40,
                ratings: { average: 4.5, count: 203 },
                isFeatured: true,
                tags: ['commute', 'practical']
            },
            // Electric Bikes
            {
                name: 'SONICA E-Thunder 500',
                description: 'Electric mountain biking redefined. 500W mid-drive motor, 60km range, and full suspension for the ultimate off-road e-bike experience.',
                category: 'electric',
                price: 125999,
                discountPrice: 115999,
                images: ['https://images.unsplash.com/photo-1571068316344-75bc76f77890?w=800'],
                specifications: { brand: 'SONICA', model: 'E-Thunder 500', frameSize: '18"', wheelSize: '27.5"', weight: '24 kg', color: 'Black/Green', material: 'Aluminum 6061', gears: 9, brakeType: 'Hydraulic Disc 180mm' },
                stock: 15,
                ratings: { average: 4.8, count: 34 },
                isFeatured: true,
                tags: ['electric', 'mountain', 'premium']
            },
            {
                name: 'SONICA E-City Pro',
                description: 'Silent, smooth, and sophisticated. Perfect for urban commuting with integrated battery, step-through frame, and smart connectivity.',
                category: 'electric',
                price: 95999,
                discountPrice: 89999,
                images: ['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800'],
                specifications: { brand: 'SONICA', model: 'E-City Pro', frameSize: '17"', wheelSize: '700c', weight: '21 kg', color: 'White', material: 'Aluminum', gears: 7, brakeType: 'Hydraulic Disc' },
                stock: 22,
                ratings: { average: 4.7, count: 67 },
                isFeatured: false,
                tags: ['electric', 'city', 'commute']
            },
            // Kids Bikes
            {
                name: 'SONICA Junior Racer 20"',
                description: 'Introducing kids to the joy of cycling. Safe, durable, and fun! Features training wheel compatibility and easy-grip brakes.',
                category: 'kids',
                price: 12999,
                discountPrice: 10999,
                images: ['https://images.unsplash.com/photo-1505705694340-019e1e335916?w=800'],
                specifications: { brand: 'SONICA', model: 'Junior Racer', frameSize: '12"', wheelSize: '20"', weight: '12 kg', color: 'Blue/Yellow', material: 'Steel', gears: 6, brakeType: 'V-Brakes' },
                stock: 50,
                ratings: { average: 4.6, count: 89 },
                isFeatured: false,
                tags: ['kids', 'beginner']
            },
            {
                name: 'SONICA Little Champion 16"',
                description: 'First bike magic! Built for confidence-building with low step-over height and coaster brake. Makes learning to ride fun and safe.',
                category: 'kids',
                price: 8999,
                discountPrice: 7999,
                images: ['https://images.unsplash.com/photo-1475666675596-cca2035b3d79?w=800'],
                specifications: { brand: 'SONICA', model: 'Little Champion', frameSize: '10"', wheelSize: '16"', weight: '10 kg', color: 'Pink/Purple', material: 'Steel', gears: 1, brakeType: 'Coaster + Hand' },
                stock: 45,
                ratings: { average: 4.8, count: 145 },
                isFeatured: false,
                tags: ['kids', 'first-bike', 'training']
            },
            // Accessories
            {
                name: 'SONICA Pro Helmet',
                description: 'Safety meets style. CPSC certified, 25 ventilation channels, adjustable fit system, and sweat-wicking liner.',
                category: 'accessories',
                price: 2999,
                discountPrice: 2499,
                images: ['https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?w=800'],
                specifications: { brand: 'SONICA', model: 'Pro Helmet', material: 'EPS Foam + PC Shell', weight: '250g', color: 'Multiple Colors' },
                stock: 100,
                ratings: { average: 4.5, count: 234 },
                isFeatured: false,
                tags: ['helmet', 'safety', 'accessory']
            },
            {
                name: 'SONICA Bike Light Set',
                description: 'Be seen day and night. 1000 lumen front light, 100 lumen rear, USB rechargeable. Essential safety gear.',
                category: 'accessories',
                price: 1999,
                discountPrice: 1599,
                images: ['https://images.unsplash.com/photo-1505705694340-019e1e335916?w=800'],
                specifications: { brand: 'SONICA', model: 'Light Set Pro', material: 'Aluminum + PC', weight: '120g', color: 'Black' },
                stock: 150,
                ratings: { average: 4.6, count: 312 },
                isFeatured: false,
                tags: ['lights', 'safety', 'accessory']
            }
        ];

        const createdProducts = await Product.insertMany(products);
        console.log(`   Created ${createdProducts.length} products`);

        console.log('📦 Creating inventory records...');
        const inventoryRecords = createdProducts.map(product => ({
            product: product._id,
            totalStock: product.stock,
            reservedStock: 0,
            lowStockThreshold: 5
        }));
        await Inventory.insertMany(inventoryRecords);
        console.log(`   Created ${inventoryRecords.length} inventory records`);

        console.log('⭐ Creating sample reviews...');
        const customers = createdUsers.filter(u => u.role === 'customer');
        const reviews = [];
        const usedCombinations = new Set();

        for (let i = 0; i < 20; i++) {
            const randomProduct = createdProducts[Math.floor(Math.random() * createdProducts.length)];
            const randomCustomer = customers[Math.floor(Math.random() * customers.length)];
            const comboKey = `${randomProduct._id}-${randomCustomer._id}`;

            if (usedCombinations.has(comboKey)) continue;
            usedCombinations.add(comboKey);

            reviews.push({
                product: randomProduct._id,
                user: randomCustomer._id,
                rating: Math.floor(Math.random() * 2) + 4,
                title: ['Great bike!', 'Excellent!', 'Love it!', 'Best purchase', 'Highly Recommend'][Math.floor(Math.random() * 5)],
                comment: 'Great quality and design. Really happy with this purchase! The build quality exceeded my expectations.',
                isVerifiedPurchase: true,
                type: 'product' // Added explicit type
            });
        }
        await Review.insertMany(reviews);
        console.log(`   Created ${reviews.length} reviews`);

        console.log('🛒 Creating sample orders...');
        const statuses = ['created', 'paid', 'packed', 'shipped', 'delivered'];
        const orders = [];

        for (let i = 0; i < 12; i++) {
            const randomCustomer = customers[Math.floor(Math.random() * customers.length)];
            const randomProduct = createdProducts[Math.floor(Math.random() * createdProducts.length)];
            const price = randomProduct.discountPrice || randomProduct.price;
            const status = statuses[Math.floor(Math.random() * statuses.length)];

            orders.push({
                orderNumber: `SON-${Date.now()}-${(i + 1).toString().padStart(4, '0')}`,
                user: randomCustomer._id,
                items: [{ product: randomProduct._id, name: randomProduct.name, quantity: 1, price: price }],
                shippingAddress: {
                    street: `${Math.floor(Math.random() * 200) + 1}, Sample Street, Block ${String.fromCharCode(65 + Math.floor(Math.random() * 10))}`,
                    city: ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Pune'][Math.floor(Math.random() * 5)],
                    state: ['Maharashtra', 'Delhi', 'Karnataka', 'Tamil Nadu', 'Maharashtra'][Math.floor(Math.random() * 5)],
                    pincode: `${Math.floor(Math.random() * 900000) + 100000}`
                },
                payment: {
                    method: 'razorpay',
                    razorpayPaymentId: status !== 'created' ? `pay_${Date.now().toString(36)}${i}` : undefined,
                    status: status === 'created' ? 'pending' : 'completed',
                    paidAt: status !== 'created' ? new Date() : undefined
                },
                totalAmount: price,
                status: status
            });
        }

        const createdOrders = await Order.insertMany(orders);
        console.log(`   Created ${createdOrders.length} orders`);

        console.log('🚚 Creating delivery records...');
        const deliveryPartners = createdUsers.filter(u => u.role === 'delivery_partner');
        const shippedOrders = createdOrders.filter(o => ['shipped', 'delivered'].includes(o.status));

        const deliveries = shippedOrders.map(order => ({
            order: order._id,
            partner: deliveryPartners[Math.floor(Math.random() * deliveryPartners.length)]._id,
            status: order.status === 'delivered' ? 'delivered' : 'in_transit',
            estimatedDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
            actualDeliveryDate: order.status === 'delivered' ? new Date() : undefined,
            attempts: order.status === 'delivered' ? 1 : 0
        }));

        if (deliveries.length > 0) {
            await Delivery.insertMany(deliveries);
        }
        console.log(`   Created ${deliveries.length} delivery records`);

        // Added: Create Delivery Reviews for delivered orders
        // This ensures the seed covers dual review features
        console.log('🚚 Creating delivery reviews...');
        const deliveredOrders = shippedOrders.filter(o => o.status === 'delivered');
        const deliveryReviews = [];

        for (const order of deliveredOrders) {
            const delivery = deliveries.find(d => d.order.toString() === order._id.toString());
            if (delivery) {
                deliveryReviews.push({
                    type: 'delivery',
                    user: order.user,
                    order: order._id,
                    deliveryPartner: delivery.partner,
                    rating: 4 + Math.floor(Math.random() * 2),
                    title: 'Good delivery',
                    comment: 'On time and polite.',
                    isVerifiedPurchase: true,
                    isApproved: true
                });
            }
        }

        // Update Delivery Partner Ratings
        // (Simplified logic for seed: just insert reviews, real logic in app would calculate)
        if (deliveryReviews.length > 0) {
            await Review.insertMany(deliveryReviews);
            console.log(`   Created ${deliveryReviews.length} delivery reviews`);

            // Manually update partner rating in User model for seeded data?
            // Or rely on app logic? Seed usually should check this.
            // I'll update the partners just so stats look right.
            for (const partner of deliveryPartners) {
                const pReviews = deliveryReviews.filter(r => r.deliveryPartner.toString() === partner._id.toString());
                if (pReviews.length > 0) {
                    const avg = pReviews.reduce((sum, r) => sum + r.rating, 0) / pReviews.length;
                    await User.findByIdAndUpdate(partner._id, {
                        'rating.average': avg,
                        'rating.count': pReviews.length
                    });
                }
            }
        }

        console.log('\n✅ Database seeded successfully!\n');
        console.log('📋 Login Credentials:');
        console.log('   Admin:     admin@sonica.com / admin123');
        console.log('   Customer:  customer@sonica.com / customer123');
        console.log('   Inventory: inventory@sonica.com / inventory123');
        console.log('   Delivery:  delivery@sonica.com / delivery123\n');

        if (isStandalone) process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding database:', error.message);
        console.error(error.stack);
        if (isStandalone) process.exit(1);
    }
};

if (require.main === module) {
    seedDatabase(true);
}

module.exports = seedDatabase;
