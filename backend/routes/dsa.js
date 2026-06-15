const express = require('express');
const bcrypt = require('bcryptjs');
const Question = require('../models/Question');
const Revision = require('../models/Revision');
const User = require('../models/User');
const { authenticateToken } = require('./auth');

const router = express.Router();

// Helper to add days to a YYYY-MM-DD string
function addDays(dateStr, days) {
    const date = new Date(dateStr + 'T12:00:00Z'); // mid-day UTC to avoid local timezone offset shifts
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().split('T')[0];
}

// Helper to check if date1 is exactly yesterday relative to date2
function isYesterday(dateStrYesterday, dateStrToday) {
    if (!dateStrYesterday) return false;
    const d1 = new Date(dateStrYesterday + 'T12:00:00Z');
    const d2 = new Date(dateStrToday + 'T12:00:00Z');
    const diffTime = d2 - d1;
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    return diffDays === 1;
}

// POST /api/dsa/import-plan
// Imports a list of questions parsed from Gemini output, along with optional completed questions
router.post('/import-plan', authenticateToken, async (req, res) => {
    try {
        const { questions, completedQuestions, startDate, targetName } = req.body;
        const userId = req.user.id;

        if ((!questions || questions.length === 0) && (!completedQuestions || completedQuestions.length === 0)) {
            return res.status(400).json({ error: 'At least one list of questions (to-do or completed) is required.' });
        }

        // Check active plans limit: maximum of 2 active plans simultaneously
        if (questions && Array.isArray(questions) && questions.length > 0) {
            // Get all distinct concepts for current pending questions
            const activePlans = await Question.distinct('concept', { userId, status: 'pending' });
            
            // Get unique concepts from incoming questions (grouping all questions under targetName)
            const incomingConcepts = new Set([targetName || 'General']);
            
            // Calculate union of active plans and incoming plans
            const unionPlans = new Set([...activePlans, ...incomingConcepts]);
            
            if (unionPlans.size > 2) {
                return res.status(400).json({ 
                    error: `You cannot have more than 2 active study plans running simultaneously. Current active plans: ${activePlans.join(', ') || 'None'}. Please complete at least one of your active plans before importing a new one.` 
                });
            }
        }

        const dateToStart = startDate || new Date().toISOString().split('T')[0];
        let savedTodoCount = 0;
        let savedCompletedCount = 0;

        // Process new to-do questions
        if (questions && Array.isArray(questions) && questions.length > 0) {
            const questionDocs = questions.map(q => {
                const dayOffset = (q.dayIndex || 1) - 1;
                const scheduledDate = addDays(dateToStart, dayOffset);
                
                return {
                    userId,
                    title: q.title,
                    difficulty: q.difficulty || 'Easy',
                    concept: targetName || 'General',
                    platform: q.platform || 'LeetCode',
                    link: q.link || '',
                    track: q.track || '',
                    status: 'pending',
                    scheduledDate
                };
            });
            const savedQuestions = await Question.insertMany(questionDocs);
            savedTodoCount = savedQuestions.length;
        }

        // Process previously completed questions
        if (completedQuestions && Array.isArray(completedQuestions) && completedQuestions.length > 0) {
            const completedDocs = completedQuestions.map(q => {
                return {
                    userId,
                    title: q.title,
                    difficulty: q.difficulty || 'Easy',
                    concept: q.concept || targetName || 'General',
                    platform: q.platform || 'LeetCode',
                    link: q.link || '',
                    status: 'completed',
                    scheduledDate: dateToStart,
                    completedDate: dateToStart,
                    isPQ: true,
                    track: q.track || ''
                };
            });
            const savedCompleted = await Question.insertMany(completedDocs);
            savedCompletedCount = savedCompleted.length;

            // Schedule first Revision session for tomorrow for completed questions
            const tomorrowDate = addDays(dateToStart, 1);
            const revisionDocs = savedCompleted.map(q => ({
                userId,
                questionId: q._id,
                interval: 1,
                nextRevisionDate: tomorrowDate,
                status: 'pending'
            }));
            await Revision.insertMany(revisionDocs);

            // Update user completedDates
            const user = await User.findById(userId);
            if (user && !user.completedDates.includes(dateToStart)) {
                user.completedDates.push(dateToStart);
                await user.save();
            }
        }

        res.status(201).json({ 
            message: `Successfully imported plan.`, 
            todoCount: savedTodoCount,
            completedCount: savedCompletedCount
        });
    } catch (err) {
        console.error('Import plan error:', err);
        res.status(500).json({ error: 'Server error during plan import.' });
    }
});

