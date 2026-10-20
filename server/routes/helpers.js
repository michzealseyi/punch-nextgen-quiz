// Rules and helpers shared by the route modules
const crypto = require('crypto');
const db = require('../db');
const { HttpError, watDayBounds } = require('../middleware');

const RULES = {
  WELCOME_BONUS: 50,
  PERFECT_BONUS: 20,
  CHALLENGE_MULTIPLIER: 2,
  POLL_POINTS: 5,
  SUBMISSION_POINTS: 25,
  MAX_PENDING_SUBMISSIONS: 5,
  QUESTIONS_PER_ATTEMPT: 10,
  NETWORK_GRACE_MS: 5000,
};

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, points: u.points, lifetimePoints: u.lifetime_points });
const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const str = (v, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const balanceOf = (userId) => db.prepare('SELECT points FROM users WHERE id=?').get(userId).points;

// Every point change goes through here so the ledger always reconciles with balances
function addPoints(userId, delta, reason, ref) {
  db.prepare('UPDATE users SET points = points + ?, lifetime_points = lifetime_points + ? WHERE id = ?')
    .run(delta, Math.max(delta, 0), userId);
  db.prepare('INSERT INTO point_ledger (user_id, delta, reason, ref) VALUES (?,?,?,?)').run(userId, delta, reason, ref);
}

// Shared by admin-authored questions and student submissions
function parseQuestion(body) {
  const text = str(body.text, 300);
  const options = Array.isArray(body.options) ? body.options.map((o) => str(o, 120)) : [];
  const answer = Number(body.answerIndex);
  const imageUrl = str(body.imageUrl, 500);
  if (!text) throw new HttpError(400, 'Write the question.');
  if (options.length !== 4 || options.some((o) => !o)) throw new HttpError(400, 'Fill in all four options.');
  if (!Number.isInteger(answer) || answer < 0 || answer > 3) throw new HttpError(400, 'Mark which option is correct.');
  if (imageUrl && !/^https:\/\/\S+$/i.test(imageUrl)) throw new HttpError(400, 'Image links must start with https://');
  return { text, options, answer, explanation: str(body.explanation, 300), imageUrl };
}

function listQuizzes() {
  return db.prepare(`SELECT q.id, q.slug, q.title, q.category, q.description, q.seconds_per_question,
                            q.points_per_correct, MIN(q.questions_per_attempt, COUNT(x.id)) question_count
                     FROM quizzes q JOIN questions x ON x.quiz_id=q.id
                     WHERE q.active=1 GROUP BY q.id ORDER BY q.id`).all();
}

function quizIdsPlayedToday(userId) {
  const [from, to] = watDayBounds();
  return db.prepare(`SELECT DISTINCT quiz_id FROM attempts WHERE user_id=? AND status='completed'
                     AND points_earned>0 AND finished_at>=? AND finished_at<?`).all(userId, from, to).map((r) => r.quiz_id);
}

const userStats = (userId) => db.prepare(`SELECT COUNT(*) quizzes, COALESCE(SUM(score),0) correct, COALESCE(SUM(total),0) answered
                                          FROM attempts WHERE user_id=? AND status='completed'`).get(userId);
const rankOf = (xp) => db.prepare('SELECT COUNT(*)+1 r FROM users WHERE role=\'user\' AND lifetime_points > ?').get(xp).r;

module.exports = {
  RULES, publicUser, shuffle, str, balanceOf, addPoints, parseQuestion, listQuizzes, quizIdsPlayedToday, userStats, rankOf,
};
