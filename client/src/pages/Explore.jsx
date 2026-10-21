import { api } from '../api.js';
import { ErrorState, Intro, Meter, Skeleton } from '../components/common.jsx';
import { QuizItem } from '../components/QuizCards.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useApi } from '../useApi.js';
import { deskId, reducedMotion } from '../utils.js';

export default function Explore() {
  const { me } = useAuth();
  const { data, error } = useApi(
    () => Promise.all([api.get('/quizzes'), me ? api.get('/me/dashboard') : Promise.resolve(null)]),
    [me?.id],
  );
  if (error) return <ErrorState error={error} />;
  if (!data) return <Skeleton />;

  const [{ quizzes, challengeId, challengeMultiplier: mult }, dash] = data;
  const desks = [...new Set(quizzes.map((q) => q.category))];
  const progress = new Map((dash?.desks || []).map((d) => [d.desk, d]));
  const jump = (desk) => document.getElementById(deskId(desk)).scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth' });

  return (
    <>
      <Intro pillar="Explore" title="Every desk, one place">
        Pick a desk you love or one you know nothing about. Finish a quiz from every desk to unlock the Desk hopper badge.
      </Intro>
      <div className="chips" role="group" aria-label="Jump to a desk">
        {desks.map((d) => <button key={d} type="button" className="chip" onClick={() => jump(d)}>{d}</button>)}
      </div>
      {desks.map((d) => {
        const p = progress.get(d);
        return (
          <section key={d} className="desk" id={deskId(d)}>
            <div className="desk__head">
              <h2 className="section-head">{d}</h2>
              {p && <span className="desk__progress">{p.played} of {p.total} played</span>}
            </div>
            {p && <Meter pct={(p.played / p.total) * 100} />}
            <ul className="quiz-list">
              {quizzes.filter((q) => q.category === d).map((q) => <QuizItem key={q.id} q={q} challengeId={challengeId} mult={mult} />)}
            </ul>
          </section>
        );
      })}
    </>
  );
}
