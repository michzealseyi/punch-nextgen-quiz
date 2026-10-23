// Invalid, unauthorised and duplicate requests are refused with the right status and a readable message
const { call, register, adminToken } = require('./helpers');
const test = require('node:test');
const assert = require('node:assert');

const firstQuizId = async () => (await call('/quizzes')).data.quizzes[0].id;

test('protected routes need a valid token', async () => {
  assert.equal((await call('/me')).status, 401);
  assert.equal((await call('/me', { token: 'not-a-real-token' })).status, 401);
  assert.equal((await call(`/quizzes/${await firstQuizId()}/start`, { method: 'POST' })).status, 401);
  assert.equal((await call('/rewards/1/redeem', { method: 'POST' })).status, 401);
});

test('students cannot use admin routes', async () => {
  const t = await register('student@x.com');
  for (const [method, path] of [['GET', '/admin/stats'], ['POST', '/admin/quizzes'], ['PATCH', '/admin/rewards/1'], ['GET', '/admin/submissions']]) {
    const r = await call(path, { method, token: t, body: method === 'GET' ? undefined : {} });
    assert.equal(r.status, 403, `${method} ${path}`);
    assert.equal(r.data.error, 'Admins only.');
  }
});

test('registration validates its input', async () => {
  const bad = [
    [{ name: 'A', email: 'a@x.com', password: 'password123' }, /full name/],
    [{ name: 'Ada Obi', email: 'not-an-email', password: 'password123' }, /valid email/],
    [{ name: 'Ada Obi', email: 'ada@x.com', password: 'short' }, /at least 8/],
  ];
  for (const [body, message] of bad) {
    const r = await call('/auth/register', { method: 'POST', body });
    assert.equal(r.status, 400);
    assert.match(r.data.error, message);
  }
  const wrong = await call('/auth/login', { method: 'POST', body: { email: 'nobody@x.com', password: 'whatever123' } });
  assert.equal(wrong.status, 401);
});

test('malformed JSON and unknown endpoints get clear errors', async () => {
  const r = await call('/auth/login', { method: 'POST', raw: '{"email":' });
  assert.equal(r.status, 400);
  assert.match(r.data.error, /valid JSON/);
  assert.equal((await call('/does-not-exist')).status, 404);
});

test('quizzes and attempts that do not exist, or belong to someone else, return 404', async () => {
  const t = await register('owner@x.com');
  const other = await register('other@x.com');
  assert.equal((await call('/quizzes/99999/start', { method: 'POST', token: t })).status, 404);

  const s = await call(`/quizzes/${await firstQuizId()}/start`, { method: 'POST', token: t });
  const q = s.data.question;
  assert.equal((await call(`/attempts/${s.data.attemptId}/submit`, { method: 'POST', token: other, body: { answers: [] } })).status, 404);
  assert.equal((await call(`/attempts/${s.data.attemptId}/answer`, { method: 'POST', token: other, body: { questionId: q.id, choice: 0 } })).status, 404);
});

test('answers cannot be locked after the attempt is submitted', async () => {
  const t = await register('late-answer@x.com');
  const s = await call(`/quizzes/${await firstQuizId()}/start`, { method: 'POST', token: t });
  await call(`/attempts/${s.data.attemptId}/submit`, { method: 'POST', token: t, body: { answers: [] } });
  const r = await call(`/attempts/${s.data.attemptId}/answer`, { method: 'POST', token: t, body: { questionId: s.data.question.id, choice: 0 } });
  assert.equal(r.status, 409);
});

test('garbage answers score zero instead of crashing', async () => {
  const t = await register('garbage@x.com');
  const s = await call(`/quizzes/${await firstQuizId()}/start`, { method: 'POST', token: t });
  const answers = [{ questionId: 'abc', choice: 2 }, null, { questionId: s.data.question.id, choice: 'B' }, 42];
  const r = await call(`/attempts/${s.data.attemptId}/submit`, { method: 'POST', token: t, body: { answers } });
  assert.equal(r.status, 200);
  assert.equal(r.data.score, 0);
});

test('polls and submissions reject invalid input', async () => {
  const t = await register('input@x.com');
  const { poll } = (await call('/polls/current')).data;
  for (const choice of [-1, 99, 'A', 1.5]) {
    assert.equal((await call(`/polls/${poll.id}/vote`, { method: 'POST', token: t, body: { choice } })).status, 400);
  }
  assert.equal((await call('/polls/99999/vote', { method: 'POST', token: t, body: { choice: 0 } })).status, 404);

  const quizId = await firstQuizId();
  const threeOptions = await call('/submissions', { method: 'POST', token: t, body: { quizId, text: 'Q?', options: ['a', 'b', 'c'], answerIndex: 0 } });
  assert.equal(threeOptions.status, 400);
  const noQuiz = await call('/submissions', { method: 'POST', token: t, body: { quizId: 99999, text: 'Q?', options: ['a', 'b', 'c', 'd'], answerIndex: 0 } });
  assert.equal(noQuiz.status, 400);
});

test('a student can have at most 5 questions waiting for review', async () => {
  const t = await register('busy-writer@x.com');
  const quizId = await firstQuizId();
  const send = (n) => call('/submissions', { method: 'POST', token: t, body: { quizId, text: `Question ${n}?`, options: ['a', 'b', 'c', 'd'], answerIndex: 0 } });
  for (let i = 0; i < 5; i++) assert.equal((await send(i)).status, 201);
  assert.equal((await send(6)).status, 429);
});

test('admins get validation errors too', async () => {
  const a = await adminToken();
  const quizId = await firstQuizId();
  const badImage = await call(`/admin/quizzes/${quizId}/questions`, { method: 'POST', token: a,
    body: { text: 'Q?', options: ['a', 'b', 'c', 'd'], answerIndex: 0, imageUrl: 'javascript:alert(1)' } });
  assert.equal(badImage.status, 400);
  assert.equal((await call('/admin/rewards/1', { method: 'PATCH', token: a, body: { stock: -3 } })).status, 400);
  assert.equal((await call('/admin/quizzes/99999', { method: 'PATCH', token: a, body: { active: true } })).status, 404);
});
