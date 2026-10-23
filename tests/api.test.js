const { call, register, adminToken, answerOf, play, submit, db } = require('./helpers');
const test = require('node:test');
const assert = require('node:assert');

let token;

test('register gives a welcome bonus', async () => {
  const r = await call('/auth/register', { method: 'POST', body: { name: 'Test Student', email: 't@x.com', password: 'password123' } });
  assert.equal(r.status, 201);
  assert.equal(r.data.user.points, 50);
  token = r.data.token;
});

test('duplicate email is rejected', async () => {
  const r = await call('/auth/register', { method: 'POST', body: { name: 'Again', email: 'T@X.com', password: 'password123' } });
  assert.equal(r.status, 409);
});

test('quiz start sends only the first question, and never an answer', async () => {
  const { data } = await call('/quizzes');
  const r = await call(`/quizzes/${data.quizzes[0].id}/start`, { method: 'POST', token });
  assert.equal(r.status, 201);
  assert.equal(r.data.questions, undefined);
  assert.equal(r.data.index, 0);
  assert.equal(r.data.total, 10);
  assert.deepEqual(Object.keys(r.data.question).sort(), ['id', 'imageUrl', 'options', 'text']);
});

test('perfect score earns points + bonus once per day, then practice only', async () => {
  const quizId = (await call('/quizzes')).data.quizzes[1].id;
  const playPerfect = async () => submit(token, (await play(token, quizId)).start.attemptId);
  const first = await playPerfect();
  assert.equal(first.data.score, first.data.total);
  assert.equal(first.data.bonus, 20);
  assert.ok(first.data.earned > 20);

  const second = await playPerfect();
  assert.equal(second.data.earned, 0);
  assert.match(second.data.note, /already earned/);
});

test('an attempt cannot be submitted twice', async () => {
  const quizId = (await call('/quizzes')).data.quizzes[2].id;
  const s = await call(`/quizzes/${quizId}/start`, { method: 'POST', token });
  await call(`/attempts/${s.data.attemptId}/submit`, { method: 'POST', token, body: { answers: [] } });
  const again = await call(`/attempts/${s.data.attemptId}/submit`, { method: 'POST', token, body: { answers: [] } });
  assert.equal(again.status, 409);
});

test('late submissions earn nothing', async () => {
  const quizId = (await call('/quizzes')).data.quizzes[3].id;
  const s = await call(`/quizzes/${quizId}/start`, { method: 'POST', token });
  db.prepare('UPDATE attempts SET deadline_at=? WHERE id=?').run(Date.now() - 1, s.data.attemptId);
  const r = await call(`/attempts/${s.data.attemptId}/submit`, { method: 'POST', token, body: { answers: [] } });
  assert.equal(r.data.earned, 0);
  assert.match(r.data.note, /Time ran out/);
});

test('redeeming deducts points and stock; insufficient points and out of stock are refused', async () => {
  const rewards = (await call('/rewards')).data.rewards;
  const cheap = rewards[0];
  db.prepare("UPDATE users SET points=300 WHERE email='t@x.com'").run();
  const before = (await call('/me', { token })).data.user.points;
  const r = await call(`/rewards/${cheap.id}/redeem`, { method: 'POST', token });
  assert.equal(r.status, 201);
  assert.match(r.data.code, /^PN-[A-F0-9]{4}-[A-F0-9]{4}$/);
  assert.equal(r.data.balance, before - cheap.cost);

  const pricey = rewards.find((x) => x.cost > r.data.balance);
  const no = await call(`/rewards/${pricey.id}/redeem`, { method: 'POST', token });
  assert.equal(no.status, 409);

  db.prepare('UPDATE rewards SET stock=0 WHERE id=?').run(cheap.id);
  const out = await call(`/rewards/${cheap.id}/redeem`, { method: 'POST', token });
  assert.equal(out.status, 409);
  assert.match(out.data.error, /out of stock/);
});

test('admin routes are locked to admins', async () => {
  assert.equal((await call('/admin/stats', { token })).status, 403);
  const login = await call('/auth/login', { method: 'POST', body: { email: 'admin@punchng.test', password: 'Admin@12345' } });
  const r = await call('/admin/stats', { token: login.data.token });
  assert.equal(r.status, 200);
  assert.ok(r.data.users >= 1);
});

/* ---------- NextGen features ---------- */

test('every quiz presents 10 multiple-choice questions with four options', async () => {
  const t = await register('ten@x.com');
  for (const q of (await call('/quizzes')).data.quizzes) {
    assert.equal(q.question_count, 10);
    const { seen } = await play(t, q.id);
    assert.equal(seen.length, 10);
    assert.equal(new Set(seen.map((x) => x.id)).size, 10);
    for (const x of seen) assert.equal(x.options.length, 4);
  }
});

