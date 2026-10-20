// The signed-in student's profile, history and dashboard
const express = require('express');
const db = require('../db');
const { requireAuth, wrap } = require('../middleware');
const { levelFor, streakFor, badgesFor, challengeQuizId, watWeekStart, sqlTime } = require('../gamification');
const { RULES, publicUser, listQuizzes, quizIdsPlayedToday, userStats, rankOf } = require('./helpers');

const router = express.Router();
router.use(requireAuth);

router.get('/', wrap((req, res) => {
  res.json({
    user: publicUser(req.user),
    stats: { ...userStats(req.user.id), rank: rankOf(req.user.lifetime_points) },
    level: levelFor(req.user.lifetime_points),
    streak: streakFor(req.user.id),
  });
}));

router.get('/history', wrap((req, res) => {
  const attempts = db.prepare(`SELECT a.id, q.title, q.category, a.score, a.total, a.points_earned, a.status, a.finished_at
                               FROM attempts a JOIN quizzes q ON q.id=a.quiz_id
                               WHERE a.user_id=? AND a.status!='in_progress' ORDER BY a.id DESC LIMIT 20`).all(req.user.id);
  const ledger = db.prepare('SELECT delta, reason, created_at FROM point_ledger WHERE user_id=? ORDER BY id DESC LIMIT 30').all(req.user.id);
  res.json({ attempts, ledger });
}));

// Everything the student dashboard needs in one request
router.get('/dashboard', wrap((req, res) => {
  const uid = req.user.id;
  const quizzes = listQuizzes();
  const challengeId = challengeQuizId();
  const today = new Set(quizIdsPlayedToday(uid));
  const plays = new Set(db.prepare(`SELECT DISTINCT quiz_id FROM attempts WHERE user_id=? AND status='completed'`).all(uid).map((r) => r.quiz_id));

  const desks = [];
  for (const q of quizzes) {
    let d = desks.find((x) => x.desk === q.category);
    if (!d) desks.push(d = { desk: q.category, total: 0, played: 0 });
    d.total++;
    if (plays.has(q.id)) d.played++;
  }

  // Today's challenge first, then a quiz never played, then anything not yet played today
  const recommended = [quizzes.find((q) => q.id === challengeId && !today.has(q.id)),
    quizzes.find((q) => !plays.has(q.id)), quizzes.find((q) => !today.has(q.id))].find(Boolean) || null;

  res.json({
    user: publicUser(req.user),
    level: levelFor(req.user.lifetime_points),
    streak: streakFor(uid),
    stats: { ...userStats(uid), rank: rankOf(req.user.lifetime_points) },
    weekPoints: db.prepare(`SELECT COALESCE(SUM(delta),0) n FROM point_ledger WHERE user_id=? AND delta>0
                            AND IFNULL(ref,'')!='signup' AND created_at>=?`).get(uid, sqlTime(watWeekStart())).n,
    badges: badgesFor(uid),
    desks,
    recommended: recommended && { ...recommended, challenge: recommended.id === challengeId },
    challengeId,
    recent: db.prepare(`SELECT a.id, q.title, q.category, a.score, a.total, a.points_earned, a.status, a.finished_at
                        FROM attempts a JOIN quizzes q ON q.id=a.quiz_id
                        WHERE a.user_id=? AND a.status!='in_progress' ORDER BY a.id DESC LIMIT 5`).all(uid),
  });
}));

router.get('/redemptions', wrap((req, res) => {
  res.json({ redemptions: db.prepare(`SELECT r.code, r.cost, r.created_at, w.name FROM redemptions r JOIN rewards w ON w.id=r.reward_id
                                      WHERE r.user_id=? ORDER BY r.id DESC`).all(req.user.id) });
}));

router.get('/submissions', wrap((req, res) => {
  res.json({
    points: RULES.SUBMISSION_POINTS,
    submissions: db.prepare(`SELECT s.id, s.text, s.status, s.created_at, q.title quiz FROM question_submissions s
                             JOIN quizzes q ON q.id=s.quiz_id WHERE s.user_id=? ORDER BY s.id DESC LIMIT 20`).all(req.user.id),
  });
}));

module.exports = router;
