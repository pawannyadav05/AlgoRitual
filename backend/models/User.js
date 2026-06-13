const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    streak: {
        type: Number,
        default: 0
    },
    lastActiveSimulatedDate: {
        type: String,
        default: ""
    },
    completedDates: {
        type: [String],
        default: []
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('User', UserSchema);
