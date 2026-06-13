const mongoose = require('mongoose');

const RevisionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    questionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Question',
        required: true
    },
    interval: {
        type: Number,
        required: true,
        default: 1 // Starting at 1 day
    },
    nextRevisionDate: {
        type: String, // Format: YYYY-MM-DD
        required: true
    },
    status: {
        type: String,
        required: true,
        enum: ['pending', 'completed'],
        default: 'pending'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Revision', RevisionSchema);
