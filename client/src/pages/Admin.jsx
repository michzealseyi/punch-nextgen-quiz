// Editor tools. The page is hidden from students, but the real protection is requireAdmin on the server.
import { useState } from 'react';
import { api } from '../api.js';
import { CountUp, ErrorState, Intro, Skeleton } from '../components/common.jsx';
import { QuestionFields, questionBody } from '../components/QuestionFields.jsx';
import { useUi } from '../context/UiContext.jsx';
import { useApi } from '../useApi.js';
import { DESKS, fmt } from '../utils.js';

export default function Admin() {
  const { toast, modal } = useUi();
  const [errors, setErrors] = useState({});
  const { data, error, reload } = useApi(() => Promise.all([
    api.get('/admin/stats'), api.get('/admin/quizzes'), api.get('/rewards'), api.get('/admin/submissions'), api.get('/admin/polls'),
  ]), []);
  if (error) return <ErrorState error={error} />;
  if (!data) return <Skeleton />;

  const [s, { quizzes }, { rewards }, { submissions }, { polls }] = data;

  // Runs an admin action, then refreshes the page data
  const run = async (fn, okMsg) => {
    try { await fn(); toast(okMsg); reload(); } catch (err) { toast(err.message, true); }
  };
  // Submits a form; errors show under that form
  const submitForm = (key, fn, okMsg) => async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    setErrors((x) => ({ ...x, [key]: '' }));
    try { await fn(form); toast(okMsg); form.reset(); reload(); } catch (err) { setErrors((x) => ({ ...x, [key]: err.message })); }
  };
  const reject = async (id) => {
    const ok = await modal({ title: 'Reject this question?', body: <p>The student will see it as “Not used”. This can’t be undone.</p>, confirmLabel: 'Reject' });
    if (ok) run(() => api.post(`/admin/submissions/${id}/reject`), 'Question rejected.');
  };

  const stats = [[s.users, 'Students'], [s.attempts, 'Quizzes completed'], [s.pointsIssued, 'Points issued'], [s.redemptions, 'Rewards redeemed'], [s.pendingSubmissions, 'Questions to review']];

  return (
    <>
      <Intro pillar="Newsroom" title="Admin" />
      <div className="stats">
        {stats.map(([n, label]) => <div key={label} className="stat"><b><CountUp to={n} /></b><span>{label}</span></div>)}
      </div>

      <section className="admin-block">
        <h2 className="section-head">Student questions <small>{submissions.length} waiting</small></h2>
        {submissions.length ? (
          <ul className="queue">
            {submissions.map((q) => (
              <li key={q.id} className="queue__item">
                <p className="quiz-item__meta">{q.quiz}, from {q.user}</p>
                <b className="queue__q">{q.text}</b>
                <ol className="queue__opts">
                  {q.options.map((o, i) => <li key={i} className={i === q.answer_index ? 'is-answer' : ''}>{o}{i === q.answer_index && <small> correct</small>}</li>)}
                </ol>
                {q.explanation && <p className="hint">{q.explanation}</p>}
                <div className="queue__actions">
                  <button className="btn btn--small" onClick={() => run(() => api.post(`/admin/submissions/${q.id}/approve`), 'Question published and student paid.')}>Approve and publish</button>
                  <button className="btn btn--small btn--ghost" onClick={() => reject(q.id)}>Reject</button>
                </div>
              </li>
            ))}
          </ul>
        ) : <p className="hint">No questions waiting.</p>}
      </section>

      <section className="admin-block">
        <h2 className="section-head">Quizzes</h2>
        <div className="table-wrap">
          <table className="table-stack">
            <thead><tr><th>Title</th><th>Desk</th><th className="num">Questions</th><th>Status</th><th><span className="skip">Action</span></th></tr></thead>
            <tbody>
              {quizzes.map((q) => (
                <tr key={q.id}>
                  <td>{q.title}</td>
                  <td data-label="Desk">{q.category}</td>
                  <td className="num" data-label="Questions">{q.question_count}</td>
                  <td data-label="Status">{q.active ? 'Live' : 'Hidden'}</td>
                  <td><button className="linkish" onClick={() => run(() => api.patch(`/admin/quizzes/${q.id}`, { active: !q.active }), 'Quiz updated.')}>{q.active ? 'Hide' : 'Publish'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid">
        <section className="admin-block">
          <h2 className="section-head">Add a question</h2>
          <form noValidate onSubmit={submitForm('q', (f) => { const b = questionBody(f); return api.post(`/admin/quizzes/${b.quizId}/questions`, b); }, 'Question added.')}>
            <QuestionFields quizzes={quizzes} prefix="q" withImage />
            <p className="form-error" role="alert">{errors.q}</p>
            <button className="btn" type="submit">Add question</button>
          </form>
        </section>
        <aside className="admin-block">
          <h2 className="section-head">New quiz</h2>
          <form noValidate onSubmit={submitForm('nq', (f) => api.post('/admin/quizzes', Object.fromEntries(new FormData(f))), 'Quiz created. Add questions to publish it.')}>
            <div className="field"><label htmlFor="nqTitle">Title</label><input id="nqTitle" name="title" required /></div>
            <div className="field"><label htmlFor="nqCat">Desk</label><select id="nqCat" name="category">{DESKS.map((c) => <option key={c}>{c}</option>)}</select></div>
            <div className="field"><label htmlFor="nqDesc">Short description</label><input id="nqDesc" name="description" /></div>
            <div className="row-2">
              <div className="field"><label htmlFor="nqSecs">Seconds per question</label><input id="nqSecs" name="secondsPerQuestion" type="number" defaultValue={20} min={5} max={120} /></div>
              <div className="field"><label htmlFor="nqPts">Points per answer</label><input id="nqPts" name="pointsPerCorrect" type="number" defaultValue={10} min={1} max={100} /></div>
            </div>
            <p className="form-error" role="alert">{errors.nq}</p>
            <button className="btn btn--ghost" type="submit">Create quiz</button>
            <p className="hint" style={{ marginTop: '.5rem' }}>A quiz appears to students once it has at least one question.</p>
          </form>
        </aside>
      </div>

      <div className="grid">
        <section className="admin-block">
          <h2 className="section-head">Polls</h2>
          {polls.length ? (
            <div className="table-wrap">
              <table className="table-stack">
                <thead><tr><th>Question</th><th className="num">Votes</th><th>Status</th><th><span className="skip">Action</span></th></tr></thead>
                <tbody>
                  {polls.map((p) => (
                    <tr key={p.id}>
                      <td>{p.question}</td>
                      <td className="num" data-label="Votes">{fmt(p.votes)}</td>
                      <td data-label="Status">{p.active ? 'Live' : 'Closed'}</td>
                      <td><button className="linkish" onClick={() => run(() => api.patch(`/admin/polls/${p.id}`, { active: !p.active }), 'Poll updated.')}>{p.active ? 'Close' : 'Reopen'}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="hint">No polls yet.</p>}
        </section>
        <aside className="admin-block">
          <h2 className="section-head">New poll</h2>
          <form noValidate onSubmit={submitForm('poll', (f) => {
            const fd = new FormData(f);
            return api.post('/admin/polls', { question: fd.get('question'), options: [0, 1, 2, 3].map((i) => fd.get('opt' + i)) });
          }, 'Poll published.')}>
            <div className="field"><label htmlFor="pQ">Question</label><input id="pQ" name="question" maxLength={200} required /></div>
            {[0, 1, 2, 3].map((i) => (
              <div className="field" key={i}><label htmlFor={`pO${i}`}>Option {i + 1}{i > 1 && ' (optional)'}</label><input id={`pO${i}`} name={`opt${i}`} maxLength={80} /></div>
            ))}
            <p className="form-error" role="alert">{errors.poll}</p>
            <button className="btn" type="submit">Publish poll</button>
            <p className="hint" style={{ marginTop: '.5rem' }}>Publishing a poll closes the one that’s live now.</p>
          </form>
        </aside>
      </div>

      <div className="grid">
        <section className="admin-block">
          <h2 className="section-head">Reward stock</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Reward</th><th className="num">Cost</th><th>Stock</th></tr></thead>
              <tbody>
                {rewards.map((w) => (
                  <tr key={w.id}>
                    <td>{w.name}</td>
                    <td className="num">{fmt(w.cost)}</td>
                    <td>
                      <input type="number" min={0} defaultValue={w.stock} aria-label={`Stock for ${w.name}`} className="input input--narrow"
                        onBlur={(e) => {
                          if (e.target.value === String(w.stock)) return;
                          api.patch(`/admin/rewards/${w.id}`, { stock: Number(e.target.value) }).then(() => { toast('Stock updated.'); reload(); }, (err) => toast(err.message, true));
                        }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <aside className="admin-block">
          <h2 className="section-head">Recent redemptions</h2>
          {s.recentRedemptions.length ? (
            <ul className="codes">
              {s.recentRedemptions.map((r) => <li key={r.code}><span><b>{r.reward}</b><br /><span className="hint">{r.user}</span></span><span className="code">{r.code}</span></li>)}
            </ul>
          ) : <p className="hint">None yet.</p>}
        </aside>
      </div>
    </>
  );
}
