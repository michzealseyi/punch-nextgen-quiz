// The quiz: start an attempt, lock each answer for instant feedback, submit, show results.
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { CountUp, ErrorState, Skeleton, XpBar } from '../components/common.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useUi } from '../context/UiContext.jsx';
import { confetti, KEYS, reducedMotion } from '../utils.js';

// One question. Keyed by index in the parent, so its state (timer, lock, feedback) starts fresh each time.
// `resume` carries the server's saved state when a student comes back mid-quiz: the time left on this
// question (the clock kept running while they were away) and its feedback if it was already answered.
function Question({ quiz, attemptId, q, last, busy, resume, onLocked, onNext }) {
  const total = quiz.secondsPerQuestion * 1000;
  const startLeft = resume ? resume.secondsLeft * 1000 : total;
  const startedAt = useRef(performance.now() - (total - startLeft));
  const [left, setLeft] = useState(startLeft);
  const [choice, setChoice] = useState(resume?.answered ? resume.answered.choice : undefined); // undefined = not answered yet; null = timed out
  const [feedback, setFeedback] = useState(resume?.answered || null);
  const locked = choice !== undefined;
  const lockedRef = useRef(!!resume?.answered);
  const nextRef = useRef(null);

  // Lock the answer on the server first; only then does it tell us whether it was right
  const lock = async (c) => {
    if (lockedRef.current) return;
    lockedRef.current = true;
    setChoice(c);
    try {
      const r = await api.post(`/attempts/${attemptId}/answer`, { questionId: q.id, choice: c });
      onLocked(c, r.correct);
      setFeedback(r);
    } catch (err) {
      onLocked(c, false);
      setFeedback({ error: err.message });
    }
  };
  // Latest versions for the timer and keyboard listeners
  const latest = useRef({});
  latest.current = { lock, onNext, canNext: !!feedback };

  // Countdown; stops as soon as the answer is locked, and locks "no answer" at zero
  useEffect(() => {
    if (locked) return undefined;
    const id = setInterval(() => {
      const l = Math.max(0, total - (performance.now() - startedAt.current));
      setLeft(l);
      if (l <= 0) { clearInterval(id); latest.current.lock(null); }
    }, 100);
    return () => clearInterval(id);
  }, [locked, total]);

  // A–D or 1–4 to answer, Enter to continue
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest('input,textarea,select')) return;
      const k = e.key.toUpperCase();
      const i = KEYS.indexOf(k) > -1 ? KEYS.indexOf(k) : ['1', '2', '3', '4'].indexOf(k);
      if (!lockedRef.current && i > -1 && i < q.options.length) latest.current.lock(i);
      if (e.key === 'Enter' && latest.current.canNext) { e.preventDefault(); latest.current.onNext(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [q]);

  useEffect(() => { if (feedback) nextRef.current?.focus(); }, [feedback]);

  const optionClass = (i) => {
    let c = 'option';
    if (feedback && !feedback.error) {
      if (i === feedback.answer) c += ' is-correct';
      else if (i === choice && !feedback.late) c += ' is-wrong';
    }
    return c;
  };
  const low = !locked && left < 5000;
  // The server records an answer that arrives after the question's time as "no answer"
  const timedOut = feedback && (choice === null || feedback.late);
  const head = feedback && !feedback.error && (feedback.correct ? 'Correct!'
    : feedback.forfeited ? `You left during this question, so it counts as missed. The answer is ${KEYS[feedback.answer]}.`
      : timedOut ? `Time’s up. The answer is ${KEYS[feedback.answer]}.` : `Not quite. The answer is ${KEYS[feedback.answer]}.`);

  return (
    <>
      <div className="play__clock">
        <div className="timer" aria-hidden="true">
          <div className={'timer__bar' + (low ? ' is-low' : '')} style={{ transform: `scaleX(${left / total})` }} />
        </div>
        <span className={'play__secs' + (low ? ' is-low' : '')} aria-label="Seconds left">{Math.ceil(left / 1000)}</span>
      </div>
      {q.imageUrl && <img className="play__img" src={q.imageUrl} alt="" loading="lazy" />}
      <h1 className="question">{q.text}</h1>
      <div className="options" role="group" aria-label="Answer options">
        {q.options.map((o, i) => (
          <button key={i} type="button" className={optionClass(i)} aria-pressed={choice === i} disabled={locked} onClick={() => lock(i)}>
            <span className="option__key">{KEYS[i]}</span><span>{o}</span>
          </button>
        ))}
      </div>
      <div className="feedback" aria-live="polite">
        {feedback && (feedback.error
          ? <div className="feedback__card"><b>{feedback.error}</b></div>
          : <div className={'feedback__card ' + (feedback.correct ? 'is-correct' : 'is-wrong')}><b>{head}</b>{feedback.explanation && <p>{feedback.explanation}</p>}</div>)}
      </div>
      <div className="actions play__foot">
        <span className="hint play__tip">Press A–D to answer, Enter to continue.</span>
        <button ref={nextRef} className="btn" type="button" disabled={!feedback || busy} onClick={onNext}>{last ? 'See results' : 'Next question'}</button>
      </div>
    </>
  );
}

