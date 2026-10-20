require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./db');
const { quizzes, rewards } = require('./seedData');

const starterPoll = ['Which desk should get the next NextGen quiz?',
  JSON.stringify(['Technology', 'Entertainment', 'Education', 'Politics'])];

function seed({ reset = false } = {}) {
  if (reset) {
    db.exec(`DELETE FROM attempt_answers; DELETE FROM user_badges; DELETE FROM poll_votes; DELETE FROM polls;
             DELETE FROM question_submissions; DELETE FROM point_ledger; DELETE FROM redemptions; DELETE FROM attempts;
             DELETE FROM questions; DELETE FROM quizzes; DELETE FROM rewards; DELETE FROM users;`);
  }
  // Polls arrived after the first release, so existing databases get a starter poll too
  if (!db.prepare('SELECT 1 FROM polls').get()) {
    db.prepare('INSERT INTO polls (question, options) VALUES (?,?)').run(...starterPoll);
  }
  if (db.prepare('SELECT COUNT(*) c FROM quizzes').get().c > 0) return false;

  const insQuiz = db.prepare(`INSERT INTO quizzes (slug,title,category,description,seconds_per_question,points_per_correct,questions_per_attempt)
                              VALUES (@slug,@title,@category,@description,@seconds_per_question,@points_per_correct,@questions_per_attempt)`);
  const insQ = db.prepare('INSERT INTO questions (quiz_id,text,options,answer_index,explanation) VALUES (?,?,?,?,?)');
  const insR = db.prepare('INSERT INTO rewards (name,description,cost,stock,kind) VALUES (?,?,?,?,?)');
  const insU = db.prepare('INSERT INTO users (name,email,password_hash,role,points,lifetime_points) VALUES (?,?,?,?,?,?)');

  db.transaction(() => {
    for (const q of quizzes) {
      const { questions, ...meta } = q;
      const id = insQuiz.run(meta).lastInsertRowid;
      for (const [text, opts, ans, exp] of questions) insQ.run(id, text, JSON.stringify(opts), ans, exp);
    }
    for (const r of rewards) insR.run(...r);

    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@punchng.test').toLowerCase();
    const adminPass = process.env.ADMIN_PASSWORD || 'Admin@12345';
    insU.run('NextGen Admin', adminEmail, bcrypt.hashSync(adminPass, 10), 'admin', 0, 0);

    // Demo students so the leaderboard isn't empty on first run
    for (const [name, pts] of [['Adaeze Okafor', 640], ['Tunde Bakare', 520], ['Hauwa Musa', 410], ['Chidi Eze', 280]]) {
      const email = name.toLowerCase().replace(/\s+/g, '.') + '@demo.test';
      insU.run(name, email, bcrypt.hashSync('Demo@12345', 10), 'user', pts, pts);
    }
  })();
  return true;
}

module.exports = seed;

if (require.main === module) {
  console.log(seed({ reset: process.argv.includes('--reset') })
    ? 'Database seeded.' : 'Database already has data (run with --reset to reseed).');
}
