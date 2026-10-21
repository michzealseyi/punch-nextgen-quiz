import { useState } from 'react';
import { api } from '../api.js';
import { ErrorState, Intro, Skeleton } from '../components/common.jsx';
import { QuestionFields, questionBody } from '../components/QuestionFields.jsx';
import { useUi } from '../context/UiContext.jsx';
import { useApi } from '../useApi.js';

const STATUS = { pending: 'Waiting for review', approved: 'Published', rejected: 'Not used' };

export default function Contribute() {
  const { toast } = useUi();
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const { data, error, reload } = useApi(() => Promise.all([api.get('/quizzes'), api.get('/me/submissions')]), []);
  if (error) return <ErrorState error={error} />;
  if (!data) return <Skeleton />;

  const [{ quizzes }, { submissions, points }] = data;

  const onSubmit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setFormError('');
    try {
      await api.post('/submissions', questionBody(form));
      toast('Thanks! Your question is waiting for review.');
      form.reset();
      reload();
    } catch (err) { setFormError(err.message); }
    setBusy(false);
  };

  return (
    <>
      <Intro pillar="Create" title="Contribute a question">
        Write a question for one of the PUNCH desks. Our editors check every one, and if yours is published you earn {points} points and the Contributor badge.
      </Intro>
      <div className="grid">
        <section>
          <form onSubmit={onSubmit} noValidate>
            <QuestionFields quizzes={quizzes} prefix="sub" />
            <p className="form-error" role="alert">{formError}</p>
            <button className="btn" type="submit" disabled={busy}>Send for review</button>
          </form>
        </section>
        <aside>
          <h2 className="section-head">Your questions</h2>
          {submissions.length ? (
            <ul className="subs">
              {submissions.map((s) => (
                <li key={s.id}><span className={`status status--${s.status}`}>{STATUS[s.status]}</span><b>{s.text}</b><span className="hint">{s.quiz}</span></li>
              ))}
            </ul>
          ) : (
            <p className="hint">Questions you send appear here with their review status.</p>
          )}
          <h3 style={{ marginTop: '2rem' }}>What makes a good question</h3>
          <ul className="tips">
            <li>One clear right answer that a PUNCH NextGen student could know.</li>
            <li>Three wrong options that sound believable.</li>
            <li>A one-line explanation that teaches something.</li>
          </ul>
        </aside>
      </div>
    </>
  );
}
