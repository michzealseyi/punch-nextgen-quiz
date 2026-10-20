// Editor tools. Every route here requires an admin account.
const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { requireAuth, requireAdmin, wrap, HttpError } = require('../middleware');
const { awardBadges } = require('../gamification');
const { RULES, str, addPoints, parseQuestion } = require('./helpers');

const router = express.Router();
router.use(requireAuth, requireAdmin);

router.get('/stats', wrap((req, res) => {
  const one = (sql) => db.prepare(sql).get().n;
  res.json({
    users: one("SELECT COUNT(*) n FROM users WHERE role='user'"),
    attempts: one("SELECT COUNT(*) n FROM attempts WHERE status='completed'"),
    pointsIssued: one('SELECT COALESCE(SUM(delta),0) n FROM point_ledger WHERE delta>0'),
    redemptions: one('SELECT COUNT(*) n FROM redemptions'),
    pendingSubmissions: one("SELECT COUNT(*) n FROM question_submissions WHERE status='pending'"),
    recentRedemptions: db.prepare(`SELECT r.code, r.created_at, u.name user, w.name reward FROM redemptions r
                                   JOIN users u ON u.id=r.user_id JOIN rewards w ON w.id=r.reward_id ORDER BY r.id DESC LIMIT 10`).all(),
  });
}));

/* ---------- Quizzes and questions ---------- */

router.get('/quizzes', wrap((req, res) => {
  res.json({ quizzes: db.prepare(`SELECT q.*, (SELECT COUNT(*) FROM questions WHERE quiz_id=q.id) question_count FROM quizzes q ORDER BY q.id`).all() });
}));

router.post('/quizzes', wrap((req, res) => {
  const title = str(req.body.title, 80), category = str(req.body.category, 40);
  if (!title || !category) throw new HttpError(400, 'Add a title and a category.');
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + crypto.randomBytes(2).toString('hex');
  const secs = Math.min(Math.max(parseInt(req.body.secondsPerQuestion, 10) || 20, 5), 120);
  const pts = Math.min(Math.max(parseInt(req.body.pointsPerCorrect, 10) || 10, 1), 100);
  const id = db.prepare(`INSERT INTO quizzes (slug,title,category,description,seconds_per_question,points_per_correct,questions_per_attempt)
                         VALUES (?,?,?,?,?,?,?)`)
    .run(slug, title, category, str(req.body.description, 200), secs, pts, RULES.QUESTIONS_PER_ATTEMPT).lastInsertRowid;
  res.status(201).json({ id });
}));

router.patch('/quizzes/:id', wrap((req, res) => {
  const r = db.prepare('UPDATE quizzes SET active=? WHERE id=?').run(req.body.active ? 1 : 0, req.params.id);
  if (!r.changes) throw new HttpError(404, 'Quiz not found.');
  res.json({ ok: true });
}));

router.get('/quizzes/:id/questions', wrap((req, res) => {
  const rows = db.prepare('SELECT * FROM questions WHERE quiz_id=? ORDER BY id').all(req.params.id);
  res.json({ questions: rows.map((q) => ({ ...q, options: JSON.parse(q.options) })) });
}));

router.post('/quizzes/:id/questions', wrap((req, res) => {
  if (!db.prepare('SELECT 1 FROM quizzes WHERE id=?').get(req.params.id)) throw new HttpError(404, 'Quiz not found.');
  const q = parseQuestion(req.body);
  const id = db.prepare('INSERT INTO questions (quiz_id,text,options,answer_index,explanation,image_url) VALUES (?,?,?,?,?,?)')
    .run(req.params.id, q.text, JSON.stringify(q.options), q.answer, q.explanation, q.imageUrl).lastInsertRowid;
  res.status(201).json({ id });
}));

router.delete('/questions/:id', wrap((req, res) => {
  const r = db.prepare('DELETE FROM questions WHERE id=?').run(req.params.id);
  if (!r.changes) throw new HttpError(404, 'Question not found.');
  res.json({ ok: true });
}));

