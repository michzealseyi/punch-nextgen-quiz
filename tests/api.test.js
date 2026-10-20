const { call, register, adminToken, answerOf, db } = require('./helpers');
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

test('quiz start never leaks answers', async () => {
  const { data } = await call('/quizzes');
  const r = await call(`/quizzes/${data.quizzes[0].id}/start`, { method: 'POST', token });
  assert.equal(r.status, 201);
  assert.ok(r.data.questions.length > 0);
  for (const q of r.data.questions) assert.equal(q.answer_index, undefined);
});

test('perfect score earns points + bonus once per day, then practice only', async () => {
  const quizId = (await call('/quizzes')).data.quizzes[1].id;
  const play = async () => {
    const s = await call(`/quizzes/${quizId}/start`, { method: 'POST', token });
    const answers = s.data.questions.map((q) => ({
      questionId: q.id, choice: db.prepare('SELECT answer_index a FROM questions WHERE id=?').get(q.id).a,
    }));
    return call(`/attempts/${s.data.attemptId}/submit`, { method: 'POST', token, body: { answers } });
  };
  const first = await play();
  assert.equal(first.data.score, first.data.total);
  assert.equal(first.data.bonus, 20);
  assert.ok(first.data.earned > 20);

  const second = await play();
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
    const s = await call(`/quizzes/${q.id}/start`, { method: 'POST', token: t });
    assert.equal(s.data.questions.length, 10);
    assert.equal(new Set(s.data.questions.map((x) => x.id)).size, 10);
    for (const x of s.data.questions) assert.equal(x.options.length, 4);
  }
});

test('locked answers reveal feedback, cannot be changed, and override the submitted answers', async () => {
  const t = await register('lock@x.com');
  const quizId = (await call('/quizzes')).data.quizzes[0].id;
  const s = await call(`/quizzes/${quizId}/start`, { method: 'POST', token: t });
  const q = s.data.questions[0];
  const wrong = (answerOf(q.id) + 1) % 4;

  const first = await call(`/attempts/${s.data.attemptId}/answer`, { method: 'POST', token: t, body: { questionId: q.id, choice: wrong } });
  assert.equal(first.status, 200);
  assert.equal(first.data.correct, false);
  assert.equal(first.data.answer, answerOf(q.id));

  const again = await call(`/attempts/${s.data.attemptId}/answer`, { method: 'POST', token: t, body: { questionId: q.id, choice: answerOf(q.id) } });
  assert.equal(again.status, 409);

  // Sending the right answer at submit time doesn't undo the locked wrong one
  const answers = s.data.questions.map((x) => ({ questionId: x.id, choice: answerOf(x.id) }));
  const r = await call(`/attempts/${s.data.attemptId}/submit`, { method: 'POST', token: t, body: { answers } });
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
  const s = await call(`/quizzes/${challengeId}/start`, { method: 'POST', token: t });
  assert.equal(s.data.quiz.challenge, true);
  const answers = s.data.questions.map((x) => ({ questionId: x.id, choice: answerOf(x.id) }));
  const r = await call(`/attempts/${s.data.attemptId}/submit`, { method: 'POST', token: t, body: { answers } });
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
