const express = require('express');
const cors = require('cors');
const path = require('path');
const { router: authRouter } = require('./routes/auth');
const dsaRouter = require('./routes/dsa');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/dsa', dsaRouter);

// Serve static files from the frontend folder
// The frontend folder will be one directory above the backend
const frontendPath = path.join(__dirname, '../frontend');
console.log(`[Static] Serving frontend from: ${frontendPath}`);
app.use(express.static(frontendPath));

// Catch-all route to serve the Single Page App for front-end routing
app.use((req, res, next) => {
    // Skip if it's an API request that wasn't matched
    if (req.path.startsWith('/api/')) {
        return next();
    }
    const indexPath = path.join(__dirname, '../frontend/index.html');
    res.sendFile(indexPath, (err) => {
        if (err) {
            console.error(`[Error] Failed to send index.html from ${indexPath}:`, err.message);
            res.status(404).send('Frontend index.html missing. Please check your deployment root directory.');
        }
    });
});

module.exports = app;