test('locked answers reveal feedback, cannot be changed, and override the submitted answers', async () => {
  const t = await register('lock@x.com');
  const quizId = (await call('/quizzes')).data.quizzes[0].id;
  const s = await call(`/quizzes/${quizId}/start`, { method: 'POST', token: t });
  const q = s.data.question;
  const wrong = (answerOf(q.id) + 1) % 4;

  const first = await call(`/attempts/${s.data.attemptId}/answer`, { method: 'POST', token: t, body: { questionId: q.id, choice: wrong } });
  assert.equal(first.status, 200);
  assert.equal(first.data.correct, false);
  assert.equal(first.data.answer, answerOf(q.id));

  const again = await call(`/attempts/${s.data.attemptId}/answer`, { method: 'POST', token: t, body: { questionId: q.id, choice: answerOf(q.id) } });
  assert.equal(again.status, 409);

  // Answer the rest correctly through the normal flow
  for (let i = 1; i < s.data.total; i++) {
    const n = (await call(`/attempts/${s.data.attemptId}/next`, { method: 'POST', token: t })).data.question;
    await call(`/attempts/${s.data.attemptId}/answer`, { method: 'POST', token: t, body: { questionId: n.id, choice: answerOf(n.id) } });
  }
  // Claiming the right answer at submit time doesn't undo the locked wrong one
  const r = await submit(t, s.data.attemptId, { answers: [{ questionId: q.id, choice: answerOf(q.id) }] });
  assert.equal(r.data.score, r.data.total - 1);
});

test('answers for questions outside the attempt are refused', async () => {
  const t = await register('outside@x.com');
  const quizzes = (await call('/quizzes')).data.quizzes;
  const s = await call(`/quizzes/${quizzes[0].id}/start`, { method: 'POST', token: t });
  const other = db.prepare('SELECT id FROM questions WHERE quiz_id=?').get(quizzes[1].id).id;
  const r = await call(`/attempts/${s.data.attemptId}/answer`, { method: 'POST', token: t, body: { questionId: other, choice: 0 } });
  assert.equal(r.status, 400);
});

test('first quiz awards a badge once, and the dashboard reports level, streak and badges', async () => {
  const t = await register('badge@x.com');
  const quizId = (await call('/quizzes')).data.quizzes[4].id;
  const s = await call(`/quizzes/${quizId}/start`, { method: 'POST', token: t });
  const r = await call(`/attempts/${s.data.attemptId}/submit`, { method: 'POST', token: t, body: { answers: [] } });
  assert.ok(r.data.newBadges.some((b) => b.id === 'first-quiz'));

  const s2 = await call(`/quizzes/${quizId}/start`, { method: 'POST', token: t });
  const r2 = await call(`/attempts/${s2.data.attemptId}/submit`, { method: 'POST', token: t, body: { answers: [] } });
  assert.ok(!r2.data.newBadges.some((b) => b.id === 'first-quiz'));

  const d = (await call('/me/dashboard', { token: t })).data;
  assert.equal(d.streak.current, 1);
  assert.equal(d.streak.playedToday, true);
  assert.equal(d.level.name, 'Rookie');
  assert.ok(d.badges.find((b) => b.id === 'first-quiz').earnedAt);
  assert.ok(d.desks.length > 0);
});

test('the daily challenge pays double points', async () => {
  const t = await register('challenge@x.com');
  const { challengeId, quizzes } = (await call('/quizzes')).data;
  const quiz = quizzes.find((q) => q.id === challengeId);
  const { start } = await play(t, challengeId);
  assert.equal(start.quiz.challenge, true);
  const r = await submit(t, start.attemptId);
  assert.equal(r.data.points, r.data.score * quiz.points_per_correct * 2);
  assert.ok(r.data.newBadges.some((b) => b.id === 'challenger'));
});

test('a poll can be voted on once and pays points', async () => {
  const t = await register('poll@x.com');
  const { poll } = (await call('/polls/current', { token: t })).data;
  assert.equal(poll.myVote, null);
  const v = await call(`/polls/${poll.id}/vote`, { method: 'POST', token: t, body: { choice: 1 } });
  assert.equal(v.status, 201);
  assert.equal(v.data.poll.myVote, 1);
  assert.equal(v.data.poll.counts[1], 1);
  assert.equal(v.data.balance, 55);
  assert.ok(v.data.newBadges.some((b) => b.id === 'voter'));
  const again = await call(`/polls/${poll.id}/vote`, { method: 'POST', token: t, body: { choice: 0 } });
  assert.equal(again.status, 409);
});

