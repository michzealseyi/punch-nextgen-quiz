// Small presentational pieces shared by several pages
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fmt, msToWatMidnight, reducedMotion } from '../utils.js';

export const Skeleton = () => (
  <div className="skeleton" role="status" aria-label="Loading"><span /><span /><span /><span /><span /></div>
);

export const ErrorState = ({ error }) => (
  <div className="empty"><p>{error.message}</p><Link className="btn" to="/">Back to quizzes</Link></div>
);

// Page intro in the flyer style: handwritten pillar word over a heavy headline
export const Intro = ({ pillar, title, children }) => (
  <section className="intro">
    <p className="hand">{pillar}</p>
    <h1 className="display">{title}</h1>
    {children && <p>{children}</p>}
  </section>
);

export const Stripe = ({ style }) => (
  <div className="stripe" aria-hidden="true" style={style}><span /><span /><span /><span /><span /></div>
);

export const Meter = ({ pct }) => (
  <div className="meter" aria-hidden="true"><span style={{ width: `${Math.min(100, pct)}%` }} /></div>
);

const AVATAR_COLORS = ['#FF0000', '#000000', '#FA450D', '#1E7B34', '#B30000', '#3a3a3a'];
export function Avatar({ name, size = '' }) {
  const initials = String(name).split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  let h = 0;
  for (const c of String(name)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return <span className={`avatar ${size}`} style={{ background: AVATAR_COLORS[h % AVATAR_COLORS.length] }} aria-hidden="true">{initials}</span>;
}

// Counts up from 0 so earned numbers feel earned
export function CountUp({ to }) {
  const [value, setValue] = useState(() => (reducedMotion() || !to ? to : 0));
  useEffect(() => {
    if (reducedMotion() || !to) { setValue(to); return undefined; }
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min((now - start) / 900, 1);
      setValue(Math.round((1 - Math.pow(1 - t, 3)) * to));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <>{fmt(value)}</>;
}

export function XpBar({ level, dark = false }) {
  const pct = Math.round(level.progress * 100);
  return (
    <div className={'xp' + (dark ? ' xp--dark' : '')}>
      <div className="xp__head">
        <span className="xp__level">Lv {level.number} · {level.name}</span>
        <span className="xp__to">{level.next ? `${fmt(level.next.min - level.xp)} XP to ${level.next.name}` : 'Top level reached'}</span>
      </div>
      <div className="xp__bar" role="progressbar" aria-label="Progress to the next level" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export const BadgeCard = ({ badge, earned }) => (
  <li className={'badge' + (earned ? ' is-earned' : '')}>
    <span className="badge__icon" aria-hidden="true">{badge.icon}</span>
    <b>{badge.name}</b>
    <span>{badge.description}</span>
    {!earned && <span className="skip">Not earned yet</span>}
  </li>
);

// Live "new challenge in hh:mm:ss" until midnight WAT
export function Countdown() {
  const format = () => {
    const s = Math.floor(msToWatMidnight() / 1000);
    return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, '0')).join(':');
  };
  const [text, setText] = useState(format);
  useEffect(() => {
    const id = setInterval(() => setText(format()), 1000);
    return () => clearInterval(id);
  }, []);
  return <b>{text}</b>;
}
