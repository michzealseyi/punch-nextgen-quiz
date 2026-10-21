import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useUi } from '../context/UiContext.jsx';
import { fmt } from '../utils.js';

// Vote buttons until you've voted, then animated result bars
export default function PollCard({ poll: initial, points }) {
  const { me, setPoints } = useAuth();
  const { toast, celebrate } = useUi();
  const navigate = useNavigate();
  const location = useLocation();
  const [poll, setPoll] = useState(initial);
  const [busy, setBusy] = useState(false);
  if (!poll) return null;

  const vote = async (choice) => {
    if (!me) { navigate('/login', { state: { from: location.pathname } }); return; }
    setBusy(true);
    try {
      const r = await api.post(`/polls/${poll.id}/vote`, { choice });
      setPoll(r.poll);
      setPoints(r.balance);
      toast(`Thanks for voting. +${r.earned} pts`);
      celebrate({ newBadges: r.newBadges });
    } catch (err) {
      toast(err.message, true);
      setBusy(false);
    }
  };

  const voted = poll.myVote !== null;
  return (
    <section className="poll" aria-labelledby="pollQ">
      <span className="tag tag--hot">Poll</span>
      <h3 className="poll__q" id="pollQ">{poll.question}</h3>
      {voted ? (
        <>
          <ul className="poll__results">
            {poll.options.map((o, i) => {
              const pct = poll.total ? Math.round((poll.counts[i] / poll.total) * 100) : 0;
              return (
                <li key={o} className={i === poll.myVote ? 'is-mine' : ''}>
                  <div className="poll__row"><span>{o}{i === poll.myVote && <small>Your vote</small>}</span><b>{pct}%</b></div>
                  <div className="poll__bar"><span style={{ width: `${pct}%` }} /></div>
                </li>
              );
            })}
          </ul>
          <p className="hint">{fmt(poll.total)} vote{poll.total === 1 ? '' : 's'} so far</p>
        </>
      ) : (
        <>
          <div className="poll__options">
            {poll.options.map((o, i) => (
              <button key={o} type="button" className="poll__opt" disabled={busy} onClick={() => vote(i)}>{o}</button>
            ))}
          </div>
          <p className="hint">{me ? `Vote to see the results and earn ${points} pts.` : 'Sign in to vote and see the results.'}</p>
        </>
      )}
    </section>
  );
}