// The server releases one question at a time; the next one is fetched only when the student moves on,
// so its timer starts when it appears and later questions are never visible early.
// A returning student starts from the server's saved position and score.
function Player({ session, onFinish }) {
  const { quiz, attemptId, total } = session;
  const { toast } = useUi();
  const [index, setIndex] = useState(session.index);
  const [question, setQuestion] = useState(session.question);
  const [score, setScore] = useState(session.score);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const moving = useRef(false);
  const last = index === total - 1;

  useEffect(() => {
    if (session.resumed) {
      toast(!session.forfeited ? `Welcome back. You’re on question ${session.index + 1} of ${total}.`
        : session.answered ? 'Welcome back. You left during the last question, so it counts as missed.'
          : `Welcome back. The question you left counts as missed, so here’s question ${session.index + 1} of ${total}.`, !!session.forfeited);
    }
    // Refreshing or closing the tab mid-quiz asks first; the place is kept either way
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [session, total, toast]);

  const next = async () => {
    if (moving.current) return;
    moving.current = true;
    if (last) { onFinish(); return; }
    setBusy(true);
    try {
      const r = await api.post(`/attempts/${attemptId}/next`);
      setQuestion(r.question);
      setIndex(r.index);
    } catch (err) { setError(err.message); }
    setBusy(false);
    moving.current = false;
  };

  return (
    <section className="play">
      <div className="play__top">
        <span>{quiz.challenge && <><span className="tag tag--hot">2× challenge</span> </>}{quiz.category}: {quiz.title}</span>
        <span className="play__score">Score <b key={score} className={score ? 'is-bump' : ''}>{score}</b></span>
      </div>
      <div className="progress" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => <span key={i} className={i < index ? 'is-done' : i === index ? 'is-current' : ''} />)}
      </div>
      <p className="play__count">Question {index + 1} of {total}</p>
      <p className="play__notice" role="note"><span aria-hidden="true">⚠</span> Stay on this page. Leaving during a question counts it as missed.</p>
      {error && <div className="feedback__card"><b>{error}</b></div>}
      <Question
        key={index}
        quiz={quiz}
        attemptId={attemptId}
        q={question}
        last={last}
        busy={busy}
        resume={index === session.index ? session : null}
        onLocked={(choice, correct) => { if (correct) setScore((s) => s + 1); }}
        onNext={next}
      />
    </section>
  );
}

