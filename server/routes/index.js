// Mounts every API area under /api (see app.js)
const express = require('express');
const auth = require('./auth');
const me = require('./me');
const { quizzes, attempts } = require('./quizzes');
const leaderboard = require('./leaderboard');
const rewards = require('./rewards');
const { polls, submissions } = require('./community');
const admin = require('./admin');

const router = express.Router();
router.use('/auth', auth);
router.use('/me', me);
router.use('/quizzes', quizzes);
router.use('/attempts', attempts);
router.use('/leaderboard', leaderboard);
router.use('/rewards', rewards);
router.use('/polls', polls);
router.use('/submissions', submissions);
router.use('/admin', admin);

module.exports = router;