/* ---------- Rewards ---------- */

router.patch('/rewards/:id', wrap((req, res) => {
  const stock = parseInt(req.body.stock, 10);
  if (!Number.isInteger(stock) || stock < 0) throw new HttpError(400, 'Stock must be 0 or more.');
  const r = db.prepare('UPDATE rewards SET stock=? WHERE id=?').run(stock, req.params.id);
  if (!r.changes) throw new HttpError(404, 'Reward not found.');
  res.json({ ok: true });
}));

/* ---------- Student-written questions ---------- */

router.get('/submissions', wrap((req, res) => {
  const rows = db.prepare(`SELECT s.*, u.name user, q.title quiz FROM question_submissions s
                           JOIN users u ON u.id=s.user_id JOIN quizzes q ON q.id=s.quiz_id
                           WHERE s.status='pending' ORDER BY s.id`).all();
  res.json({ submissions: rows.map((s) => ({ ...s, options: JSON.parse(s.options) })) });
}));

const pendingSubmission = (id) => {
  const s = db.prepare("SELECT * FROM question_submissions WHERE id=? AND status='pending'").get(id);
  if (!s) throw new HttpError(404, 'This submission has already been reviewed.');
  return s;
};

router.post('/submissions/:id/approve', wrap((req, res) => {
  const out = db.transaction(() => {
    const s = pendingSubmission(req.params.id);
    const questionId = db.prepare('INSERT INTO questions (quiz_id,text,options,answer_index,explanation) VALUES (?,?,?,?,?)')
      .run(s.quiz_id, s.text, s.options, s.answer_index, s.explanation).lastInsertRowid;
    db.prepare("UPDATE question_submissions SET status='approved', reviewed_at=datetime('now') WHERE id=?").run(s.id);
    addPoints(s.user_id, RULES.SUBMISSION_POINTS, 'Your question was approved', `submission:${s.id}`);
    awardBadges(s.user_id);
    return { questionId };
  })();
  res.json(out);
}));

router.post('/submissions/:id/reject', wrap((req, res) => {
  const s = pendingSubmission(req.params.id);
  db.prepare("UPDATE question_submissions SET status='rejected', reviewed_at=datetime('now') WHERE id=?").run(s.id);
  res.json({ ok: true });
}));

/* ---------- Polls ---------- */

router.get('/polls', wrap((req, res) => {
  res.json({ polls: db.prepare(`SELECT p.id, p.question, p.active, p.created_at, (SELECT COUNT(*) FROM poll_votes WHERE poll_id=p.id) votes
                                FROM polls p ORDER BY p.id DESC LIMIT 20`).all() });
}));

router.post('/polls', wrap((req, res) => {
  const question = str(req.body.question, 200);
  const options = (Array.isArray(req.body.options) ? req.body.options : []).map((o) => str(o, 80)).filter(Boolean);
  if (!question) throw new HttpError(400, 'Write the poll question.');
  if (options.length < 2 || options.length > 4) throw new HttpError(400, 'Give the poll 2 to 4 options.');
  const id = db.transaction(() => {
    db.prepare('UPDATE polls SET active=0').run(); // one live poll at a time
    return db.prepare('INSERT INTO polls (question, options) VALUES (?,?)').run(question, JSON.stringify(options)).lastInsertRowid;
  })();
  res.status(201).json({ id });
}));

router.patch('/polls/:id', wrap((req, res) => {
  db.transaction(() => {
    if (req.body.active) db.prepare('UPDATE polls SET active=0').run();
    const r = db.prepare('UPDATE polls SET active=? WHERE id=?').run(req.body.active ? 1 : 0, req.params.id);
    if (!r.changes) throw new HttpError(404, 'Poll not found.');
  })();
  res.json({ ok: true });
}));

module.exports = router;