// POST /api/dsa/reset-plan
// Clears all questions and revisions for the logged-in user to start fresh (requires password verification)
router.post('/reset-plan', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({ error: 'Password confirmation is required to reset your plan.' });
        }

        // Find user to verify password
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        // Compare password
        const validPass = await bcrypt.compare(password, user.password);
        if (!validPass) {
            return res.status(400).json({ error: 'Invalid password. Reset aborted.' });
        }

        // Delete all questions and revisions associated with the user
        await Question.deleteMany({ userId });
        await Revision.deleteMany({ userId });

        // Reset user stats
        user.streak = 0;
        user.completedDates = [];
        user.lastActiveSimulatedDate = "";
        await user.save();

        res.json({ message: 'All questions, active plans, and progress have been successfully reset.' });
    } catch (err) {
        console.error('Reset plan error:', err);
        res.status(500).json({ error: 'Server error resetting plan.' });
    }
});

// GET /api/dsa/dashboard
// Returns stats, completed heatmap calendar, and divided columns based on simulated date
router.get('/dashboard', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const simulatedDate = req.query.simulatedDate || new Date().toISOString().split('T')[0];

        // 1. Fetch Lists
        // Must Do: Incomplete questions scheduled in the past
        const mustDoList = await Question.find({
            userId,
            status: 'pending',
            scheduledDate: { $lt: simulatedDate }
        }).sort({ scheduledDate: 1 });

        // Today's Tasks: Incomplete questions scheduled for today
        const todayTasks = await Question.find({
            userId,
            status: 'pending',
            scheduledDate: simulatedDate
        });

        // Today's Revisions: Pending revisions due exactly today
        const todayRevisions = await Revision.find({
            userId,
            status: 'pending',
            nextRevisionDate: simulatedDate
        }).populate('questionId');

        // Revision Backlog: Pending revisions due in the past
        const revisionBacklog = await Revision.find({
            userId,
            status: 'pending',
            nextRevisionDate: { $lt: simulatedDate }
        }).populate('questionId').sort({ nextRevisionDate: 1 });

        // Filter out any populated questions that might be null
        const filteredRevisions = todayRevisions.filter(r => r.questionId !== null);
        let filteredBacklog = revisionBacklog.filter(r => r.questionId !== null);

        // Sort backlog (Must Revise) by difficulty: Hard first, then Medium, then Easy
        const difficultyPriority = { 'Hard': 1, 'Medium': 2, 'Easy': 3 };
        filteredBacklog.sort((a, b) => {
            const diffA = a.questionId.difficulty || 'Easy';
            const diffB = b.questionId.difficulty || 'Easy';
            return difficultyPriority[diffA] - difficultyPriority[diffB];
        });

        // 2. Fetch stats for LeetCode profile dashboard
        const totalEasy = await Question.countDocuments({ userId, difficulty: 'Easy' });
        const completedEasy = await Question.countDocuments({ userId, difficulty: 'Easy', status: 'completed' });
        
        const totalMedium = await Question.countDocuments({ userId, difficulty: 'Medium' });
        const completedMedium = await Question.countDocuments({ userId, difficulty: 'Medium', status: 'completed' });

        const totalHard = await Question.countDocuments({ userId, difficulty: 'Hard' });
        const completedHard = await Question.countDocuments({ userId, difficulty: 'Hard', status: 'completed' });

        // 3. Compile Active Targets & Plans progress
        const allUserQuestions = await Question.find({ userId });
        const targetsMap = {};
        allUserQuestions.forEach(q => {
            const concept = q.concept || 'General';
            if (!targetsMap[concept]) {
                targetsMap[concept] = {
                    name: concept,
                    total: 0,
                    completed: 0,
                    pending: 0
                };
            }
            targetsMap[concept].total += 1;
            if (q.status === 'completed') {
                targetsMap[concept].completed += 1;
            } else {
                targetsMap[concept].pending += 1;
            }
        });
        const targetsList = Object.values(targetsMap);

        // 4. User details (streak, heatmap)
        const user = await User.findById(userId);
        
        res.json({
            lists: {
                mustDo: mustDoList,
                todayTasks: todayTasks,
                todayRevisions: filteredRevisions.map(r => ({
                    _id: r._id,
                    interval: r.interval,
                    nextRevisionDate: r.nextRevisionDate,
                    question: r.questionId
                })),
                revisionBacklog: filteredBacklog.map(r => ({
                    _id: r._id,
                    interval: r.interval,
                    nextRevisionDate: r.nextRevisionDate,
                    question: r.questionId
                }))
            },
            counts: {
                mustDo: mustDoList.length,
                todayTasks: todayTasks.length,
                todayRevisions: filteredRevisions.length,
                revisionBacklog: filteredBacklog.length
            },
            leetcodeStats: {
                easy: { completed: completedEasy, total: totalEasy },
                medium: { completed: completedMedium, total: totalMedium },
                hard: { completed: completedHard, total: totalHard },
                total: { 
                    completed: completedEasy + completedMedium + completedHard, 
                    total: totalEasy + totalMedium + totalHard 
                }
            },
            targets: targetsList,
            userProfile: {
                username: user.username,
                streak: user.streak,
                completedDates: user.completedDates || []
            }
        });
    } catch (err) {
        console.error('Fetch dashboard error:', err);
        res.status(500).json({ error: 'Server error fetching dashboard.' });
    }
});

