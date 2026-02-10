const mongoose = require('mongoose');
require('dotenv').config();

const Product = require('./models/Product');
const Inventory = require('./models/Inventory');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://sonica:sonica123@cycle.bxbpgvg.mongodb.net/sonica?appName=cycle');
        console.log('✅ MongoDB Connected');
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error);
        process.exit(1);
    }
};

const newProducts = [
    // ─── MOUNTAIN BIKES ───
    {
        name: 'Rockstorm 700',
        description: 'Dominate rocky terrain with the Rockstorm 700. Features a reinforced chromoly steel frame, 27-speed Shimano Deore drivetrain, and RockShox 120mm travel fork. The aggressive tire tread provides unmatched grip on loose surfaces.',
        category: 'mountain',
        price: 52999,
        discountPrice: 44999,
        images: [
            'https://images.unsplash.com/photo-1544191696-102dbdaeeaa0?w=800',
            'https://images.unsplash.com/photo-1596738080682-85e8be24d98f?w=800'
        ],
        specifications: { brand: 'SS Square', model: 'Rockstorm 700', frameSize: '19"', wheelSize: '27.5"', weight: '14.0 kg', color: 'Midnight Blue/Orange', material: 'Chromoly Steel', gears: 27, brakeType: 'Shimano Deore Hydraulic' },
        stock: 20,
        ratings: { average: 4.6, count: 52 },
        isFeatured: true,
        tags: ['mountain', 'enduro', 'aggressive']
    },
    {
        name: 'Avalanche XT',
        description: 'Built for extreme downhill adventures. Full suspension with 150mm travel front and rear, dropper seatpost, and wide 2.5" tires for maximum control on steep descents.',
        category: 'mountain',
        price: 78999,
        discountPrice: 65999,
        images: [
            'https://images.unsplash.com/photo-1605235186583-a8272b0e5b1e?w=800',
            'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=800'
        ],
        specifications: { brand: 'SS Square', model: 'Avalanche XT', frameSize: '18"', wheelSize: '29"', weight: '15.5 kg', color: 'Neon Green/Black', material: 'Aluminum 7075', gears: 12, brakeType: 'Shimano SLX Hydraulic 203mm' },
        stock: 12,
        ratings: { average: 4.9, count: 38 },
        isFeatured: true,
        tags: ['downhill', 'full-suspension', 'extreme']
    },
    {
        name: 'Forest Runner 26',
        description: 'Entry-level mountain bike that punches above its weight. Perfect for weekend warriors exploring forest trails. Lightweight frame with front suspension and reliable Shimano 21-speed gearing.',
        category: 'mountain',
        price: 24999,
        discountPrice: 19999,
        images: [
            'https://images.unsplash.com/photo-1541625602330-2277a4c46182?w=800'
        ],
        specifications: { brand: 'SS Square', model: 'Forest Runner 26', frameSize: '17"', wheelSize: '26"', weight: '15.8 kg', color: 'Forest Green', material: 'Hi-Tensile Steel', gears: 21, brakeType: 'Mechanical Disc' },
        stock: 45,
        ratings: { average: 4.3, count: 112 },
        isFeatured: false,
        tags: ['entry-level', 'trail', 'budget']
    },

    // ─── ROAD BIKES ───
    {
        name: 'Aero Blade R3',
        description: 'Wind-tunnel tested aero frame with integrated cockpit for minimal drag. Full Shimano Ultegra Di2 electronic shifting and deep section carbon wheels. Built to win races.',
        category: 'road',
        price: 189999,
        discountPrice: 159999,
        images: [
            'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=800',
            'https://images.unsplash.com/photo-1571333250630-f0230c320b6d?w=800'
        ],
        specifications: { brand: 'SS Square', model: 'Aero Blade R3', frameSize: '54cm', wheelSize: '700c', weight: '7.4 kg', color: 'Stealth Black', material: 'Carbon Fiber T1000', gears: 22, brakeType: 'Shimano Ultegra Hydraulic' },
        stock: 8,
        ratings: { average: 4.9, count: 22 },
        isFeatured: true,
        tags: ['aero', 'racing', 'pro-level']
    },
    {
        name: 'Endurance GT',
        description: 'Designed for century rides and sportives. Endurance geometry with vibration-damping seatpost keeps you comfortable over long distances. Shimano 105 groupset delivers reliable performance.',
        category: 'road',
        price: 84999,
        discountPrice: 72999,
        images: [
            'https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=800',
            'https://images.unsplash.com/photo-1507035895480-2b3156c31fc8?w=800'
        ],
        specifications: { brand: 'SS Square', model: 'Endurance GT', frameSize: '56cm', wheelSize: '700c', weight: '9.2 kg', color: 'Pearl White/Red', material: 'Carbon/Aluminum Mix', gears: 22, brakeType: 'Shimano 105 Disc' },
        stock: 15,
        ratings: { average: 4.7, count: 63 },
        isFeatured: true,
        tags: ['endurance', 'long-distance', 'comfort']
    },
    {
        name: 'Gravel King GX',
        description: 'Go beyond the road. Adventure-ready gravel bike with flared drop bars, clearance for 45mm tires, and front/rear rack mounts. Perfect for bikepacking and mixed-surface riding.',
        category: 'road',
        price: 72999,
        discountPrice: 62999,
        images: [
            'https://images.unsplash.com/photo-1532298229144-0ec0c57515c7?w=800'
        ],
        specifications: { brand: 'SS Square', model: 'Gravel King GX', frameSize: '55cm', wheelSize: '700c', weight: '10.1 kg', color: 'Desert Sand', material: 'Aluminum 6061', gears: 20, brakeType: 'GRX Hydraulic Disc' },
        stock: 18,
        ratings: { average: 4.6, count: 47 },
        isFeatured: false,
        tags: ['gravel', 'adventure', 'bikepacking']
    },

    // ─── HYBRID BIKES ───
    {
        name: 'Urban Glide 7',
        description: 'Sleek urban bike with internal cable routing, belt drive system, and Nexus 7-speed hub. Near-zero maintenance for hassle-free daily commuting. Integrated rear rack included.',
        category: 'hybrid',
        price: 42999,
        discountPrice: 36999,
        images: [
            'https://images.unsplash.com/photo-1571068316344-75bc76f77890?w=800',
            'https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?w=800'
        ],
        specifications: { brand: 'SS Square', model: 'Urban Glide 7', frameSize: '18"', wheelSize: '700c', weight: '12.5 kg', color: 'Charcoal Gray', material: 'Aluminum', gears: 7, brakeType: 'Hydraulic Disc' },
        stock: 28,
        ratings: { average: 4.5, count: 91 },
        isFeatured: true,
        tags: ['urban', 'low-maintenance', 'commute']
    },
    {
        name: 'Fitness Flex 21',
        description: 'Lightweight fitness hybrid for exercise and commuting. Flat handlebars give confident control while the 21-speed drivetrain handles hills with ease. Reflective accents for visibility.',
        category: 'hybrid',
        price: 31999,
        discountPrice: 27999,
        images: [
            'https://images.unsplash.com/photo-1505705694340-019e1e335916?w=800'
        ],
        specifications: { brand: 'SS Square', model: 'Fitness Flex 21', frameSize: '19"', wheelSize: '700c', weight: '11.8 kg', color: 'Silver/Blue', material: 'Aluminum 6061', gears: 21, brakeType: 'Mechanical Disc' },
        stock: 32,
        ratings: { average: 4.4, count: 76 },
        isFeatured: false,
        tags: ['fitness', 'hybrid', 'exercise']
    },

    // ─── ELECTRIC BIKES ───
    {
        name: 'E-Cruise Comfort',
        description: 'Step-through electric cruiser with 350W rear hub motor and 50km range. Plush saddle, swept-back handlebars, and pedal-assist up to 25 km/h. Perfect for leisurely rides and errands.',
        category: 'electric',
        price: 79999,
        discountPrice: 68999,
        images: [
            'https://images.unsplash.com/photo-1571068316344-75bc76f77890?w=800',
            'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800'
        ],
        specifications: { brand: 'SS Square', model: 'E-Cruise Comfort', frameSize: '17"', wheelSize: '26"', weight: '23 kg', color: 'Teal Blue', material: 'Aluminum Step-Through', gears: 7, brakeType: 'Hydraulic Disc' },
        stock: 18,
        ratings: { average: 4.7, count: 55 },
        isFeatured: true,
        tags: ['electric', 'cruiser', 'comfort']
    },
    {
        name: 'E-Speed Racer',
        description: 'High-performance electric road bike with concealed 250W motor and sleek integrated battery. Looks like a regular road bike but gives you an extra edge. 80km range with Eco mode.',
        category: 'electric',
        price: 149999,
        discountPrice: 129999,
        images: [
            'https://images.unsplash.com/photo-1532298229144-0ec0c57515c7?w=800'
        ],
        specifications: { brand: 'SS Square', model: 'E-Speed Racer', frameSize: '54cm', wheelSize: '700c', weight: '14 kg', color: 'Glossy Black', material: 'Carbon Fiber', gears: 11, brakeType: 'Shimano 105 Hydraulic' },
        stock: 10,
        ratings: { average: 4.8, count: 29 },
        isFeatured: true,
        tags: ['electric', 'road', 'stealth']
    },
    {
        name: 'E-Cargo Max',
        description: 'Family and cargo electric bike with extended wheelbase, front cargo box, and powerful 750W motor. Carry kids, groceries, or gear with a payload capacity of 200kg.',
        category: 'electric',
        price: 119999,
        discountPrice: 99999,
        images: [
            'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=800'
        ],
        specifications: { brand: 'SS Square', model: 'E-Cargo Max', frameSize: '20"', wheelSize: '20"', weight: '35 kg', color: 'Orange/Black', material: 'Reinforced Steel', gears: 7, brakeType: 'Hydraulic Disc 203mm' },
        stock: 8,
        ratings: { average: 4.6, count: 19 },
        isFeatured: false,
        tags: ['electric', 'cargo', 'family']
    },

    // ─── KIDS BIKES ───
    {
        name: 'Adventure Kid 24"',
        description: 'For the young adventurer ready to explore. 24" wheels with Shimano 18-speed gearing and front suspension. Built tough for trails yet lightweight enough for kids to handle.',
        category: 'kids',
        price: 18999,
        discountPrice: 15999,
        images: [
            'https://images.unsplash.com/photo-1475666675596-cca2035b3d79?w=800',
            'https://images.unsplash.com/photo-1505705694340-019e1e335916?w=800'
        ],
        specifications: { brand: 'SS Square', model: 'Adventure Kid 24', frameSize: '13"', wheelSize: '24"', weight: '13 kg', color: 'Red/White', material: 'Aluminum', gears: 18, brakeType: 'Mechanical Disc' },
        stock: 35,
        ratings: { average: 4.7, count: 68 },
        isFeatured: false,
        tags: ['kids', 'adventure', 'trail']
    },
    {
        name: 'Balance Buddy 12"',
        description: 'The perfect first bike for toddlers ages 2-5. No pedals, no training wheels — just pure balance learning. Ultra-lightweight at only 3.5 kg with foam tires that never go flat.',
        category: 'kids',
        price: 5999,
        discountPrice: 4999,
        images: [
            'https://images.unsplash.com/photo-1475666675596-cca2035b3d79?w=800'
        ],
        specifications: { brand: 'SS Square', model: 'Balance Buddy 12', frameSize: '8"', wheelSize: '12"', weight: '3.5 kg', color: 'Sky Blue/White', material: 'Aluminum', gears: 0, brakeType: 'None' },
        stock: 60,
        ratings: { average: 4.9, count: 198 },
        isFeatured: false,
        tags: ['kids', 'balance-bike', 'toddler']
    },

    // ─── ACCESSORIES ───
    {
        name: 'Carbon Bottle Cage Set',
        description: 'Ultralight carbon fiber water bottle cage set (2 pcs). Weighs just 18g each with secure grip to hold bottles firmly on any terrain. Fits standard 750ml bottles.',
        category: 'accessories',
        price: 1499,
        discountPrice: 1199,
        images: [
            'https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?w=800'
        ],
        specifications: { brand: 'SS Square', model: 'Carbon Cage Set', material: 'Carbon Fiber', weight: '36g (pair)', color: 'Matte Black' },
        stock: 200,
        ratings: { average: 4.4, count: 156 },
        isFeatured: false,
        tags: ['bottle-cage', 'carbon', 'lightweight']
    },
    {
        name: 'Wireless Cycling Computer',
        description: 'GPS-enabled cycling computer with color display. Tracks speed, distance, elevation, heart rate, cadence, and power. ANT+ and Bluetooth connectivity. 20-hour battery life.',
        category: 'accessories',
        price: 8999,
        discountPrice: 7499,
        images: [
            'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800'
        ],
        specifications: { brand: 'SS Square', model: 'CycloComp GPS', material: 'Polycarbonate', weight: '75g', color: 'Black' },
        stock: 75,
        ratings: { average: 4.7, count: 89 },
        isFeatured: false,
        tags: ['computer', 'gps', 'training']
    },
    {
        name: 'Premium Bike Lock',
        description: 'Heavy-duty U-lock with braided steel cable. Anti-theft rated with hardened steel shackle and pick-resistant cylinder. Includes mounting bracket for easy transport.',
        category: 'accessories',
        price: 2499,
        discountPrice: 1999,
        images: [
            'https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?w=800'
        ],
        specifications: { brand: 'SS Square', model: 'SecureLock Pro', material: 'Hardened Steel', weight: '1.2 kg', color: 'Black/Yellow' },
        stock: 120,
        ratings: { average: 4.5, count: 203 },
        isFeatured: false,
        tags: ['lock', 'security', 'accessory']
    }
];

const addProducts = async () => {
    try {
        await connectDB();

        console.log('🚲 Adding new products to the database...\n');

        const createdProducts = await Product.insertMany(newProducts);
        console.log(`✅ Successfully added ${createdProducts.length} new products!\n`);

        // Create inventory records for new products
        const inventoryRecords = createdProducts.map(product => ({
            product: product._id,
            totalStock: product.stock,
            reservedStock: 0,
            lowStockThreshold: 5
        }));
        await Inventory.insertMany(inventoryRecords);
        console.log(`📦 Created ${inventoryRecords.length} inventory records\n`);

        // Print summary
        const categoryCounts = {};
        createdProducts.forEach(p => {
            categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
        });

        console.log('📋 Products added by category:');
        Object.entries(categoryCounts).forEach(([cat, count]) => {
            console.log(`   ${cat}: ${count} products`);
        });

        console.log('\n✅ Done! New products are now available in the store.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error adding products:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
};

addProducts();
