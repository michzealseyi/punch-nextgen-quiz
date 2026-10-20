// Shared test setup: a fresh in-memory database and a server on a random port per test file.
// Must be required before anything else so the env vars are set before the db module loads.
process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret';

const test = require('node:test');
const createApp = require('../server/app');
const seed = require('../server/seed');
const db = require('../server/db');

let base, server;

test.before(async () => {
  seed();
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
test.after(() => server.close());

// `raw` sends the body as-is (for malformed JSON tests)
const call = async (path, { method = 'GET', body, token, raw } = {}) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: raw ?? (body && JSON.stringify(body)),
  });
  return { status: res.status, data: await res.json() };
};

const register = async (email) => (await call('/auth/register', { method: 'POST', body: { name: 'Student ' + email, email, password: 'password123' } })).data.token;
const adminToken = async () => (await call('/auth/login', { method: 'POST', body: { email: 'admin@punchng.test', password: 'Admin@12345' } })).data.token;
const answerOf = (qid) => db.prepare('SELECT answer_index a FROM questions WHERE id=?').get(qid).a;

module.exports = { call, register, adminToken, answerOf, db };
