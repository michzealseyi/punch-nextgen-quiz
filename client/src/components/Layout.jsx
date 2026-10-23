// Page chrome: masthead with account area, main nav, footer pillars and the phone tab bar
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useUi } from '../context/UiContext.jsx';
import { fmt } from '../utils.js';
import { Avatar, Skeleton } from './common.jsx';
import Icon from './Icon.jsx';

function Brand() {
  // Show the official logo if public/assets/logo.png has been added
  const [hasLogo, setHasLogo] = useState(false);
  useEffect(() => {
    const probe = new Image();
    probe.onload = () => setHasLogo(true);
    probe.src = '/assets/logo.png';
  }, []);
  return (
    <Link to="/" className="brand" aria-label="PUNCH NextGen home">
      {hasLogo ? <img src="/assets/logo.png" alt="PUNCH" className="brand__logo" /> : <span className="brand__badge">PUNCH</span>}
      <span className="brand__word">next<b>GEN</b></span>
      <span className="brand__tag">Tap in, level up</span>
    </Link>
  );
}

function Account() {
  const { me, level, streak, signOut } = useAuth();
  const { toast } = useUi();
  const navigate = useNavigate();
  // Bounce the points pill whenever the balance changes
  const [bump, setBump] = useState(0);
  const prev = useRef(me?.points);
  useEffect(() => {
    if (me && prev.current != null && me.points !== prev.current) setBump((b) => b + 1);
    prev.current = me?.points;
  }, [me]);

  if (!me) {
    return (
      <>
        <Link className="btn btn--small btn--outline-light" to="/login">Sign in</Link>
        <Link className="btn btn--small" to="/register">Join free</Link>
      </>
    );
  }
  const student = me.role !== 'admin';
  return (
    <>
      {student && streak?.current > 0 && <span className="chip chip--streak" title="Days in a row">🔥 {streak.current}</span>}
      {student && <Link key={bump} className={'points-pill' + (bump ? ' is-bump' : '')} to="/rewards">{fmt(me.points)} pts</Link>}
      <Link className="acct" to={student ? '/me' : '/admin'} aria-label={student ? 'Your dashboard' : 'Admin'}>
        <Avatar name={me.name} />
        <span className="acct__meta">
          <b>{me.name.split(' ')[0]}</b>
          {student ? level && <small>Lv {level.number} {level.name}</small> : <small>Admin</small>}
        </span>
      </Link>
      <button className="linkish" type="button" onClick={() => { signOut(); navigate('/'); toast('Signed out.'); }}>Sign out</button>
    </>
  );
}

const NAV = [
  ['/', 'Quizzes'], ['/challenge', 'Daily challenge'], ['/explore', 'Desks'], ['/leaderboard', 'Leaderboard'],
  ['/rewards', 'Rewards'], ['/contribute', 'Contribute'], ['/me', 'Dashboard'],
];
const PILLARS = [['/', 'learn', 'Learn'], ['/challenge', 'play', 'Play'], ['/explore', 'explore', 'Explore'], ['/leaderboard', 'belong', 'Belong']];

export default function Layout() {
  const { me, ready, loadInProgress } = useAuth();
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  // Keep the "Continue" buttons accurate as the student moves around
  useEffect(() => { if (me) loadInProgress(); }, [pathname, me?.id, loadInProgress]);

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="masthead">
        <div className="masthead__inner">
          <Brand />
          <div className="masthead__side masthead__side--end"><Account /></div>
        </div>
        <nav className="nav" aria-label="Main">
          <ul className="nav__list">
            {NAV.map(([to, label]) => <li key={to}><NavLink to={to} end={to === '/'}>{label}</NavLink></li>)}
            {me?.role === 'admin' && <li><NavLink to="/admin">Admin</NavLink></li>}
          </ul>
        </nav>
      </header>

      <main id="main" className="page" tabIndex={-1}>
        {ready ? <Outlet /> : <Skeleton />}
      </main>

      <footer className="footer">
        <ul className="pillars">
          {PILLARS.map(([to, icon, label]) => (
            <li key={icon}><Link to={to} className={`pillars--${icon}`}><Icon name={icon} /><span>{label}</span></Link></li>
          ))}
        </ul>
        <p className="footer__pitch">An interactive space that inspires young people to <b>explore</b>, <b>learn</b>, <b>compete</b> and <b>connect</b>.</p>
        <div className="footer__small">
          <p>Punch Nigeria Limited, KM 14 Lagos/Ibadan Expressway, Magboro, Ogun State</p>
          <p>Points are awarded once per quiz per day. Rewards are subject to stock.</p>
        </div>
      </footer>

      <nav className="tabbar" aria-label="Quick links">
        {[...PILLARS, ['/me', 'me', 'Me']].map(([to, icon, label]) => (
          <NavLink key={icon} to={to} end={to === '/'}><Icon name={icon} /><span>{label}</span></NavLink>
        ))}
      </nav>
    </>
  );
}