function Result({ quiz, r }) {
  const { celebrate } = useUi();
  const once = useRef(false);
  useEffect(() => {
    if (once.current) return undefined;
    once.current = true;
    if (r.earned > 0) confetti(r.score === r.total ? 120 : 60);
    if (!r.levelUp && !r.newBadges.length) return undefined;
    const t = setTimeout(() => celebrate(r), reducedMotion() ? 0 : 1200);
    return () => clearTimeout(t);
  }, [r, celebrate]);

  const line = r.score === r.total ? 'A perfect round.' : r.score >= r.total / 2 ? 'Solid reading.' : 'Every quiz is a chance to catch up.';
  return (
    <section className="play">
      <div className="result-head">
        <p className="hint">{r.challenge && 'Daily challenge · '}{quiz.title}</p>
        <p className="result-score">{r.score}<small>/{r.total}</small></p>
        <p className="result-earned">
          {r.earned > 0
            ? <>+<CountUp to={r.earned} /> points{r.challenge && ' (2× challenge)'}{r.bonus > 0 && `, including a ${r.bonus}-point perfect bonus`}</>
            : 'No points this time'}
        </p>
        <p>{line} Your balance is {r.balance.toLocaleString('en-NG')} points.</p>
        {r.note && <p className="note">{r.note}</p>}
        <div className="result-level"><XpBar level={r.level} /></div>
        {r.streak.current > 0 && <p className="result-streak">🔥 {r.streak.current}-day streak</p>}
        <div className="actions">
          <Link className="btn" to="/">Pick another quiz</Link>
          <Link className="btn btn--ghost" to="/me">My dashboard</Link>
        </div>
      </div>
      <h2 className="section-head">Your answers</h2>
      <ol className="review">
        {r.review.map((q) => (
          <li key={q.questionId}>
            <div className="review__q">{q.text}</div>
            <div className="review__a">
              {q.correct
                ? <><span className="right">{q.options[q.answer]}</span> (correct)</>
                : <>{q.choice === null ? <span className="hint">No answer</span> : <span className="wrong">{q.options[q.choice]}</span>}, answer: <span className="right">{q.options[q.answer]}</span></>}
            </div>
            {q.explanation && <div className="review__exp">{q.explanation}</div>}
          </li>
        ))}
      </ol>
    </section>
  );
}

// Shown before a new attempt starts, so the rules are read before any timer runs
function Rules({ quiz, mult, onStart }) {
  const [busy, setBusy] = useState(false);
  const challenge = quiz.id === mult.challengeId;
  return (
    <section className="play rules">
      <p className="hand">Before you start</p>
      <h1 className="display">{quiz.title}</h1>
      <p className="hint">{quiz.category} · {quiz.question_count} questions · {quiz.seconds_per_question} seconds each{challenge && ` · daily challenge, ${mult.value}× points`}</p>
      <ol className="rules__list">
        <li><b>One question at a time.</b> Each has its own {quiz.seconds_per_question}-second timer.</li>
        <li><b>Your first pick is final.</b> The answer locks as soon as you choose it.</li>
        <li className="rules__warn"><b>Stay on this page.</b> If you leave, refresh or close the page while a question is showing and you haven’t answered it, that question <b>counts as missed</b>. When you come back, you continue from the next question.</li>
        <li><b>Points are paid once per quiz per day.</b> Playing again today is practice.</li>
      </ol>
      <div className="actions" style={{ justifyContent: 'flex-start' }}>
        <button className="btn" type="button" disabled={busy} onClick={() => { setBusy(true); onStart(); }}>Start quiz</button>
        <Link className="btn btn--ghost" to="/">Back to quizzes</Link>
      </div>
    </section>
  );
}

export default function Play() {
  const { id } = useParams();
  const { setPoints, markPlayed, applyProgress } = useAuth();
  const [intro, setIntro] = useState(null);
  const [session, setSession] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const started = useRef(false);

  const start = () => api.post(`/quizzes/${id}/start`).then(setSession, setError);

  // Guarded so React's development double-effect doesn't run this twice.
  // An unfinished attempt resumes straight away; otherwise show the rules first.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    Promise.all([api.get('/quizzes'), api.get('/quizzes/in-progress')]).then(([list, open]) => {
      if (open.attempts.some((a) => a.quizId === Number(id))) return start();
      const quiz = list.quizzes.find((q) => q.id === Number(id));
      if (!quiz) throw new Error('This quiz isn’t available.');
      setIntro({ quiz, mult: { challengeId: list.challengeId, value: list.challengeMultiplier } });
    }).catch(setError);
  }, [id]);

  // The server scores the answers locked during play, so there's nothing to send
  const finish = async () => {
    setSubmitting(true);
    try {
      const r = await api.post(`/attempts/${session.attemptId}/submit`);
      if (r.earned > 0) markPlayed(session.quiz.id);
      applyProgress(r);
      setPoints(r.balance);
      setResult(r);
    } catch (err) { setError(err); }
  };

  if (error) return <ErrorState error={error} />;
  if (result) return <Result quiz={session.quiz} r={result} />;
  if (submitting) return <p className="loading">Adding up your score…</p>;
  if (!session && intro) return <Rules {...intro} onStart={start} />;
  if (!session) return <Skeleton />;
  return <Player session={session} onFinish={finish} />;
}
