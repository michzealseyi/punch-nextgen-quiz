// Quiz catalogue and the play loop. Questions are released one at a time:
// start (question 1) → answer (lock + feedback) → next (question 2) → … → submit.
const express = require('express');
const db = require('../db');
const { requireAuth, wrap, HttpError, watDayBounds } = require('../middleware');
const { levelFor, streakFor, awardBadges, challengeQuizId } = require('../gamification');
const { RULES, shuffle, balanceOf, addPoints, listQuizzes, quizIdsPlayedToday } = require('./helpers');

const quizzes = express.Router();
const attempts = express.Router();
attempts.use(requireAuth);

// Only what the student needs to see: never the answer
function publicQuestion(id) {
  const q = db.prepare('SELECT id, text, options, image_url FROM questions WHERE id=?').get(id);
  if (!q) throw new HttpError(404, 'That question has been removed.');
  return { id: q.id, text: q.text, options: JSON.parse(q.options), imageUrl: q.image_url || null };
}

quizzes.get('/', wrap((req, res) => {
  res.json({ quizzes: listQuizzes(), challengeId: challengeQuizId(), challengeMultiplier: RULES.CHALLENGE_MULTIPLIER });
}));

// Quizzes this student has already earned points from today (so the UI can say "practice only")
quizzes.get('/played-today', requireAuth, wrap((req, res) => {
  res.json({ quizIds: quizIdsPlayedToday(req.user.id) });
}));

// Quizzes this student has started but not finished, so the UI can offer "Continue"
quizzes.get('/in-progress', requireAuth, wrap((req, res) => {
  res.json({ attempts: db.prepare(`SELECT a.quiz_id quizId, a.total, (SELECT COUNT(*) FROM attempt_answers WHERE attempt_id=a.id) answered
                                   FROM attempts a WHERE a.user_id=? AND a.status='in_progress' AND a.deadline_at>?`).all(req.user.id, Date.now()) });
}));

const quizView = (quiz, challenge) => ({
  id: quiz.id, title: quiz.title, category: quiz.category, secondsPerQuestion: quiz.seconds_per_question,
  pointsPerCorrect: quiz.points_per_correct * (challenge ? RULES.CHALLENGE_MULTIPLIER : 1), challenge: !!challenge,
});

// Leaving the page during an unanswered question forfeits it: it's locked as "no answer" and, unless it
// was the last one, the next question is released with a fresh timer. So a student can't step away, look
// the answer up, and come back to answer it. Returns true if a question was forfeited.
function forfeitIfUnanswered(attempt) {
  const ids = JSON.parse(attempt.question_ids);
  if (isLocked(attempt.id, ids[attempt.current_index])) return false;
  db.prepare('INSERT OR IGNORE INTO attempt_answers (attempt_id, question_id, choice) VALUES (?,?,NULL)').run(attempt.id, ids[attempt.current_index]);
  if (attempt.current_index < ids.length - 1) {
    db.prepare('UPDATE attempts SET current_index=current_index+1, served_at=? WHERE id=?').run(Date.now(), attempt.id);
  }
  return true;
}

// Where an attempt stands right now: the current question, the score so far, the time left on the
// current question, and its feedback if it has already been answered (or forfeited).
function attemptView(attempt, quiz, resumed, forfeited = false) {
  const ids = JSON.parse(attempt.question_ids);
  const qid = ids[attempt.current_index];
  const score = db.prepare(`SELECT COUNT(*) n FROM attempt_answers a JOIN questions q ON q.id=a.question_id
                            WHERE a.attempt_id=? AND a.choice=q.answer_index`).get(attempt.id).n;
  const locked = db.prepare('SELECT choice FROM attempt_answers WHERE attempt_id=? AND question_id=?').get(attempt.id, qid);
  let answered = null;
  if (locked) {
    const q = db.prepare('SELECT answer_index, explanation FROM questions WHERE id=?').get(qid);
    answered = { choice: locked.choice, correct: locked.choice === q.answer_index, answer: q.answer_index, explanation: q.explanation,
      last: attempt.current_index === ids.length - 1, forfeited };
  }
  const msLeft = attempt.served_at + quiz.seconds_per_question * 1000 - Date.now();
  return {
    attemptId: attempt.id,
    quiz: quizView(quiz, attempt.challenge),
    total: ids.length,
    index: attempt.current_index,
    question: publicQuestion(qid),
    score,
    answered,
    secondsLeft: Math.max(0, Math.min(quiz.seconds_per_question, msLeft / 1000)),
    resumed,
    forfeited,
  };
}

