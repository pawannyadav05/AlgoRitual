const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    difficulty: {
        type: String,
        required: true,
        enum: ['Easy', 'Medium', 'Hard']
    },
    concept: {
        type: String,
        default: ""
    },
    platform: {
        type: String,
        default: "LeetCode"
    },
    link: {
        type: String,
        default: ""
    },
    status: {
        type: String,
        required: true,
        enum: ['pending', 'completed'],
        default: 'pending'
    },
    scheduledDate: {
        type: String, // Format: YYYY-MM-DD
        required: true
    },
    completedDate: {
        type: String, // Format: YYYY-MM-DD
        default: null
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Question', QuestionSchema);
