// XP, levels, streaks, badges and the daily challenge
const db = require('./db');
const { watDay, watDayBounds } = require('./middleware');

const DAY = 24 * 60 * 60 * 1000;

// XP is lifetime points, so spending points on rewards never lowers a level
const LEVELS = [
  [0, 'Rookie'], [100, 'Learner'], [250, 'Explorer'], [500, 'Insider'],
  [1000, 'Analyst'], [2000, 'Editor'], [4000, 'Legend'],
];

function levelFor(xp) {
  let i = 0;
  while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1][0]) i++;
  const [min, name] = LEVELS[i];
  const next = LEVELS[i + 1] ? { min: LEVELS[i + 1][0], name: LEVELS[i + 1][1] } : null;
  return { number: i + 1, name, xp, min, next, progress: next ? (xp - min) / (next.min - min) : 1 };
}

// Consecutive WAT days with a completed quiz. Today not played yet doesn't break the streak.
function streakFor(userId) {
  const days = new Set(db.prepare("SELECT finished_at f FROM attempts WHERE user_id=? AND status='completed'")
    .all(userId).map((r) => watDay(r.f)));
  let cursor = Date.now();
  const playedToday = days.has(watDay(cursor));
  if (!playedToday) cursor -= DAY;
  let current = 0;
  while (days.has(watDay(cursor))) { current++; cursor -= DAY; }
  return { current, playedToday };
}

const count = (sql, ...args) => db.prepare(sql).get(...args).n;
const completed = (uid) => count("SELECT COUNT(*) n FROM attempts WHERE user_id=? AND status='completed'", uid);
const xpOf = (uid) => db.prepare('SELECT lifetime_points n FROM users WHERE id=?').get(uid).n;

const BADGES = [
  { id: 'first-quiz', icon: '🎯', name: 'First steps', description: 'Finish your first quiz.', earned: (u) => completed(u) >= 1 },
  { id: 'perfect', icon: '💯', name: 'Perfect round', description: 'Get every answer in a quiz right.',
    earned: (u) => count("SELECT COUNT(*) n FROM attempts WHERE user_id=? AND status='completed' AND total>0 AND score=total", u) > 0 },
  { id: 'quizzes-10', icon: '📚', name: 'Regular player', description: 'Finish 10 quizzes.', earned: (u) => completed(u) >= 10 },
  { id: 'streak-3', icon: '🔥', name: 'On a roll', description: 'Play 3 days in a row.', earned: (u) => streakFor(u).current >= 3 },
  { id: 'streak-7', icon: '⚡', name: 'Week warrior', description: 'Play 7 days in a row.', earned: (u) => streakFor(u).current >= 7 },
  { id: 'all-desks', icon: '🧭', name: 'Desk hopper', description: 'Finish a quiz from every desk.',
    earned: (u) => {
      const total = count(`SELECT COUNT(DISTINCT category) n FROM quizzes q WHERE active=1
                           AND EXISTS (SELECT 1 FROM questions WHERE quiz_id=q.id)`);
      const played = count(`SELECT COUNT(DISTINCT q.category) n FROM attempts a JOIN quizzes q ON q.id=a.quiz_id
                            WHERE a.user_id=? AND a.status='completed' AND q.active=1`, u);
      return total > 0 && played >= total;
    } },
  { id: 'challenger', icon: '🎮', name: 'Challenger', description: 'Complete a daily challenge.',
    earned: (u) => count("SELECT COUNT(*) n FROM attempts WHERE user_id=? AND status='completed' AND challenge=1", u) > 0 },
  { id: 'xp-500', icon: '⭐', name: 'Rising star', description: 'Earn 500 XP.', earned: (u) => xpOf(u) >= 500 },
  { id: 'xp-1000', icon: '🏆', name: 'Headliner', description: 'Earn 1,000 XP.', earned: (u) => xpOf(u) >= 1000 },
  { id: 'voter', icon: '🗳️', name: 'Voice of the people', description: 'Vote in a poll.',
    earned: (u) => count('SELECT COUNT(*) n FROM poll_votes WHERE user_id=?', u) > 0 },
  { id: 'contributor', icon: '✍️', name: 'Contributor', description: 'Have a question you wrote approved.',
    earned: (u) => count("SELECT COUNT(*) n FROM question_submissions WHERE user_id=? AND status='approved'", u) > 0 },
  { id: 'first-reward', icon: '🎁', name: 'Treat yourself', description: 'Redeem your first reward.',
    earned: (u) => count('SELECT COUNT(*) n FROM redemptions WHERE user_id=?', u) > 0 },
];

const publicBadge = ({ id, icon, name, description }) => ({ id, icon, name, description });

// Awards any badges the user now qualifies for and returns only the new ones
function awardBadges(userId) {
  const have = new Set(db.prepare('SELECT badge FROM user_badges WHERE user_id=?').all(userId).map((r) => r.badge));
  const fresh = BADGES.filter((b) => !have.has(b.id) && b.earned(userId));
  const ins = db.prepare('INSERT OR IGNORE INTO user_badges (user_id, badge) VALUES (?,?)');
  for (const b of fresh) ins.run(userId, b.id);
  return fresh.map(publicBadge);
}

function badgesFor(userId) {
  const earned = new Map(db.prepare('SELECT badge, earned_at FROM user_badges WHERE user_id=?').all(userId).map((r) => [r.badge, r.earned_at]));
  return BADGES.map((b) => ({ ...publicBadge(b), earnedAt: earned.get(b.id) || null }));
}

// One playable quiz a day, rotating through the live quizzes
function challengeQuizId(ms = Date.now()) {
  const ids = db.prepare(`SELECT id FROM quizzes q WHERE active=1 AND EXISTS (SELECT 1 FROM questions WHERE quiz_id=q.id) ORDER BY id`)
    .all().map((r) => r.id);
  if (!ids.length) return null;
  return ids[Math.floor(Date.parse(watDay(ms)) / DAY) % ids.length];
}

// Monday 00:00 WAT of the current week, as epoch ms
function watWeekStart(ms = Date.now()) {
  const [dayStart] = watDayBounds(ms);
  const sinceMonday = (new Date(Date.parse(watDay(ms))).getUTCDay() + 6) % 7;
  return dayStart - sinceMonday * DAY;
}

// Matches SQLite's datetime('now') format so ledger rows can be compared as text
const sqlTime = (ms) => new Date(ms).toISOString().replace('T', ' ').slice(0, 19);

module.exports = { levelFor, streakFor, awardBadges, badgesFor, challengeQuizId, watWeekStart, sqlTime };
