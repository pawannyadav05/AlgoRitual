require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5000;

// Initialize Database connection
connectDB().then(() => {
    // Start Server
    app.listen(PORT, () => {
        console.log(`===================================================`);
        console.log(`AlgoRitual DSA Tracker Server running on port ${PORT}`);
        console.log(`Access local application at: http://localhost:${PORT}`);
        console.log(`===================================================`);
    });
}).catch(err => {
    console.error('Failed to initialize server database connection:', err);
    process.exit(1);
});
