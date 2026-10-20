// Polls and student-written questions
const express = require('express');
const db = require('../db');
const { requireAuth, optionalAuth, wrap, HttpError } = require('../middleware');
const { awardBadges } = require('../gamification');
const { RULES, balanceOf, addPoints, parseQuestion } = require('./helpers');

const polls = express.Router();
const submissions = express.Router();

function pollView(poll, userId) {
  const options = JSON.parse(poll.options);
  const counts = options.map(() => 0);
  for (const r of db.prepare('SELECT choice, COUNT(*) n FROM poll_votes WHERE poll_id=? GROUP BY choice').all(poll.id)) counts[r.choice] = r.n;
  const mine = userId ? db.prepare('SELECT choice FROM poll_votes WHERE poll_id=? AND user_id=?').get(poll.id, userId) : null;
  return { id: poll.id, question: poll.question, options, counts, total: counts.reduce((a, b) => a + b, 0), myVote: mine ? mine.choice : null };
}

polls.get('/current', optionalAuth, wrap((req, res) => {
  const poll = db.prepare('SELECT * FROM polls WHERE active=1 ORDER BY id DESC LIMIT 1').get();
  res.json({ poll: poll ? pollView(poll, req.user?.id) : null, points: RULES.POLL_POINTS });
}));

polls.post('/:id/vote', requireAuth, wrap((req, res) => {
  const out = db.transaction(() => {
    const poll = db.prepare('SELECT * FROM polls WHERE id=? AND active=1').get(req.params.id);
    if (!poll) throw new HttpError(404, 'This poll has closed.');
    const choice = req.body.choice;
    if (!Number.isInteger(choice) || choice < 0 || choice >= JSON.parse(poll.options).length) throw new HttpError(400, 'Pick one of the options.');
    const r = db.prepare('INSERT OR IGNORE INTO poll_votes (poll_id,user_id,choice) VALUES (?,?,?)').run(poll.id, req.user.id, choice);
    if (!r.changes) throw new HttpError(409, 'You’ve already voted in this poll.');
    addPoints(req.user.id, RULES.POLL_POINTS, 'Voted in a poll', `poll:${poll.id}`);
    return { poll: pollView(poll, req.user.id), earned: RULES.POLL_POINTS, balance: balanceOf(req.user.id), newBadges: awardBadges(req.user.id) };
  })();
  res.status(201).json(out);
}));

submissions.use(requireAuth);

submissions.post('/', wrap((req, res) => {
  const quiz = db.prepare('SELECT id FROM quizzes WHERE id=? AND active=1').get(req.body.quizId);
  if (!quiz) throw new HttpError(400, 'Pick the quiz your question belongs to.');
  const q = parseQuestion(req.body);
  const pending = db.prepare("SELECT COUNT(*) n FROM question_submissions WHERE user_id=? AND status='pending'").get(req.user.id).n;
  if (pending >= RULES.MAX_PENDING_SUBMISSIONS) {
    throw new HttpError(429, `You have ${RULES.MAX_PENDING_SUBMISSIONS} questions waiting for review. Send more once those are checked.`);
  }
  const id = db.prepare('INSERT INTO question_submissions (user_id,quiz_id,text,options,answer_index,explanation) VALUES (?,?,?,?,?,?)')
    .run(req.user.id, quiz.id, q.text, JSON.stringify(q.options), q.answer, q.explanation).lastInsertRowid;
  res.status(201).json({ id, points: RULES.SUBMISSION_POINTS });
}));

module.exports = { polls, submissions };
