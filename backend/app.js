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
app.use(express.static(path.join(__dirname, '../frontend')));

// Catch-all route to serve the Single Page App for front-end routing
app.use((req, res, next) => {
    // Skip if it's an API request that wasn't matched
    if (req.path.startsWith('/api/')) {
        return next();
    }
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

module.exports = app;