test('approving a student question publishes it and pays the student', async () => {
  const t = await register('writer@x.com');
  const quizId = (await call('/quizzes')).data.quizzes[0].id;
  const before = db.prepare('SELECT COUNT(*) n FROM questions WHERE quiz_id=?').get(quizId).n;
  const sub = await call('/submissions', { method: 'POST', token: t,
    body: { quizId, text: 'Which state is Magboro in?', options: ['Lagos', 'Ogun', 'Oyo', 'Osun'], answerIndex: 1 } });
  assert.equal(sub.status, 201);

  assert.equal((await call(`/admin/submissions/${sub.data.id}/approve`, { method: 'POST', token: t })).status, 403);
  const a = await adminToken();
  const pending = (await call('/admin/submissions', { token: a })).data.submissions;
  assert.ok(pending.some((s) => s.id === sub.data.id));
  assert.equal((await call(`/admin/submissions/${sub.data.id}/approve`, { method: 'POST', token: a })).status, 200);
  assert.equal((await call(`/admin/submissions/${sub.data.id}/approve`, { method: 'POST', token: a })).status, 404);

  assert.equal(db.prepare('SELECT COUNT(*) n FROM questions WHERE quiz_id=?').get(quizId).n, before + 1);
  const mine = (await call('/me/submissions', { token: t })).data.submissions;
  assert.equal(mine[0].status, 'approved');
  assert.equal((await call('/me', { token: t })).data.user.points, 75);
});

test('weekly leaderboard counts only points earned this week, and shows your own rank', async () => {
  const t = await register('weekly@x.com');
  const all = (await call('/leaderboard', { token: t })).data;
  assert.equal(all.period, 'all');
  assert.ok(all.me.rank >= 1);

  const week = (await call('/leaderboard?period=week', { token: t })).data;
  assert.equal(week.period, 'week');
  // Seeded demo students have no ledger rows, and the welcome bonus doesn't count
  assert.ok(!week.leaders.some((l) => l.name === 'Adaeze Okafor'));
  assert.deepEqual(week.me, { rank: null, points: 0 });
});

test('admins can open a poll, which closes the previous one', async () => {
  const a = await adminToken();
  const r = await call('/admin/polls', { method: 'POST', token: a, body: { question: 'Best snack?', options: ['Puff-puff', 'Chin-chin', ''] } });
  assert.equal(r.status, 201);
  const { poll } = (await call('/polls/current')).data;
  assert.equal(poll.id, r.data.id);
  assert.deepEqual(poll.options, ['Puff-puff', 'Chin-chin']);
  assert.equal((await call('/admin/polls', { method: 'POST', token: a, body: { question: 'One option', options: ['Only'] } })).status, 400);
});

/* ---------- One question at a time ---------- */

test('a later question cannot be answered before it is released', async () => {
  const t = await register('early@x.com');
  const quizId = (await call('/quizzes')).data.quizzes[0].id;
  const s = (await call(`/quizzes/${quizId}/start`, { method: 'POST', token: t })).data;
  // Even someone who knew the second question's id couldn't answer it yet
  const ids = JSON.parse(db.prepare('SELECT question_ids q FROM attempts WHERE id=?').get(s.attemptId).q);
  const early = await call(`/attempts/${s.attemptId}/answer`, { method: 'POST', token: t, body: { questionId: ids[1], choice: 0 } });
  assert.equal(early.status, 409);
});

test('the next question is only released after the current one is answered', async () => {
  const t = await register('next@x.com');
  const quizId = (await call('/quizzes')).data.quizzes[0].id;
  const s = (await call(`/quizzes/${quizId}/start`, { method: 'POST', token: t })).data;
  assert.equal((await call(`/attempts/${s.attemptId}/next`, { method: 'POST', token: t })).status, 409);
  await call(`/attempts/${s.attemptId}/answer`, { method: 'POST', token: t, body: { questionId: s.question.id, choice: 0 } });
  const n = await call(`/attempts/${s.attemptId}/next`, { method: 'POST', token: t });
  assert.equal(n.status, 200);
  assert.equal(n.data.index, 1);
  assert.notEqual(n.data.question.id, s.question.id);
  assert.equal(n.data.question.answer_index, undefined);
});

