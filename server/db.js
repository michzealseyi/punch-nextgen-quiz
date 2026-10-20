const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'nextgen.db');
if (DB_PATH !== ':memory:') fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  points INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0),
  lifetime_points INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS quizzes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  seconds_per_question INTEGER NOT NULL DEFAULT 20,
  points_per_correct INTEGER NOT NULL DEFAULT 10,
  questions_per_attempt INTEGER NOT NULL DEFAULT 10,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  options TEXT NOT NULL,           -- JSON array of 4 strings
  answer_index INTEGER NOT NULL,   -- never sent to the client before submission
  explanation TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question_ids TEXT NOT NULL,      -- JSON array: the only questions this attempt may answer
  answers TEXT,                    -- JSON array submitted by the user
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','expired')),
  score INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  points_earned INTEGER NOT NULL DEFAULT 0,
  started_at INTEGER NOT NULL,     -- epoch ms
  deadline_at INTEGER NOT NULL,    -- epoch ms, enforced server-side
  finished_at INTEGER
);

CREATE TABLE IF NOT EXISTS rewards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  cost INTEGER NOT NULL CHECK (cost > 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  kind TEXT NOT NULL DEFAULT 'digital',
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS redemptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reward_id INTEGER NOT NULL REFERENCES rewards(id),
  cost INTEGER NOT NULL,
  code TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS point_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  ref TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Answers locked one at a time so the player can show feedback without leaking later answers
CREATE TABLE IF NOT EXISTS attempt_answers (
  attempt_id INTEGER NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL,
  choice INTEGER,                  -- null when the timer ran out
  answered_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (attempt_id, question_id)
);

CREATE TABLE IF NOT EXISTS user_badges (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge TEXT NOT NULL,             -- id from server/gamification.js
  earned_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, badge)
);

CREATE TABLE IF NOT EXISTS polls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question TEXT NOT NULL,
  options TEXT NOT NULL,           -- JSON array of 2-4 strings
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS poll_votes (
  poll_id INTEGER NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  choice INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (poll_id, user_id)
);

-- Student-suggested questions, published only after an admin approves them
CREATE TABLE IF NOT EXISTS question_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  options TEXT NOT NULL,
  answer_index INTEGER NOT NULL,
  explanation TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_attempts_user ON attempts(user_id, quiz_id, finished_at);
CREATE INDEX IF NOT EXISTS idx_questions_quiz ON questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_ledger_user ON point_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON question_submissions(status);
`);

// Columns added after the first release; existing databases get them on startup
function addColumn(table, column, definition) {
  const exists = db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
  if (!exists) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
addColumn('questions', 'image_url', "TEXT NOT NULL DEFAULT ''");
addColumn('attempts', 'challenge', 'INTEGER NOT NULL DEFAULT 0');

module.exports = db;