quizzes.post('/:id/start', requireAuth, wrap((req, res) => {
  const quiz = db.prepare('SELECT * FROM quizzes WHERE id=? AND active=1').get(req.params.id);
  if (!quiz) throw new HttpError(404, 'This quiz isn’t available.');

  // Coming back to a quiz you left continues the same attempt with the same questions. A question left
  // unanswered is forfeited and the next one is shown. Restarting for fresh questions isn't possible
  // until the attempt expires.
  const open = db.prepare(`SELECT * FROM attempts WHERE user_id=? AND quiz_id=? AND status='in_progress'
                           ORDER BY id DESC LIMIT 1`).get(req.user.id, quiz.id);
  if (open && Date.now() <= open.deadline_at) {
    const view = db.transaction(() => {
      const forfeited = forfeitIfUnanswered(open);
      return attemptView(db.prepare('SELECT * FROM attempts WHERE id=?').get(open.id), quiz, true, forfeited);
    })();
    return res.json(view);
  }

  const pool = db.prepare('SELECT id FROM questions WHERE quiz_id=?').all(quiz.id);
  if (!pool.length) throw new HttpError(409, 'This quiz has no questions yet.');
  const picked = shuffle(pool).slice(0, quiz.questions_per_attempt).map((p) => p.id);

  const now = Date.now();
  // Generous cap so an abandoned attempt can't be finished days later; each question has its own timer too
  const deadline = now + picked.length * (quiz.seconds_per_question * 1000 + RULES.IDLE_ALLOWANCE_MS);
  const challenge = quiz.id === challengeQuizId(now) ? 1 : 0;

  // Any open attempt left at this point has run out of time: close it so only one can be live
  db.prepare(`UPDATE attempts SET status='expired', finished_at=? WHERE user_id=? AND quiz_id=? AND status='in_progress'`)
    .run(now, req.user.id, quiz.id);
  const attemptId = db.prepare(`INSERT INTO attempts (user_id, quiz_id, question_ids, total, started_at, deadline_at, challenge, current_index, served_at)
                                VALUES (?,?,?,?,?,?,?,0,?)`)
    .run(req.user.id, quiz.id, JSON.stringify(picked), picked.length, now, deadline, challenge, now).lastInsertRowid;

  // Only the first question; the rest are released one by one through /next
  const attempt = db.prepare('SELECT * FROM attempts WHERE id=?').get(attemptId);
  res.status(201).json(attemptView(attempt, quiz, false));
}));

function ownAttempt(id, userId) {
  const attempt = db.prepare('SELECT * FROM attempts WHERE id=? AND user_id=?').get(id, userId);
  if (!attempt) throw new HttpError(404, 'Attempt not found.');
  if (attempt.status !== 'in_progress') throw new HttpError(409, 'This attempt has already been submitted.');
  return attempt;
}

const isLocked = (attemptId, questionId) => !!db.prepare('SELECT 1 FROM attempt_answers WHERE attempt_id=? AND question_id=?').get(attemptId, questionId);

// Locks one answer and reveals whether it was right. Only the question currently showing can be
// answered, and only within its timer; a late answer is recorded as "no answer".
attempts.post('/:id/answer', wrap((req, res) => {
  const out = db.transaction(() => {
    const attempt = ownAttempt(req.params.id, req.user.id);
    const now = Date.now();
    if (now > attempt.deadline_at) throw new HttpError(409, 'Time is up for this quiz.');

    const ids = JSON.parse(attempt.question_ids);
    const qid = Number(req.body.questionId);
    if (!ids.includes(qid)) throw new HttpError(400, 'That question isn’t part of this quiz.');
    if (qid !== ids[attempt.current_index]) throw new HttpError(409, 'That isn’t the question being shown.');
    const q = db.prepare('SELECT answer_index, explanation FROM questions WHERE id=?').get(qid);
    if (!q) throw new HttpError(404, 'That question has been removed.');

    const secs = db.prepare('SELECT seconds_per_question s FROM quizzes WHERE id=?').get(attempt.quiz_id).s;
    const late = now > attempt.served_at + secs * 1000 + RULES.NETWORK_GRACE_MS;
    const c = req.body.choice;
    const choice = !late && Number.isInteger(c) && c >= 0 && c <= 3 ? c : null;

    const r = db.prepare('INSERT OR IGNORE INTO attempt_answers (attempt_id, question_id, choice) VALUES (?,?,?)').run(attempt.id, qid, choice);
    if (!r.changes) throw new HttpError(409, 'You’ve already answered this question.');

    return { correct: choice === q.answer_index, answer: q.answer_index, explanation: q.explanation, late,
      last: attempt.current_index === ids.length - 1 };
  })();
  res.json(out);
}));

