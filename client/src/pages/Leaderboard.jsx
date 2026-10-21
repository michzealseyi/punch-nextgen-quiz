import { Link, NavLink } from 'react-router-dom';
import { api } from '../api.js';
import { BoardRows, Podium } from '../components/Board.jsx';
import { Avatar, ErrorState, Intro, Skeleton } from '../components/common.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useApi } from '../useApi.js';
import { fmt } from '../utils.js';

export default function Leaderboard({ period }) {
  const week = period === 'week';
  const { me } = useAuth();
  const { data, error } = useApi(() => api.get('/leaderboard' + (week ? '?period=week' : '')), [week, me?.id]);
  if (error) return <ErrorState error={error} />;
  if (!data) return <Skeleton />;

  const { leaders, me: mine } = data;
  return (
    <>
      <Intro pillar="Belong" title="Leaderboard">
        {week
          ? 'Points earned since Monday, West Africa Time. It resets every week, so anyone can take the top spot.'
          : 'Ranked by total XP, so spending points on rewards never costs you your place.'}
      </Intro>
      <nav className="tabs" aria-label="Leaderboard period">
        <NavLink to="/leaderboard" end>All time</NavLink>
        <NavLink to="/leaderboard/week">This week</NavLink>
      </nav>
      {leaders.length ? (
        <>
          <Podium top={leaders.slice(0, 3)} />
          {leaders.length > 3 && <ol className="board board--rest"><BoardRows leaders={leaders.slice(3)} /></ol>}
        </>
      ) : (
        <div className="empty"><p>No points on the board {week ? 'this week ' : ''}yet. Play a quiz to take first place.</p><Link className="btn" to="/">Play now</Link></div>
      )}
      {mine && me && (
        <div className="me-rank">
          <Avatar name={me.name} size="avatar--sm" />
          <span className="me-rank__you">You</span>
          <b>{mine.rank ? `#${mine.rank}` : 'Not ranked yet'}</b>
          <span>{fmt(mine.points)} {week ? 'pts this week' : 'XP'}</span>
        </div>
      )}
    </>
  );
}
