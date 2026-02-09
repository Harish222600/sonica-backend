const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sonica_bicycles');
        console.log('✅ MongoDB Connected');

        const db = mongoose.connection;
        const collection = db.collection('reviews');

        try {
            await collection.dropIndex('product_1_user_1');
            console.log('✅ Dropped index: product_1_user_1');
        } catch (err) {
            console.log('⚠️ Index product_1_user_1 not found or already dropped');
        }

        // List remaining indexes
        const indexes = await collection.indexes();
        console.log('Current Indexes:');
        console.dir(indexes, { depth: null });

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
};

connectDB();
