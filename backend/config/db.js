const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const connURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/dsa-tracker';
        console.log(`Connecting to MongoDB at: ${connURI}...`);
        
        const conn = await mongoose.connect(connURI);
        
        console.log(`MongoDB Connected successfully: ${conn.connection.host}/${conn.connection.name}`);
    } catch (error) {
        console.error(`MongoDB Connection Error: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;
