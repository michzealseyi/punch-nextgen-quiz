import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { CountUp, ErrorState, Intro, Meter, Skeleton } from '../components/common.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useUi } from '../context/UiContext.jsx';
import { useApi } from '../useApi.js';
import { confetti, fmt } from '../utils.js';

const KIND = { digital: 'Digital access', airtime: 'Airtime', merch: 'Merchandise' };

export default function Rewards() {
  const { me, setPoints } = useAuth();
  const { modal, toast, celebrate } = useUi();
  const { data, error, reload } = useApi(
    () => Promise.all([api.get('/rewards'), me ? api.get('/me/redemptions') : Promise.resolve({ redemptions: [] })]),
    [me?.id],
  );
  if (error) return <ErrorState error={error} />;
  if (!data) return <Skeleton />;

  const [{ rewards }, { redemptions }] = data;
  const bal = me?.points ?? 0;

  const redeem = async (w) => {
    const ok = await modal({
      title: 'Redeem this reward?',
      body: (
        <>
          <p className="modal__lead">{w.name}</p>
          <dl className="modal__sum">
            <div><dt>Cost</dt><dd>{fmt(w.cost)} pts</dd></div>
            <div><dt>Your balance</dt><dd>{fmt(bal)} pts</dd></div>
            <div className="is-total"><dt>After redeeming</dt><dd>{fmt(bal - w.cost)} pts</dd></div>
          </dl>
          <p className="hint">You’ll get a code to show at the Magboro office or quote to support.</p>
        </>
      ),
      confirmLabel: 'Redeem',
    });
    if (!ok) return;
    try {
      const r = await api.post(`/rewards/${w.id}/redeem`);
      setPoints(r.balance);
      confetti(50);
      reload();
      await modal({
        title: 'Reward redeemed',
        body: (
          <>
            <p>Your code for <b>{r.reward}</b>:</p>
            <p className="code code--big">{r.code}</p>
            <p className="hint">Show it at the Magboro office or quote it to support. It’s also saved under Your redemption codes.</p>
          </>
        ),
        confirmLabel: 'Done',
        cancelLabel: null,
      });
      celebrate({ newBadges: r.newBadges });
    } catch (err) { toast(err.message, true); }
  };

  return (
    <>
      <Intro pillar="Earn it" title="Rewards" />
      <div className="balance">
        {me
          ? <><span className="balance__num"><CountUp to={bal} /></span><span>points to spend</span></>
          : <span className="hint"><Link to="/login">Sign in</Link> to redeem.</span>}
      </div>
      <div className="rewards">
        {rewards.map((w) => {
          const short = me ? Math.max(0, w.cost - bal) : 0;
          const out = w.stock < 1;
          const label = out ? 'Out of stock' : !me ? 'Sign in to redeem' : short ? `${fmt(short)} more pts needed` : 'Redeem';
          return (
            <article key={w.id} className="reward">
              <span className="reward__kind">{KIND[w.kind] || w.kind}</span>
              <h3>{w.name}</h3>
              <p>{w.description}</p>
              {me && !out && <Meter pct={(bal / w.cost) * 100} />}
              <div className="reward__foot">
                <div><div className="reward__cost">{fmt(w.cost)} pts</div><div className="reward__stock">{out ? 'None left' : `${w.stock} left`}</div></div>
                <button className="btn btn--small" disabled={out || !!short || !me} onClick={() => redeem(w)}>{label}</button>
              </div>
            </article>
          );
        })}
      </div>
      {me && (
        <>
          <h2 className="section-head" style={{ marginTop: '3rem' }}>Your redemption codes</h2>
          {redemptions.length ? (
            <ul className="codes">
              {redemptions.map((r) => (
                <li key={r.code}>
                  <span><b>{r.name}</b><br /><span className="hint">{new Date(r.created_at + 'Z').toLocaleString('en-NG')}</span></span>
                  <span className="code">{r.code}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="hint">Codes for rewards you redeem appear here. Show the code at the Magboro office or quote it to support.</p>
          )}
        </>
      )}
    </>
  );
}