// Helper function to update User streak and completed dates on completion
async function updateUserCompletion(userId, simulatedDate) {
    const user = await User.findById(userId);
    if (!user) return;

    // Add simulatedDate to completedDates if not already present
    if (!user.completedDates.includes(simulatedDate)) {
        user.completedDates.push(simulatedDate);

        // Update streak logic
        if (isYesterday(user.lastActiveSimulatedDate, simulatedDate)) {
            // Consecutive day completion
            user.streak += 1;
        } else if (user.lastActiveSimulatedDate === simulatedDate) {
            // Already solved something today, streak remains same
        } else {
            // Gap day, streak resets/starts at 1
            user.streak = 1;
        }
        
        user.lastActiveSimulatedDate = simulatedDate;
        await user.save();
    }
}

// POST /api/dsa/complete-question
// Marks a question as completed and schedules a revision for tomorrow
router.post('/complete-question', authenticateToken, async (req, res) => {
    try {
        const { questionId, simulatedDate } = req.body;
        const userId = req.user.id;

        if (!questionId || !simulatedDate) {
            return res.status(400).json({ error: 'Question ID and simulated date are required.' });
        }

        // Find and update question
        const question = await Question.findOne({ _id: questionId, userId });
        if (!question) {
            return res.status(404).json({ error: 'Question not found.' });
        }

        if (question.status === 'completed') {
            return res.status(400).json({ error: 'Question is already completed.' });
        }

        question.status = 'completed';
        question.completedDate = simulatedDate;
        await question.save();

        // Update user stats (streak, calendar heatmap)
        await updateUserCompletion(userId, simulatedDate);

        // Schedule first Revision session for tomorrow
        const tomorrowDate = addDays(simulatedDate, 1);
        const revision = new Revision({
            userId,
            questionId,
            interval: 1,
            nextRevisionDate: tomorrowDate,
            status: 'pending'
        });

        await revision.save();

        res.json({ message: 'Question marked completed. Scheduled revision for tomorrow.', question });
    } catch (err) {
        console.error('Complete question error:', err);
        res.status(500).json({ error: 'Server error during question completion.' });
    }
});

// POST /api/dsa/complete-revision
// Marks a revision as completed and schedules the next revision using spaced repetition (double + 1)
router.post('/complete-revision', authenticateToken, async (req, res) => {
    try {
        const { revisionId, simulatedDate } = req.body;
        const userId = req.user.id;

        if (!revisionId || !simulatedDate) {
            return res.status(400).json({ error: 'Revision ID and simulated date are required.' });
        }

        // Find revision
        const revision = await Revision.findOne({ _id: revisionId, userId });
        if (!revision) {
            return res.status(404).json({ error: 'Revision task not found.' });
        }

        if (revision.status === 'completed') {
            return res.status(400).json({ error: 'Revision is already completed.' });
        }

        // Mark current revision as completed
        revision.status = 'completed';
        await revision.save();

        // Update user completion dates and streaks
        await updateUserCompletion(userId, simulatedDate);

        // Schedule next revision
        const currentInterval = revision.interval;
        const nextInterval = currentInterval * 2 + 1; // 1 -> 3 -> 7 -> 15 -> 31 -> 63
        const nextDate = addDays(simulatedDate, nextInterval);

        const newRevision = new Revision({
            userId,
            questionId: revision.questionId,
            interval: nextInterval,
            nextRevisionDate: nextDate,
            status: 'pending'
        });

        await newRevision.save();

        res.json({ 
            message: `Revision marked done. Scheduled next revision in ${nextInterval} days (${nextDate}).`,
            nextInterval,
            nextRevisionDate: nextDate 
        });
    } catch (err) {
        console.error('Complete revision error:', err);
        res.status(500).json({ error: 'Server error during revision completion.' });
    }
});

// GET /api/dsa/all-questions
// Returns the entire lists of user's questions and their revision status for the Revision Vault
router.get('/all-questions', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const questions = await Question.find({ userId }).sort({ createdAt: -1 });
        const revisions = await Revision.find({ userId }).populate('questionId');

        res.json({
            questions,
            revisions: revisions.filter(r => r.questionId !== null).map(r => ({
                questionTitle: r.questionId.title,
                difficulty: r.questionId.difficulty,
                interval: r.interval,
                nextRevisionDate: r.nextRevisionDate,
                status: r.status
            }))
        });
    } catch (err) {
        console.error('Fetch all questions error:', err);
        res.status(500).json({ error: 'Server error fetching all questions.' });
    }
});

module.exports = router;
