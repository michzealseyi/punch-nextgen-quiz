// Task 1: the student's dashboard (name, XP, points, quizzes completed, badges, streak, rank)
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Avatar, BadgeCard, CountUp, ErrorState, Meter, Skeleton, XpBar } from '../components/common.jsx';
import PollCard from '../components/PollCard.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useApi } from '../useApi.js';

export default function Dashboard() {
  const { setMe, applyProgress } = useAuth();
  const { data, error } = useApi(
    () => Promise.all([api.get('/me/dashboard'), api.get('/me/history'), api.get('/polls/current')]),
    [],
  );
  // Keep the header (points, level, streak) in step with what the dashboard shows
  useEffect(() => {
    if (data) { setMe(data[0].user); applyProgress(data[0]); }
  }, [data]);

  if (error) return <ErrorState error={error} />;
  if (!data) return <Skeleton />;

  const [d, { ledger }, { poll, points: pollPts }] = data;
  const acc = d.stats.answered ? Math.round((d.stats.correct / d.stats.answered) * 100) : 0;
  const earned = d.badges.filter((b) => b.earnedAt).length;
  const rec = d.recommended;

  return (
    <>
      <section className="dash-hero">
        <div className="dash-hero__who">
          <Avatar name={d.user.name} size="avatar--xl" />
          <div><p className="hand">Welcome back,</p><h1 className="display">{d.user.name.split(' ')[0]}</h1></div>
        </div>
        <XpBar level={d.level} dark />
        <div className="dash-stats">
          <div><b><CountUp to={d.user.lifetimePoints} /></b><span>Total XP earned</span></div>
          <div><b><CountUp to={d.user.points} /></b><span>Points to spend</span></div>
          <div><b><CountUp to={d.stats.quizzes} /></b><span>Quizzes completed</span></div>
          <div><b>{earned}<small>/{d.badges.length}</small></b><span>Badges earned</span></div>
          <div><b>🔥 <CountUp to={d.streak.current} /></b><span>Day streak{d.streak.current > 0 && !d.streak.playedToday ? '. Play today to keep it' : ''}</span></div>
          <div><b>#{d.stats.rank}</b><span>Leaderboard rank</span></div>
          <div><b><CountUp to={acc} />%</b><span>Answers correct</span></div>
        </div>
      </section>

      <div className="grid">
        <section>
          <h2 className="section-head">Up next for you</h2>
          {rec ? (
            <article className="next-card">
              {rec.challenge && <span className="tag tag--hot">Daily challenge 2×</span>}
              <p className="quiz-item__meta">{rec.category}, {rec.question_count} questions</p>
              <h3>{rec.title}</h3>
              <p>{rec.description}</p>
              <Link className="btn" to={`/quiz/${rec.id}`}>Play now</Link>
            </article>
          ) : (
            <div className="empty"><p>You’ve earned points from every quiz today. Come back tomorrow for more.</p></div>
          )}

          <h2 className="section-head">Badges <small>{earned} of {d.badges.length}</small></h2>
          <ul className="badges">{d.badges.map((b) => <BadgeCard key={b.id} badge={b} earned={!!b.earnedAt} />)}</ul>

          <h2 className="section-head">Desk progress</h2>
          <ul className="desk-progress">
            {d.desks.map((x) => (
              <li key={x.desk}>
                <div className="desk-progress__row"><span>{x.desk}</span><span>{x.played} of {x.total}</span></div>
                <Meter pct={(x.played / x.total) * 100} />
              </li>
            ))}
          </ul>

          <h2 className="section-head">Recent quizzes</h2>
          {d.recent.length ? (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Quiz</th><th>Score</th><th className="num">Points</th></tr></thead>
                <tbody>
                  {d.recent.map((a) => (
                    <tr key={a.id}>
                      <td>{a.title}<br /><span className="hint">{new Date(a.finished_at).toLocaleString('en-NG')}{a.status === 'expired' && ', timed out'}</span></td>
                      <td>{a.score}/{a.total}</td>
                      <td className="num">{a.points_earned ? `+${a.points_earned}` : '0'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty"><p>You haven’t finished a quiz yet.</p><Link className="btn" to="/">Play your first quiz</Link></div>
          )}
        </section>

        <aside>
          <div className="week-card">
            <span className="hand">This week</span>
            <b><CountUp to={d.weekPoints} /></b>
            <span>points earned since Monday</span>
            <Link to="/leaderboard/week">See the weekly board</Link>
          </div>
          <PollCard poll={poll} points={pollPts} />
          <h2 className="section-head">Points history</h2>
          <div className="table-wrap">
            <table>
              <tbody>
                {ledger.map((l, i) => (
                  <tr key={i}><td>{l.reason}</td><td className={'num ' + (l.delta > 0 ? 'plus' : 'minus')}>{l.delta > 0 ? '+' : ''}{l.delta}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <Link className="cta-card" to="/contribute"><span aria-hidden="true">✍️</span><span><b>Write a question.</b> Earn 25 pts and the Contributor badge when it’s published.</span></Link>
        </aside>
      </div>
    </>
  );
}