// Releases the next question once the current one is answered. Its timer starts now.
attempts.post('/:id/next', wrap((req, res) => {
  const out = db.transaction(() => {
    const attempt = ownAttempt(req.params.id, req.user.id);
    const ids = JSON.parse(attempt.question_ids);
    if (!isLocked(attempt.id, ids[attempt.current_index])) throw new HttpError(409, 'Answer the current question first.');
    const index = attempt.current_index + 1;
    if (index >= ids.length) throw new HttpError(409, 'There are no more questions. Submit your answers.');
    db.prepare('UPDATE attempts SET current_index=?, served_at=? WHERE id=?').run(index, Date.now(), attempt.id);
    return { index, total: ids.length, question: publicQuestion(ids[index]) };
  })();
  res.json(out);
}));

// Scores the attempt on the server from the locked answers and pays points, at most once per quiz per day
attempts.post('/:id/submit', wrap((req, res) => {
  const result = db.transaction(() => {
    const attempt = ownAttempt(req.params.id, req.user.id);
    const quiz = db.prepare('SELECT * FROM quizzes WHERE id=?').get(attempt.quiz_id);
    const ids = JSON.parse(attempt.question_ids);
    // Only answers locked during play count; anything else the client sends is ignored
    const locked = new Map(db.prepare('SELECT question_id, choice FROM attempt_answers WHERE attempt_id=?').all(attempt.id)
      .map((r) => [r.question_id, r.choice]));

    const now = Date.now();
    const late = now > attempt.deadline_at;
    const questions = db.prepare(`SELECT id, text, options, answer_index, explanation, image_url FROM questions WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids);
    const qMap = new Map(questions.map((q) => [q.id, q]));

    let score = 0;
    const review = ids.map((qid) => {
      const q = qMap.get(qid);
      if (!q) return null;
      const choice = locked.has(qid) ? locked.get(qid) : null;
      const correct = choice === q.answer_index;
      if (correct) score++;
      return { questionId: qid, text: q.text, options: JSON.parse(q.options), choice, answer: q.answer_index, correct, explanation: q.explanation, imageUrl: q.image_url || null };
    }).filter(Boolean);

    // Points: only once per quiz per WAT day, and never for late submissions
    const [from, to] = watDayBounds(now);
    const alreadyEarned = db.prepare(`SELECT 1 FROM attempts WHERE user_id=? AND quiz_id=? AND status='completed'
                                      AND points_earned>0 AND finished_at>=? AND finished_at<?`).get(req.user.id, quiz.id, from, to);
    const multiplier = attempt.challenge ? RULES.CHALLENGE_MULTIPLIER : 1;
    let points = 0, bonus = 0, note = null;
    if (late) note = 'Time ran out before you submitted, so no points were added.';
    else if (alreadyEarned) note = 'You’ve already earned points from this quiz today. Come back tomorrow to earn more.';
    else {
      points = score * quiz.points_per_correct * multiplier;
      if (score === review.length && review.length > 0) bonus = RULES.PERFECT_BONUS;
    }
    const earned = points + bonus;

    db.prepare(`UPDATE attempts SET answers=?, status=?, score=?, points_earned=?, finished_at=? WHERE id=?`)
      .run(JSON.stringify([...locked].map(([questionId, choice]) => ({ questionId, choice }))), late ? 'expired' : 'completed', score, earned, now, attempt.id);
    const reason = `${quiz.title}: ${score}/${review.length}${multiplier > 1 ? ' (daily challenge x2)' : ''}${bonus ? ' + perfect bonus' : ''}`;
    if (earned > 0) addPoints(req.user.id, earned, reason, `attempt:${attempt.id}`);

    const xp = db.prepare('SELECT lifetime_points n FROM users WHERE id=?').get(req.user.id).n;
    const level = levelFor(xp);
    return {
      score, total: review.length, points, bonus, earned, balance: balanceOf(req.user.id), note, review,
      challenge: multiplier > 1, level, levelUp: level.number > levelFor(req.user.lifetime_points).number,
      streak: streakFor(req.user.id), newBadges: awardBadges(req.user.id),
    };
  })();
  res.json(result);
}));

module.exports = { quizzes, attempts };
