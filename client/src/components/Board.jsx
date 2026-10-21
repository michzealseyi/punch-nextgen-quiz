import { useAuth } from '../context/AuthContext.jsx';
import { fmt } from '../utils.js';
import { Avatar } from './common.jsx';

export function BoardRows({ leaders }) {
  const { me } = useAuth();
  return leaders.map((l) => (
    <li key={l.id} className={me && l.id === me.id ? 'is-me' : ''}>
      <Avatar name={l.name} size="avatar--sm" />
      <span className="board__name">{l.name}{l.level && <small>{l.level}</small>}</span>
      <span className="board__pts">{fmt(l.points)}</span>
    </li>
  ));
}

export function Board({ leaders }) {
  if (!leaders.length) return <p className="hint">No scores yet. Be the first.</p>;
  return <ol className="board"><BoardRows leaders={leaders} /></ol>;
}

// Top three on blocks; CSS orders them 2-1-3
export function Podium({ top }) {
  const { me } = useAuth();
  return (
    <ol className="podium">
      {top.map((l, i) => (
        <li key={l.id} className={`podium__p podium__p${i + 1}${me && l.id === me.id ? ' is-me' : ''}`}>
          <Avatar name={l.name} size="avatar--lg" />
          <span className="podium__name">{l.name}</span>
          <span className="podium__lvl">{l.level}</span>
          <span className="podium__pts">{fmt(l.points)}</span>
          <div className="podium__block" aria-label={`Rank ${i + 1}`}>{i + 1}</div>
        </li>
      ))}
    </ol>
  );
}
