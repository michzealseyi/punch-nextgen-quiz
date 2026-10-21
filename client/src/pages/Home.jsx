import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Board } from '../components/Board.jsx';
import { ErrorState, Skeleton, Stripe } from '../components/common.jsx';
import PollCard from '../components/PollCard.jsx';
import { ChallengeCard, QuizItem } from '../components/QuizCards.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useApi } from '../useApi.js';

export default function Home() {
  const { me } = useAuth();
  const { data, error } = useApi(
    () => Promise.all([api.get('/quizzes'), api.get('/leaderboard'), api.get('/polls/current')]),
    [me?.id],
  );
  if (error) return <ErrorState error={error} />;
  if (!data) return <Skeleton />;

  const [{ quizzes, challengeId, challengeMultiplier: mult }, { leaders }, { poll, points: pollPts }] = data;
  return (
    <>
      <section className="hero">
        <div className="hero__copy">
          <p className="hero__kicker">Learn · Play · Explore · Belong</p>
          <h1 className="hero__title">Tap in.<br /><span>Level up.</span></h1>
          <p className="hero__lede">Quick quizzes from the PUNCH desks. Earn XP, unlock badges, climb the leaderboard and turn points into E-Paper access, airtime and merch.</p>
          <div className="hero__actions">
            {me
              ? <><Link className="btn" to="/me">My dashboard</Link><Link className="btn btn--outline-light" to="/rewards">See rewards</Link></>
              : <><Link className="btn" to="/register">Join free, get 50 pts</Link><Link className="btn btn--outline-light" to="/login">Sign in</Link></>}
          </div>
        </div>
        <ChallengeCard quiz={quizzes.find((q) => q.id === challengeId)} mult={mult} />
      </section>

      <div className="grid">
        <section aria-labelledby="qh">
          <h2 className="section-head" id="qh">Today’s quizzes</h2>
          <ul className="quiz-list">
            {quizzes.map((q) => <QuizItem key={q.id} q={q} challengeId={challengeId} mult={mult} />)}
          </ul>
        </section>
        <aside>
          <PollCard poll={poll} points={pollPts} />
          <h2 className="section-head section-head--ink">Top students</h2>
          <Board leaders={leaders.slice(0, 5)} />
          <p style={{ marginTop: '1rem' }}><Link to="/leaderboard">Full leaderboard</Link></p>
          <Stripe style={{ margin: '2rem 0 1rem' }} />
          <h3>How points work</h3>
          <p className="hint">Points are awarded the first time you complete each quiz in a day (West Africa Time), and the daily challenge pays {mult}×. Everything you earn also counts as XP towards your level, and spending points never lowers it.</p>
          <Link className="cta-card" to="/contribute"><span aria-hidden="true">✍️</span><span><b>Got a great question?</b> Send it in. If our editors publish it, you earn 25 pts.</span></Link>
        </aside>
      </div>
    </>
  );
}