test('an answer sent after the question time is up counts as no answer', async () => {
  const t = await register('slow@x.com');
  const quizId = (await call('/quizzes')).data.quizzes[0].id;
  const s = (await call(`/quizzes/${quizId}/start`, { method: 'POST', token: t })).data;
  db.prepare('UPDATE attempts SET served_at=? WHERE id=?').run(Date.now() - 10 * 60 * 1000, s.attemptId);
  const r = await call(`/attempts/${s.attemptId}/answer`, { method: 'POST', token: t, body: { questionId: s.question.id, choice: answerOf(s.question.id) } });
  assert.equal(r.status, 200);
  assert.equal(r.data.late, true);
  assert.equal(r.data.correct, false);
});

test('there is no question after the last one', async () => {
  const t = await register('last@x.com');
  const quizId = (await call('/quizzes')).data.quizzes[0].id;
  const { start } = await play(t, quizId);
  assert.equal((await call(`/attempts/${start.attemptId}/next`, { method: 'POST', token: t })).status, 409);
  assert.equal((await submit(t, start.attemptId)).data.score, 10);
});

/* ---------- Leaving and coming back ---------- */

test('coming back to a quiz resumes the same attempt at the same question', async () => {
  const t = await register('resume@x.com');
  const quizId = (await call('/quizzes')).data.quizzes[0].id;
  const s = (await call(`/quizzes/${quizId}/start`, { method: 'POST', token: t })).data;
  assert.equal(s.resumed, false);
  await call(`/attempts/${s.attemptId}/answer`, { method: 'POST', token: t, body: { questionId: s.question.id, choice: answerOf(s.question.id) } });
  const q2 = (await call(`/attempts/${s.attemptId}/next`, { method: 'POST', token: t })).data.question;

  // The student wanders off and comes back
  const back = await call(`/quizzes/${quizId}/start`, { method: 'POST', token: t });
  assert.equal(back.status, 200);
  assert.equal(back.data.resumed, true);
  assert.equal(back.data.attemptId, s.attemptId);
  assert.equal(back.data.index, 1);
  assert.equal(back.data.question.id, q2.id);
  assert.equal(back.data.score, 1);
  assert.equal(back.data.answered, null);

  const listed = (await call('/quizzes/in-progress', { token: t })).data.attempts;
  assert.deepEqual(listed, [{ quizId, index: 1, total: 10 }]);
});

test('leaving does not pause or reset the question timer', async () => {
  const t = await register('clock@x.com');
  const quizId = (await call('/quizzes')).data.quizzes[0].id;
  const s = (await call(`/quizzes/${quizId}/start`, { method: 'POST', token: t })).data;
  db.prepare('UPDATE attempts SET served_at=? WHERE id=?').run(Date.now() - 10 * 60 * 1000, s.attemptId);
  const back = (await call(`/quizzes/${quizId}/start`, { method: 'POST', token: t })).data;
  assert.equal(back.attemptId, s.attemptId);
  assert.equal(back.secondsLeft, 0);
  const late = await call(`/attempts/${s.attemptId}/answer`, { method: 'POST', token: t, body: { questionId: back.question.id, choice: answerOf(back.question.id) } });
  assert.equal(late.data.late, true);
});

test('coming back after answering shows that answer, which cannot be changed', async () => {
  const t = await register('answered@x.com');
  const quizId = (await call('/quizzes')).data.quizzes[0].id;
  const s = (await call(`/quizzes/${quizId}/start`, { method: 'POST', token: t })).data;
  const wrong = (answerOf(s.question.id) + 1) % 4;
  await call(`/attempts/${s.attemptId}/answer`, { method: 'POST', token: t, body: { questionId: s.question.id, choice: wrong } });
  const back = (await call(`/quizzes/${quizId}/start`, { method: 'POST', token: t })).data;
  assert.equal(back.index, 0);
  assert.equal(back.answered.choice, wrong);
  assert.equal(back.answered.correct, false);
  const again = await call(`/attempts/${s.attemptId}/answer`, { method: 'POST', token: t, body: { questionId: s.question.id, choice: answerOf(s.question.id) } });
  assert.equal(again.status, 409);
});

test('an abandoned attempt that has run out of time starts fresh and earns nothing', async () => {
  const t = await register('abandon@x.com');
  const quizId = (await call('/quizzes')).data.quizzes[0].id;
  const s = (await call(`/quizzes/${quizId}/start`, { method: 'POST', token: t })).data;
  db.prepare('UPDATE attempts SET deadline_at=? WHERE id=?').run(Date.now() - 1, s.attemptId);
  const fresh = await call(`/quizzes/${quizId}/start`, { method: 'POST', token: t });
  assert.equal(fresh.status, 201);
  assert.notEqual(fresh.data.attemptId, s.attemptId);
  assert.equal(db.prepare('SELECT status FROM attempts WHERE id=?').get(s.attemptId).status, 'expired');
});
