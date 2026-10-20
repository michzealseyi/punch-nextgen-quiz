(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const main = $('#main');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => Number(n || 0).toLocaleString('en-NG');
  const KEYS = ['A', 'B', 'C', 'D'];
  const DESKS = ['News', 'Sports', 'Business', 'HealthWise', 'Metro Plus', 'Featured'];

  const state = { me: null, level: null, streak: null, playedToday: new Set() };
  let cleanup = null; // stops timers when leaving a view

  /* ---------- Shared UI ---------- */

  function toast(msg, isError = false) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast is-on' + (isError ? ' toast--error' : '');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { t.className = 'toast'; }, 3200);
  }

  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Counts [data-count] elements up from 0 so earned numbers feel earned
  function countUp(root = main) {
    if (reducedMotion()) return;
    root.querySelectorAll('[data-count]').forEach((el) => {
      const to = Number(el.dataset.count);
      if (!to) return;
      const start = performance.now(), dur = 900;
      const tick = (now) => {
        const t = Math.min((now - start) / dur, 1);
        el.textContent = fmt(Math.round((1 - Math.pow(1 - t, 3)) * to));
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  // CSS confetti in the logo stripe colours
  function confetti(count = 70) {
    if (reducedMotion()) return;
    const colors = ['#FF0000', '#FA450D', '#FCC90F', '#E0FF19', '#8DC63F'];
    const layer = document.createElement('div');
    layer.className = 'confetti';
    layer.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < count; i++) {
      const p = document.createElement('span');
      p.style.cssText = `left:${Math.random() * 100}vw;background:${colors[i % colors.length]};--r:${Math.random() * 360}deg;`
        + `animation-delay:${Math.random() * 0.6}s;animation-duration:${2.2 + Math.random() * 1.6}s`;
      layer.appendChild(p);
    }
    document.body.appendChild(layer);
    setTimeout(() => layer.remove(), 4600);
  }

  // Promise-based dialog built on <dialog>; resolves true when confirmed.
  // `title` and `body` are trusted HTML. Pass cancelLabel: null for a single-button notice.
  function modal({ title, body, confirmLabel = 'OK', cancelLabel = 'Cancel' }) {
    return new Promise((resolve) => {
      const dlg = document.createElement('dialog');
      dlg.className = 'modal';
      dlg.setAttribute('aria-labelledby', 'modalTitle');
      dlg.innerHTML = `<div class="modal__card">
          <h2 class="modal__title" id="modalTitle">${title}</h2>
          <div class="modal__body">${body}</div>
          <div class="modal__actions">
            ${cancelLabel ? `<button type="button" class="btn btn--ghost" data-cancel>${cancelLabel}</button>` : ''}
            <button type="button" class="btn" data-ok>${confirmLabel}</button>
          </div>
        </div>`;
      const finish = (ok) => {
        if (dlg.classList.contains('is-closing')) return;
        dlg.classList.add('is-closing');
        setTimeout(() => { dlg.close(); dlg.remove(); resolve(ok); }, reducedMotion() ? 0 : 180);
      };
      dlg.querySelector('[data-ok]').onclick = () => finish(true);
      if (cancelLabel) dlg.querySelector('[data-cancel]').onclick = () => finish(false);
      dlg.addEventListener('cancel', (e) => { e.preventDefault(); finish(false); }); // Esc
      dlg.addEventListener('click', (e) => { if (e.target === dlg) finish(false); }); // backdrop
      document.body.appendChild(dlg);
      dlg.showModal();
      dlg.querySelector('[data-ok]').focus();
    });
  }

  const article = (word) => (/^[aeiou]/i.test(word) ? 'an' : 'a');

  // Level-ups and new badges get their own moment
  async function celebrate({ newBadges = [], levelUp = false, level = null } = {}) {
    if (!newBadges.length && !levelUp) return;
    const parts = [];
    if (levelUp && level) {
      parts.push(`<div class="levelup"><span class="levelup__num">${level.number}</span>
        <p><b>Level up!</b><br>You’re now ${article(level.name)} ${esc(level.name)}.</p></div>`);
    }
    if (newBadges.length) {
      parts.push(`<ul class="badges badges--reveal">${newBadges.map((b) => badgeHtml({ ...b, earnedAt: true })).join('')}</ul>`);
    }
    if (!reducedMotion()) confetti(40);
    await modal({
      title: newBadges.length ? (newBadges.length > 1 ? 'New badges unlocked' : 'Badge unlocked') : 'Level up!',
      body: parts.join(''), confirmLabel: 'Nice!', cancelLabel: null,
    });
  }

  const AVATAR_COLORS = ['#FF0000', '#000000', '#FA450D', '#1E7B34', '#B30000', '#3a3a3a'];
  function avatar(name, size = '') {
    const initials = String(name).split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
    let h = 0;
    for (const c of String(name)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return `<span class="avatar ${size}" style="background:${AVATAR_COLORS[h % AVATAR_COLORS.length]}" aria-hidden="true">${esc(initials)}</span>`;
  }

  function xpBar(level, dark = false) {
    const pct = Math.round(level.progress * 100);
    const to = level.next ? `${fmt(level.next.min - level.xp)} XP to ${esc(level.next.name)}` : 'Top level reached';
    return `<div class="xp ${dark ? 'xp--dark' : ''}">
      <div class="xp__head"><span class="xp__level">Lv ${level.number} · ${esc(level.name)}</span><span class="xp__to">${to}</span></div>
      <div class="xp__bar" role="progressbar" aria-label="Progress to the next level" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div>
    </div>`;
  }

  const badgeHtml = (b) => `<li class="badge ${b.earnedAt ? 'is-earned' : ''}">
      <span class="badge__icon" aria-hidden="true">${b.icon}</span><b>${esc(b.name)}</b><span>${esc(b.description)}</span>
      ${b.earnedAt ? '' : '<span class="skip">Not earned yet</span>'}</li>`;

  function renderChrome() {
    const acc = $('#account');
    if (state.me) {
      const first = state.me.name.split(' ')[0];
      acc.innerHTML = `
        ${state.streak?.current ? `<span class="chip chip--streak" title="Days in a row">🔥 ${state.streak.current}</span>` : ''}
        <a class="points-pill" href="#/rewards">${fmt(state.me.points)} pts</a>
        <a class="acct" href="#/me" aria-label="Your dashboard">${avatar(state.me.name)}
          <span class="acct__meta"><b>${esc(first)}</b>${state.level ? `<small>Lv ${state.level.number} ${esc(state.level.name)}</small>` : ''}</span></a>
        <button class="linkish" id="logout" type="button">Sign out</button>`;
      $('#logout').onclick = () => {
        Api.setToken(null); state.me = null; state.level = null; state.streak = null; state.playedToday.clear();
        renderChrome(); location.hash = '#/'; toast('Signed out.');
      };
    } else {
      acc.innerHTML = `<a class="btn btn--small btn--outline-light" href="#/login">Sign in</a><a class="btn btn--small" href="#/register">Join free</a>`;
    }
    document.querySelector('.admin-only').hidden = state.me?.role !== 'admin';
  }

  function setPoints(balance) {
    if (!state.me) return;
    const changed = balance !== state.me.points;
    state.me.points = balance;
    renderChrome();
    if (changed) $('.points-pill')?.classList.add('is-bump');
  }

  async function loadMe() {
    if (!Api.hasToken) { state.me = null; return; }
    try {
      const me = await Api.get('/me');
      Object.assign(state, { me: me.user, level: me.level, streak: me.streak });
      const { quizIds } = await Api.get('/quizzes/played-today');
      state.playedToday = new Set(quizIds);
    } catch { state.me = null; }
  }

  function requireLogin() {
    if (state.me) return true;
    sessionStorageSafe.set('returnTo', location.hash);
    location.hash = '#/login';
    return false;
  }

  const sessionStorageSafe = {
    get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* ignore */ } },
    del(k) { try { sessionStorage.removeItem(k); } catch { /* ignore */ } },
  };

  const loading = () => { main.innerHTML = '<div class="skeleton" role="status" aria-label="Loading"><span></span><span></span><span></span><span></span><span></span></div>'; };
  const failed = (err) => { main.innerHTML = `<div class="empty"><p>${esc(err.message)}</p><a class="btn" href="#/">Back to quizzes</a></div>`; };

  // Time left until the challenge rotates at midnight West Africa Time (UTC+1)
  function msToWatMidnight() {
    const HOUR = 3600e3, DAY = 86400e3, now = Date.now();
    return Math.ceil((now + HOUR) / DAY) * DAY - HOUR - now;
  }

  function startCountdowns() {
    const els = main.querySelectorAll('[data-countdown]');
    if (!els.length) return;
    const tick = () => {
      const s = Math.floor(msToWatMidnight() / 1000);
      const text = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, '0')).join(':');
      els.forEach((e) => { e.textContent = text; });
    };
    tick();
    const id = setInterval(tick, 1000);
    const prev = cleanup;
    cleanup = () => { clearInterval(id); if (prev) prev(); };
  }

  // Page intro in the flyer style: handwritten pillar word over a heavy headline
  const intro = (pillar, title, text) => `<section class="intro">
      <p class="hand">${pillar}</p><h1 class="display">${title}</h1>${text ? `<p>${text}</p>` : ''}</section>`;

  /* ---------- Quiz cards ---------- */

  const quizPoints = (q, challengeId, mult) => q.question_count * q.points_per_correct * (q.id === challengeId ? mult : 1);

  function quizItem(q, challengeId, mult) {
    const done = state.playedToday.has(q.id);
    const isChallenge = q.id === challengeId;
    return `<li class="quiz-item">
      <div>
        <div class="quiz-item__meta">${esc(q.category)}, ${q.question_count} questions, ${q.seconds_per_question}s each
          ${isChallenge ? `<span class="tag tag--hot">${mult}× today</span>` : ''}</div>
        <h3>${esc(q.title)}</h3>
        <p>${esc(q.description)}</p>
      </div>
      <div class="quiz-item__action">
        <a class="btn ${done ? 'btn--ghost' : ''}" href="#/quiz/${q.id}">${done ? 'Practise' : `Play for ${fmt(quizPoints(q, challengeId, mult))} pts`}</a>
        ${done ? '<span class="quiz-item__done">Points earned today</span>' : ''}
      </div>
    </li>`;
  }

  function challengeCard(quiz, mult) {
    if (!quiz) return '';
    const done = state.playedToday.has(quiz.id);
    return `<article class="challenge">
      <span class="ribbon">Daily challenge · ${mult}× points</span>
      <p class="challenge__meta">${esc(quiz.category)} · ${quiz.question_count} questions · ${quiz.seconds_per_question}s each</p>
      <h2 class="challenge__title">${esc(quiz.title)}</h2>
      <p class="challenge__desc">${esc(quiz.description)}</p>
      <div class="challenge__foot">
        <span class="countdown"><small>New challenge in</small><b data-countdown>--:--:--</b></span>
        <a class="btn" href="#/quiz/${quiz.id}">${done ? 'Practise' : `Play for ${fmt(quizPoints(quiz, quiz.id, mult))} pts`}</a>
      </div>
      ${done ? '<p class="challenge__done">Done today. A new challenge lands at midnight.</p>' : ''}
    </article>`;
  }

  /* ---------- Polls ---------- */

  function pollCard(poll, pts) {
    if (!poll) return '';
    const voted = poll.myVote !== null;
    const body = voted
      ? `<ul class="poll__results">${poll.options.map((o, i) => {
          const pct = poll.total ? Math.round((poll.counts[i] / poll.total) * 100) : 0;
          return `<li class="${i === poll.myVote ? 'is-mine' : ''}">
            <div class="poll__row"><span>${esc(o)}${i === poll.myVote ? ' <small>Your vote</small>' : ''}</span><b>${pct}%</b></div>
            <div class="poll__bar"><span style="width:${pct}%"></span></div></li>`;
        }).join('')}</ul>
        <p class="hint">${fmt(poll.total)} vote${poll.total === 1 ? '' : 's'} so far</p>`
      : `<div class="poll__options">${poll.options.map((o, i) => `<button type="button" class="poll__opt" data-vote="${i}">${esc(o)}</button>`).join('')}</div>
        <p class="hint">${state.me ? `Vote to see the results and earn ${pts} pts.` : 'Sign in to vote and see the results.'}</p>`;
    return `<section class="poll" data-poll="${poll.id}" aria-labelledby="pollQ">
      <span class="tag tag--hot">Poll</span>
      <h3 class="poll__q" id="pollQ">${esc(poll.question)}</h3>${body}</section>`;
  }

  function bindPoll() {
    main.querySelectorAll('[data-vote]').forEach((b) => {
      b.onclick = async () => {
        if (!requireLogin()) return;
        const card = b.closest('[data-poll]');
        const buttons = card.querySelectorAll('[data-vote]');
        buttons.forEach((x) => { x.disabled = true; });
        try {
          const r = await Api.post(`/polls/${card.dataset.poll}/vote`, { choice: Number(b.dataset.vote) });
          $('#pollSlot').innerHTML = pollCard(r.poll, r.earned);
          setPoints(r.balance);
          toast(`Thanks for voting. +${r.earned} pts`);
          celebrate({ newBadges: r.newBadges });
        } catch (err) {
          toast(err.message, true);
          buttons.forEach((x) => { x.disabled = false; });
        }
      };
    });
  }

  /* ---------- Leaderboard pieces ---------- */

  const boardRows = (leaders) => leaders.map((l) => `
    <li class="${state.me && l.id === state.me.id ? 'is-me' : ''}">
      ${avatar(l.name, 'avatar--sm')}
      <span class="board__name">${esc(l.name)}${l.level ? `<small>${esc(l.level)}</small>` : ''}</span>
      <span class="board__pts">${fmt(l.points)}</span>
    </li>`).join('');

  function boardHtml(leaders) {
    if (!leaders.length) return '<p class="hint">No scores yet. Be the first.</p>';
    return `<ol class="board">${boardRows(leaders)}</ol>`;
  }

  function podium(top) {
    const place = (l, i) => (l ? `<li class="podium__p podium__p${i + 1} ${state.me && l.id === state.me.id ? 'is-me' : ''}">
        ${avatar(l.name, 'avatar--lg')}
        <span class="podium__name">${esc(l.name)}</span>
        <span class="podium__lvl">${esc(l.level)}</span>
        <span class="podium__pts">${fmt(l.points)}</span>
        <div class="podium__block" aria-label="Rank ${i + 1}">${i + 1}</div>
      </li>` : '');
    return `<ol class="podium">${top.map(place).join('')}</ol>`;
  }

  /* ---------- Home ---------- */

  async function viewHome() {
    loading();
    const [{ quizzes, challengeId, challengeMultiplier: mult }, { leaders }, { poll, points: pollPts }] = await Promise.all([
      Api.get('/quizzes'), Api.get('/leaderboard'), Api.get('/polls/current'),
    ]);
    const challenge = quizzes.find((q) => q.id === challengeId);
    main.innerHTML = `
      <section class="hero">
        <div class="hero__copy">
          <p class="hero__kicker">Learn · Play · Explore · Belong</p>
          <h1 class="hero__title">Tap in.<br><span>Level up.</span></h1>
          <p class="hero__lede">Quick quizzes from the PUNCH desks. Earn XP, unlock badges, climb the leaderboard and turn points into E-Paper access, airtime and merch.</p>
          <div class="hero__actions">
            ${state.me
              ? '<a class="btn" href="#/me">My dashboard</a><a class="btn btn--outline-light" href="#/rewards">See rewards</a>'
              : '<a class="btn" href="#/register">Join free, get 50 pts</a><a class="btn btn--outline-light" href="#/login">Sign in</a>'}
          </div>
        </div>
        ${challengeCard(challenge, mult)}
      </section>
      <div class="grid">
        <section aria-labelledby="qh">
          <h2 class="section-head" id="qh">Today’s quizzes</h2>
          <ul class="quiz-list">${quizzes.map((q) => quizItem(q, challengeId, mult)).join('')}</ul>
        </section>
        <aside>
          <div id="pollSlot">${pollCard(poll, pollPts)}</div>
          <h2 class="section-head section-head--ink" id="lh">Top students</h2>
          ${boardHtml(leaders.slice(0, 5))}
          <p style="margin-top:1rem"><a href="#/leaderboard">Full leaderboard</a></p>
          <div class="stripe" aria-hidden="true" style="margin:2rem 0 1rem"><span></span><span></span><span></span><span></span><span></span></div>
          <h3>How points work</h3>
          <p class="hint">Points are awarded the first time you complete each quiz in a day (West Africa Time), and the daily challenge pays ${mult}×. Everything you earn also counts as XP towards your level, and spending points never lowers it.</p>
          <a class="cta-card" href="#/contribute"><span aria-hidden="true">✍️</span><span><b>Got a great question?</b> Send it in. If our editors publish it, you earn 25 pts.</span></a>
        </aside>
      </div>`;
    bindPoll();
    startCountdowns();
  }

  /* ---------- Daily challenge ---------- */

  async function viewChallenge() {
    loading();
    const { quizzes, challengeId, challengeMultiplier: mult } = await Api.get('/quizzes');
    const quiz = quizzes.find((q) => q.id === challengeId);
    main.innerHTML = `
      ${intro('Play', 'Daily challenge', `One quiz a day pays ${mult}× points. It changes at midnight West Africa Time, so tap in before it’s gone.`)}
      ${quiz ? challengeCard(quiz, mult) : '<div class="empty"><p>No challenge today. Check back soon.</p></div>'}
      <h2 class="section-head">How it works</h2>
      <ol class="steps">
        <li><b>Beat the clock.</b> Every question has its own timer.</li>
        <li><b>Find out straight away.</b> Each answer shows if you were right, with a short explanation.</li>
        <li><b>Score ${mult}×.</b> Correct answers pay ${mult}× the usual points, plus a 20-point bonus for a perfect round.</li>
      </ol>`;
    startCountdowns();
  }

  /* ---------- Explore desks ---------- */

  async function viewExplore() {
    loading();
    const [{ quizzes, challengeId, challengeMultiplier: mult }, dash] = await Promise.all([
      Api.get('/quizzes'), state.me ? Api.get('/me/dashboard') : Promise.resolve(null),
    ]);
    const desks = [...new Set(quizzes.map((q) => q.category))];
    const progress = new Map((dash?.desks || []).map((d) => [d.desk, d]));
    const slug = (s) => 'desk-' + s.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    main.innerHTML = `
      ${intro('Explore', 'Every desk, one place', 'Pick a desk you love or one you know nothing about. Finish a quiz from every desk to unlock the Desk hopper badge.')}
      <div class="chips" role="group" aria-label="Jump to a desk">${desks.map((d) => `<button type="button" class="chip" data-jump="${slug(d)}">${esc(d)}</button>`).join('')}</div>
      ${desks.map((d) => {
        const p = progress.get(d);
        return `<section class="desk" id="${slug(d)}">
          <div class="desk__head"><h2 class="section-head">${esc(d)}</h2>${p ? `<span class="desk__progress">${p.played} of ${p.total} played</span>` : ''}</div>
          ${p ? `<div class="meter" aria-hidden="true"><span style="width:${(p.played / p.total) * 100}%"></span></div>` : ''}
          <ul class="quiz-list">${quizzes.filter((q) => q.category === d).map((q) => quizItem(q, challengeId, mult)).join('')}</ul>
        </section>`;
      }).join('')}`;
    main.querySelectorAll('[data-jump]').forEach((b) => {
      b.onclick = () => document.getElementById(b.dataset.jump).scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth' });
    });
  }

  /* ---------- Auth ---------- */

  function viewAuth(mode) {
    const isReg = mode === 'register';
    main.innerHTML = `
      <section class="auth">
        <p class="hand">${isReg ? 'Tap in' : 'Welcome back'}</p>
        <h1 class="display">${isReg ? 'Create your account' : 'Sign in'}</h1>
        <p class="hint">${isReg ? 'New accounts start with 50 points.' : 'Sign in to keep your streak going.'}</p>
        <form id="authForm" novalidate>
          ${isReg ? `<div class="field"><label for="name">Full name</label><input id="name" name="name" autocomplete="name" required></div>` : ''}
          <div class="field"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" required></div>
          <div class="field"><label for="password">Password</label>
            <input id="password" name="password" type="password" autocomplete="${isReg ? 'new-password' : 'current-password'}" minlength="8" required>
            ${isReg ? '<span class="hint">At least 8 characters.</span>' : ''}</div>
          <p class="form-error" id="formError" role="alert"></p>
          <button class="btn" type="submit" style="width:100%">${isReg ? 'Create account' : 'Sign in'}</button>
        </form>
        <p style="margin-top:1.25rem;text-align:center">${isReg ? 'Already have an account? <a href="#/login">Sign in</a>' : 'New here? <a href="#/register">Create an account</a>'}</p>
        ${!isReg ? '<p class="hint" style="text-align:center">Demo admin: admin@punchng.test / Admin@12345</p>' : ''}
      </section>`;
    const form = $('#authForm');
    form.onsubmit = async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button');
      btn.disabled = true;
      $('#formError').textContent = '';
      try {
        const body = Object.fromEntries(new FormData(form));
        const { token, user } = await Api.post(isReg ? '/auth/register' : '/auth/login', body);
        Api.setToken(token);
        state.me = user;
        await loadMe();
        renderChrome();
        toast(isReg ? 'Account created. 50 points added.' : `Welcome back, ${user.name.split(' ')[0]}.`);
        const back = sessionStorageSafe.get('returnTo');
        sessionStorageSafe.del('returnTo');
        location.hash = back || '#/';
      } catch (err) {
        $('#formError').textContent = err.message;
        btn.disabled = false;
      }
    };
    form.querySelector('input').focus();
  }

  /* ---------- Play ---------- */

  async function viewQuiz(id) {
    if (!requireLogin()) return;
    loading();
    const { quiz, questions, attemptId } = await Api.post(`/quizzes/${id}/start`);
    const answers = questions.map((q) => ({ questionId: q.id, choice: null }));
    let index = 0, timer = null, submitted = false, score = 0, locked = false;

    const stop = () => { if (timer) clearInterval(timer); timer = null; };
    cleanup = () => { stop(); document.onkeydown = null; };

    function renderQuestion() {
      const q = questions[index];
      const last = index === questions.length - 1;
      locked = false;
      main.innerHTML = `
        <section class="play">
          <div class="play__top">
            <span>${quiz.challenge ? '<span class="tag tag--hot">2× challenge</span> ' : ''}${esc(quiz.category)}: ${esc(quiz.title)}</span>
            <span class="play__score">Score <b id="score">${score}</b></span>
          </div>
          <div class="progress" aria-hidden="true">
            ${questions.map((_, i) => `<span class="${i < index ? 'is-done' : i === index ? 'is-current' : ''}"></span>`).join('')}
          </div>
          <div class="play__clock">
            <div class="timer" aria-hidden="true"><div class="timer__bar" id="bar"></div></div>
            <span class="play__secs" id="secs" aria-label="Seconds left">${quiz.secondsPerQuestion}</span>
          </div>
          <p class="play__count">Question ${index + 1} of ${questions.length}</p>
          ${q.imageUrl ? `<img class="play__img" src="${esc(q.imageUrl)}" alt="" loading="lazy">` : ''}
          <h1 class="question">${esc(q.text)}</h1>
          <div class="options" role="group" aria-label="Answer options">
            ${q.options.map((o, i) => `<button type="button" class="option" data-i="${i}" aria-pressed="false">
              <span class="option__key">${KEYS[i]}</span><span>${esc(o)}</span></button>`).join('')}
          </div>
          <div class="feedback" id="feedback" aria-live="polite"></div>
          <div class="actions play__foot">
            <span class="hint play__tip">Press A–D to answer, Enter to continue.</span>
            <button class="btn" id="next" type="button" disabled>${last ? 'See results' : 'Next question'}</button>
          </div>
        </section>`;

      main.querySelectorAll('.option').forEach((b) => { b.onclick = () => lock(Number(b.dataset.i)); });
      $('#next').onclick = advance;
      startTimer();
    }

    // Locks the answer on the server, then shows right or wrong with the explanation
    async function lock(choice) {
      if (locked) return;
      locked = true;
      stop();
      const q = questions[index];
      answers[index].choice = choice;
      const opts = [...main.querySelectorAll('.option')];
      opts.forEach((b) => { b.disabled = true; b.setAttribute('aria-pressed', String(Number(b.dataset.i) === choice)); });

      const next = $('#next');
      let r;
      try {
        r = await Api.post(`/attempts/${attemptId}/answer`, { questionId: q.id, choice });
      } catch (err) {
        $('#feedback').innerHTML = `<div class="feedback__card"><b>${esc(err.message)}</b></div>`;
        next.disabled = false;
        next.focus();
        return;
      }
      opts[r.answer]?.classList.add('is-correct');
      if (choice !== null && !r.correct) opts[choice]?.classList.add('is-wrong');
      if (r.correct) {
        score++;
        const s = $('#score');
        s.textContent = score;
        s.classList.add('is-bump');
      }
      const head = r.correct ? 'Correct!' : choice === null ? `Time’s up. The answer is ${KEYS[r.answer]}.` : `Not quite. The answer is ${KEYS[r.answer]}.`;
      $('#feedback').innerHTML = `<div class="feedback__card ${r.correct ? 'is-correct' : 'is-wrong'}">
        <b>${head}</b>${r.explanation ? `<p>${esc(r.explanation)}</p>` : ''}</div>`;
      next.disabled = false;
      next.focus();
    }

    function startTimer() {
      stop();
      const total = quiz.secondsPerQuestion * 1000;
      const started = performance.now();
      const bar = $('#bar'), secs = $('#secs');
      timer = setInterval(() => {
        const left = Math.max(0, total - (performance.now() - started));
        bar.style.transform = `scaleX(${left / total})`;
        bar.classList.toggle('is-low', left < 5000);
        secs.classList.toggle('is-low', left < 5000);
        secs.textContent = Math.ceil(left / 1000);
        if (left <= 0) lock(null);
      }, 100);
    }

    function advance() {
      if (!locked) return;
      if (index < questions.length - 1) { index++; renderQuestion(); } else submit();
    }

    async function submit() {
      if (submitted) return;
      submitted = true;
      cleanup();
      main.innerHTML = '<p class="loading">Adding up your score…</p>';
      try {
        const result = await Api.post(`/attempts/${attemptId}/submit`, { answers });
        if (result.earned > 0) state.playedToday.add(quiz.id);
        Object.assign(state, { level: result.level, streak: result.streak });
        setPoints(result.balance);
        renderResult(quiz, result);
      } catch (err) { failed(err); }
    }

    document.onkeydown = (e) => {
      if (e.target.closest('input,textarea,select')) return;
      const k = e.key.toUpperCase();
      const i = KEYS.indexOf(k) > -1 ? KEYS.indexOf(k) : ['1', '2', '3', '4'].indexOf(k);
      if (!locked && i > -1 && i < questions[index].options.length) lock(i);
      if (e.key === 'Enter' && locked && !$('#next').disabled) { e.preventDefault(); advance(); }
    };

    renderQuestion();
  }

  function renderResult(quiz, r) {
    const line = r.score === r.total ? 'A perfect round.' : r.score >= r.total / 2 ? 'Solid reading.' : 'Every quiz is a chance to catch up.';
    main.innerHTML = `
      <section class="play">
        <div class="result-head">
          <p class="hint">${r.challenge ? 'Daily challenge · ' : ''}${esc(quiz.title)}</p>
          <p class="result-score">${r.score}<small>/${r.total}</small></p>
          <p class="result-earned">${r.earned > 0 ? `+<span data-count="${r.earned}">${fmt(r.earned)}</span> points${r.challenge ? ' (2× challenge)' : ''}${r.bonus ? `, including a ${r.bonus}-point perfect bonus` : ''}` : 'No points this time'}</p>
          <p>${line} Your balance is ${fmt(r.balance)} points.</p>
          ${r.note ? `<p class="note">${esc(r.note)}</p>` : ''}
          <div class="result-level">${xpBar(r.level)}</div>
          ${r.streak.current ? `<p class="result-streak">🔥 ${r.streak.current}-day streak</p>` : ''}
          <div class="actions">
            <a class="btn" href="#/">Pick another quiz</a>
            <a class="btn btn--ghost" href="#/me">My dashboard</a>
          </div>
        </div>
        <h2 class="section-head">Your answers</h2>
        <ol class="review">
          ${r.review.map((q) => `<li>
            <div class="review__q">${esc(q.text)}</div>
            <div class="review__a">
              ${q.correct
                ? `<span class="right">${esc(q.options[q.answer])}</span> (correct)`
                : `${q.choice === null ? '<span class="hint">No answer</span>' : `<span class="wrong">${esc(q.options[q.choice])}</span>`}, answer: <span class="right">${esc(q.options[q.answer])}</span>`}
            </div>
            ${q.explanation ? `<div class="review__exp">${esc(q.explanation)}</div>` : ''}
          </li>`).join('')}
        </ol>
      </section>`;
    main.focus();
    countUp();
    if (r.earned > 0) confetti(r.score === r.total ? 120 : 60);
    if (r.levelUp || r.newBadges.length) setTimeout(() => celebrate(r), reducedMotion() ? 0 : 1200);
  }

  /* ---------- Rewards ---------- */

  async function viewRewards() {
    loading();
    const [{ rewards }, mine] = await Promise.all([
      Api.get('/rewards'),
      state.me ? Api.get('/me/redemptions') : Promise.resolve({ redemptions: [] }),
    ]);
    const bal = state.me?.points ?? 0;
    const kindLabel = { digital: 'Digital access', airtime: 'Airtime', merch: 'Merchandise' };
    main.innerHTML = `
      ${intro('Earn it', 'Rewards')}
      <div class="balance">
        ${state.me
          ? `<span class="balance__num" data-count="${bal}">${fmt(bal)}</span><span>points to spend</span>`
          : `<span class="hint"><a href="#/login">Sign in</a> to redeem.</span>`}
      </div>
      <div class="rewards">
        ${rewards.map((w) => {
          const short = state.me ? Math.max(0, w.cost - bal) : 0;
          const out = w.stock < 1;
          const label = out ? 'Out of stock' : !state.me ? 'Sign in to redeem' : short ? `${fmt(short)} more pts needed` : 'Redeem';
          return `<article class="reward">
            <span class="reward__kind">${esc(kindLabel[w.kind] || w.kind)}</span>
            <h3>${esc(w.name)}</h3>
            <p>${esc(w.description)}</p>
            ${state.me && !out ? `<div class="meter" aria-hidden="true"><span style="width:${Math.min(100, (bal / w.cost) * 100)}%"></span></div>` : ''}
            <div class="reward__foot">
              <div><div class="reward__cost">${fmt(w.cost)} pts</div><div class="reward__stock">${out ? 'None left' : `${w.stock} left`}</div></div>
              <button class="btn btn--small" data-id="${w.id}" data-name="${esc(w.name)}" data-cost="${w.cost}" ${out || short || !state.me ? 'disabled' : ''}>${label}</button>
            </div>
          </article>`;
        }).join('')}
      </div>
      ${state.me ? `
        <h2 class="section-head" style="margin-top:3rem">Your redemption codes</h2>
        ${mine.redemptions.length
          ? `<ul class="codes">${mine.redemptions.map((r) => `<li><span><b>${esc(r.name)}</b><br><span class="hint">${esc(new Date(r.created_at + 'Z').toLocaleString('en-NG'))}</span></span><span class="code">${esc(r.code)}</span></li>`).join('')}</ul>`
          : '<p class="hint">Codes for rewards you redeem appear here. Show the code at the Magboro office or quote it to support.</p>'}` : ''}`;
    countUp();

    main.querySelectorAll('.reward button[data-id]').forEach((b) => {
      b.onclick = async () => {
        const cost = Number(b.dataset.cost);
        const ok = await modal({
          title: 'Redeem this reward?',
          body: `<p class="modal__lead">${esc(b.dataset.name)}</p>
            <dl class="modal__sum">
              <div><dt>Cost</dt><dd>${fmt(cost)} pts</dd></div>
              <div><dt>Your balance</dt><dd>${fmt(bal)} pts</dd></div>
              <div class="is-total"><dt>After redeeming</dt><dd>${fmt(bal - cost)} pts</dd></div>
            </dl>
            <p class="hint">You’ll get a code to show at the Magboro office or quote to support.</p>`,
          confirmLabel: 'Redeem',
        });
        if (!ok) return;
        b.disabled = true;
        try {
          const r = await Api.post(`/rewards/${b.dataset.id}/redeem`);
          setPoints(r.balance);
          confetti(50);
          viewRewards();
          await modal({
            title: 'Reward redeemed',
            body: `<p>Your code for <b>${esc(r.reward)}</b>:</p><p class="code code--big">${esc(r.code)}</p>
              <p class="hint">Show it at the Magboro office or quote it to support. It’s also saved under Your redemption codes.</p>`,
            confirmLabel: 'Done', cancelLabel: null,
          });
          celebrate({ newBadges: r.newBadges });
        } catch (err) { toast(err.message, true); b.disabled = false; }
      };
    });
  }

  /* ---------- Leaderboard ---------- */

  async function viewLeaderboard(period) {
    loading();
    const week = period === 'week';
    const { leaders, me } = await Api.get('/leaderboard' + (week ? '?period=week' : ''));
    main.innerHTML = `
      ${intro('Belong', 'Leaderboard', week
        ? 'Points earned since Monday, West Africa Time. It resets every week, so anyone can take the top spot.'
        : 'Ranked by total XP, so spending points on rewards never costs you your place.')}
      <nav class="tabs" aria-label="Leaderboard period">
        <a href="#/leaderboard" ${week ? '' : 'aria-current="page"'}>All time</a>
        <a href="#/leaderboard/week" ${week ? 'aria-current="page"' : ''}>This week</a>
      </nav>
      ${leaders.length
        ? `${podium(leaders.slice(0, 3))}${leaders.length > 3 ? `<ol class="board board--rest">${boardRows(leaders.slice(3))}</ol>` : ''}`
        : `<div class="empty"><p>No points on the board ${week ? 'this week' : ''} yet. Play a quiz to take first place.</p><a class="btn" href="#/">Play now</a></div>`}
      ${me && state.me ? `<div class="me-rank">${avatar(state.me.name, 'avatar--sm')}<span class="me-rank__you">You</span>
        <b>${me.rank ? '#' + me.rank : 'Not ranked yet'}</b><span>${fmt(me.points)} ${week ? 'pts this week' : 'XP'}</span></div>` : ''}`;
  }

  /* ---------- Dashboard ---------- */

  async function viewDashboard() {
    if (!requireLogin()) return;
    loading();
    const [d, { ledger }, { poll, points: pollPts }] = await Promise.all([Api.get('/me/dashboard'), Api.get('/me/history'), Api.get('/polls/current')]);
    Object.assign(state, { me: d.user, level: d.level, streak: d.streak });
    renderChrome();
    const acc = d.stats.answered ? Math.round((d.stats.correct / d.stats.answered) * 100) : 0;
    const earned = d.badges.filter((b) => b.earnedAt).length;
    const rec = d.recommended;
    main.innerHTML = `
      <section class="dash-hero">
        <div class="dash-hero__who">${avatar(d.user.name, 'avatar--xl')}
          <div><p class="hand">Welcome back,</p><h1 class="display">${esc(d.user.name.split(' ')[0])}</h1></div>
        </div>
        ${xpBar(d.level, true)}
        <div class="dash-stats">
          <div><b data-count="${d.user.lifetimePoints}">${fmt(d.user.lifetimePoints)}</b><span>Total XP earned</span></div>
          <div><b data-count="${d.user.points}">${fmt(d.user.points)}</b><span>Points to spend</span></div>
          <div><b data-count="${d.stats.quizzes}">${fmt(d.stats.quizzes)}</b><span>Quizzes completed</span></div>
          <div><b>${d.badges.filter((b) => b.earnedAt).length}<small>/${d.badges.length}</small></b><span>Badges earned</span></div>
          <div><b>🔥 <span data-count="${d.streak.current}">${d.streak.current}</span></b><span>Day streak${d.streak.current && !d.streak.playedToday ? '. Play today to keep it' : ''}</span></div>
          <div><b>#${d.stats.rank}</b><span>Leaderboard rank</span></div>
          <div><b><span data-count="${acc}">${acc}</span>%</b><span>Answers correct</span></div>
        </div>
      </section>
      <div class="grid">
        <section>
          <h2 class="section-head">Up next for you</h2>
          ${rec ? `<article class="next-card">
              ${rec.challenge ? '<span class="tag tag--hot">Daily challenge 2×</span>' : ''}
              <p class="quiz-item__meta">${esc(rec.category)}, ${rec.question_count} questions</p>
              <h3>${esc(rec.title)}</h3><p>${esc(rec.description)}</p>
              <a class="btn" href="#/quiz/${rec.id}">Play now</a>
            </article>`
            : '<div class="empty"><p>You’ve earned points from every quiz today. Come back tomorrow for more.</p></div>'}

          <h2 class="section-head">Badges <small>${earned} of ${d.badges.length}</small></h2>
          <ul class="badges">${d.badges.map(badgeHtml).join('')}</ul>

          <h2 class="section-head">Desk progress</h2>
          <ul class="desk-progress">${d.desks.map((x) => `<li>
            <div class="desk-progress__row"><span>${esc(x.desk)}</span><span>${x.played} of ${x.total}</span></div>
            <div class="meter" aria-hidden="true"><span style="width:${(x.played / x.total) * 100}%"></span></div></li>`).join('')}</ul>

          <h2 class="section-head">Recent quizzes</h2>
          ${d.recent.length ? `<div class="table-wrap"><table><thead><tr><th>Quiz</th><th>Score</th><th class="num">Points</th></tr></thead><tbody>
            ${d.recent.map((a) => `<tr><td>${esc(a.title)}<br><span class="hint">${esc(new Date(a.finished_at).toLocaleString('en-NG'))}${a.status === 'expired' ? ', timed out' : ''}</span></td>
              <td>${a.score}/${a.total}</td><td class="num">${a.points_earned ? '+' + a.points_earned : '0'}</td></tr>`).join('')}
            </tbody></table></div>` : '<div class="empty"><p>You haven’t finished a quiz yet.</p><a class="btn" href="#/">Play your first quiz</a></div>'}
        </section>
        <aside>
          <div class="week-card">
            <span class="hand">This week</span>
            <b data-count="${d.weekPoints}">${fmt(d.weekPoints)}</b>
            <span>points earned since Monday</span>
            <a href="#/leaderboard/week">See the weekly board</a>
          </div>
          <div id="pollSlot">${pollCard(poll, pollPts)}</div>
          <h2 class="section-head">Points history</h2>
          <div class="table-wrap"><table><tbody>
            ${ledger.map((l) => `<tr><td>${esc(l.reason)}</td><td class="num ${l.delta > 0 ? 'plus' : 'minus'}">${l.delta > 0 ? '+' : ''}${l.delta}</td></tr>`).join('')}
          </tbody></table></div>
          <a class="cta-card" href="#/contribute"><span aria-hidden="true">✍️</span><span><b>Write a question.</b> Earn 25 pts and the Contributor badge when it’s published.</span></a>
        </aside>
      </div>`;
    countUp();
    bindPoll();
  }

  /* ---------- Question forms (contribute + admin) ---------- */

  function questionFields(quizzes, prefix, withImage = false) {
    return `
      <div class="field"><label for="${prefix}Quiz">Quiz</label><select id="${prefix}Quiz" name="quiz">${quizzes.map((q) => `<option value="${q.id}">${esc(q.title)} (${esc(q.category)})</option>`).join('')}</select></div>
      <div class="field"><label for="${prefix}Text">Question</label><textarea id="${prefix}Text" name="text" rows="2" maxlength="300" required></textarea></div>
      <fieldset class="field options-set"><legend class="hint">Options. Select the correct one.</legend>
        ${KEYS.map((k, i) => `<div class="radio-row"><input type="radio" name="answer" value="${i}" ${i === 0 ? 'checked' : ''} aria-label="Option ${k} is correct">
          <input type="text" name="opt${i}" placeholder="Option ${k}" aria-label="Option ${k}" maxlength="120" required></div>`).join('')}
      </fieldset>
      <div class="field"><label for="${prefix}Exp">Explanation shown after answering</label><input id="${prefix}Exp" name="explanation" maxlength="300"></div>
      ${withImage ? `<div class="field"><label for="${prefix}Img">Image link (optional)</label><input id="${prefix}Img" name="imageUrl" type="url" placeholder="https://">
        <span class="hint">Shown above the question. Use an https link to an image PUNCH has rights to.</span></div>` : ''}`;
  }

  const questionBody = (f) => ({
    text: f.get('text'), options: [0, 1, 2, 3].map((i) => f.get('opt' + i)),
    answerIndex: Number(f.get('answer')), explanation: f.get('explanation'), imageUrl: f.get('imageUrl') || '',
  });

  /* ---------- Contribute ---------- */

  async function viewContribute() {
    if (!requireLogin()) return;
    loading();
    const [{ quizzes }, { submissions, points }] = await Promise.all([Api.get('/quizzes'), Api.get('/me/submissions')]);
    const statusLabel = { pending: 'Waiting for review', approved: 'Published', rejected: 'Not used' };
    main.innerHTML = `
      ${intro('Create', 'Contribute a question', `Write a question for one of the PUNCH desks. Our editors check every one, and if yours is published you earn ${points} points and the Contributor badge.`)}
      <div class="grid">
        <section>
          <form id="subForm" novalidate>
            ${questionFields(quizzes, 'sub')}
            <p class="form-error" id="subErr" role="alert"></p>
            <button class="btn" type="submit">Send for review</button>
          </form>
        </section>
        <aside>
          <h2 class="section-head">Your questions</h2>
          ${submissions.length
            ? `<ul class="subs">${submissions.map((s) => `<li><span class="status status--${s.status}">${statusLabel[s.status]}</span>
                <b>${esc(s.text)}</b><span class="hint">${esc(s.quiz)}</span></li>`).join('')}</ul>`
            : '<p class="hint">Questions you send appear here with their review status.</p>'}
          <h3 style="margin-top:2rem">What makes a good question</h3>
          <ul class="tips">
            <li>One clear right answer that a PUNCH NextGen student could know.</li>
            <li>Three wrong options that sound believable.</li>
            <li>A one-line explanation that teaches something.</li>
          </ul>
        </aside>
      </div>`;
    $('#subForm').onsubmit = async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button[type="submit"]');
      const f = new FormData(e.target);
      btn.disabled = true;
      try {
        await Api.post('/submissions', { quizId: Number(f.get('quiz')), ...questionBody(f) });
        toast('Thanks! Your question is waiting for review.');
        viewContribute();
      } catch (err) { $('#subErr').textContent = err.message; btn.disabled = false; }
    };
  }

  /* ---------- Admin ---------- */

  async function viewAdmin() {
    if (!requireLogin()) return;
    if (state.me.role !== 'admin') { main.innerHTML = '<div class="empty"><p>This page is for admins.</p></div>'; return; }
    loading();
    const [s, { quizzes }, { rewards }, { submissions }, { polls }] = await Promise.all([
      Api.get('/admin/stats'), Api.get('/admin/quizzes'), Api.get('/rewards'), Api.get('/admin/submissions'), Api.get('/admin/polls'),
    ]);
    main.innerHTML = `
      ${intro('Newsroom', 'Admin')}
      <div class="stats">
        <div class="stat"><b data-count="${s.users}">${fmt(s.users)}</b><span>Students</span></div>
        <div class="stat"><b data-count="${s.attempts}">${fmt(s.attempts)}</b><span>Quizzes completed</span></div>
        <div class="stat"><b data-count="${s.pointsIssued}">${fmt(s.pointsIssued)}</b><span>Points issued</span></div>
        <div class="stat"><b data-count="${s.redemptions}">${fmt(s.redemptions)}</b><span>Rewards redeemed</span></div>
        <div class="stat"><b data-count="${s.pendingSubmissions}">${fmt(s.pendingSubmissions)}</b><span>Questions to review</span></div>
      </div>

      <section class="admin-block">
        <h2 class="section-head">Student questions <small>${submissions.length} waiting</small></h2>
        ${submissions.length ? `<ul class="queue">${submissions.map((q) => `<li class="queue__item">
            <p class="quiz-item__meta">${esc(q.quiz)}, from ${esc(q.user)}</p>
            <b class="queue__q">${esc(q.text)}</b>
            <ol class="queue__opts">${q.options.map((o, i) => `<li class="${i === q.answer_index ? 'is-answer' : ''}">${esc(o)}${i === q.answer_index ? ' <small>correct</small>' : ''}</li>`).join('')}</ol>
            ${q.explanation ? `<p class="hint">${esc(q.explanation)}</p>` : ''}
            <div class="queue__actions">
              <button class="btn btn--small" data-approve="${q.id}">Approve and publish</button>
              <button class="btn btn--small btn--ghost" data-reject="${q.id}">Reject</button>
            </div></li>`).join('')}</ul>` : '<p class="hint">No questions waiting.</p>'}
      </section>

      <section class="admin-block">
        <h2 class="section-head">Quizzes</h2>
        <div class="table-wrap"><table class="table-stack"><thead><tr><th>Title</th><th>Desk</th><th class="num">Questions</th><th>Status</th><th><span class="skip">Action</span></th></tr></thead><tbody>
          ${quizzes.map((q) => `<tr><td>${esc(q.title)}</td><td data-label="Desk">${esc(q.category)}</td><td class="num" data-label="Questions">${q.question_count}</td>
            <td data-label="Status">${q.active ? 'Live' : 'Hidden'}</td>
            <td><button class="linkish" data-toggle="${q.id}" data-active="${q.active}">${q.active ? 'Hide' : 'Publish'}</button></td></tr>`).join('')}
        </tbody></table></div>
      </section>

      <div class="grid">
        <section class="admin-block">
          <h2 class="section-head">Add a question</h2>
          <form id="qForm" novalidate>
            ${questionFields(quizzes, 'q', true)}
            <p class="form-error" id="qErr" role="alert"></p>
            <button class="btn" type="submit">Add question</button>
          </form>
        </section>
        <aside class="admin-block">
          <h2 class="section-head">New quiz</h2>
          <form id="nqForm" novalidate>
            <div class="field"><label for="nqTitle">Title</label><input id="nqTitle" name="title" required></div>
            <div class="field"><label for="nqCat">Desk</label><select id="nqCat" name="category">${DESKS.map((c) => `<option>${c}</option>`).join('')}</select></div>
            <div class="field"><label for="nqDesc">Short description</label><input id="nqDesc" name="description"></div>
            <div class="row-2">
              <div class="field"><label for="nqSecs">Seconds per question</label><input id="nqSecs" name="secondsPerQuestion" type="number" value="20" min="5" max="120"></div>
              <div class="field"><label for="nqPts">Points per answer</label><input id="nqPts" name="pointsPerCorrect" type="number" value="10" min="1" max="100"></div>
            </div>
            <p class="form-error" id="nqErr" role="alert"></p>
            <button class="btn btn--ghost" type="submit">Create quiz</button>
            <p class="hint" style="margin-top:.5rem">A quiz appears to students once it has at least one question.</p>
          </form>
        </aside>
      </div>

      <div class="grid">
        <section class="admin-block">
          <h2 class="section-head">Polls</h2>
          ${polls.length ? `<div class="table-wrap"><table class="table-stack"><thead><tr><th>Question</th><th class="num">Votes</th><th>Status</th><th><span class="skip">Action</span></th></tr></thead><tbody>
            ${polls.map((p) => `<tr><td>${esc(p.question)}</td><td class="num" data-label="Votes">${fmt(p.votes)}</td><td data-label="Status">${p.active ? 'Live' : 'Closed'}</td>
              <td><button class="linkish" data-poll-toggle="${p.id}" data-active="${p.active}">${p.active ? 'Close' : 'Reopen'}</button></td></tr>`).join('')}
          </tbody></table></div>` : '<p class="hint">No polls yet.</p>'}
        </section>
        <aside class="admin-block">
          <h2 class="section-head">New poll</h2>
          <form id="pollForm" novalidate>
            <div class="field"><label for="pQ">Question</label><input id="pQ" name="question" maxlength="200" required></div>
            ${[0, 1, 2, 3].map((i) => `<div class="field"><label for="pO${i}">Option ${i + 1}${i > 1 ? ' (optional)' : ''}</label><input id="pO${i}" name="opt${i}" maxlength="80"></div>`).join('')}
            <p class="form-error" id="pErr" role="alert"></p>
            <button class="btn" type="submit">Publish poll</button>
            <p class="hint" style="margin-top:.5rem">Publishing a poll closes the one that’s live now.</p>
          </form>
        </aside>
      </div>

      <div class="grid">
        <section class="admin-block">
          <h2 class="section-head">Reward stock</h2>
          <div class="table-wrap"><table><thead><tr><th>Reward</th><th class="num">Cost</th><th>Stock</th></tr></thead><tbody>
            ${rewards.map((w) => `<tr><td>${esc(w.name)}</td><td class="num">${fmt(w.cost)}</td>
              <td><input type="number" min="0" value="${w.stock}" data-stock="${w.id}" aria-label="Stock for ${esc(w.name)}" class="input input--narrow"></td></tr>`).join('')}
          </tbody></table></div>
        </section>
        <aside class="admin-block">
          <h2 class="section-head">Recent redemptions</h2>
          ${s.recentRedemptions.length ? `<ul class="codes">${s.recentRedemptions.map((r) => `<li><span><b>${esc(r.reward)}</b><br><span class="hint">${esc(r.user)}</span></span><span class="code">${esc(r.code)}</span></li>`).join('')}</ul>` : '<p class="hint">None yet.</p>'}
        </aside>
      </div>`;
    countUp();

    const run = async (fn, okMsg) => {
      try { await fn(); toast(okMsg); viewAdmin(); } catch (err) { toast(err.message, true); }
    };
    main.querySelectorAll('[data-approve]').forEach((b) => {
      b.onclick = () => run(() => Api.post(`/admin/submissions/${b.dataset.approve}/approve`), 'Question published and student paid.');
    });
    main.querySelectorAll('[data-reject]').forEach((b) => {
      b.onclick = async () => {
        const ok = await modal({ title: 'Reject this question?', body: '<p>The student will see it as “Not used”. This can’t be undone.</p>', confirmLabel: 'Reject' });
        if (ok) run(() => Api.post(`/admin/submissions/${b.dataset.reject}/reject`), 'Question rejected.');
      };
    });
    main.querySelectorAll('[data-toggle]').forEach((b) => {
      b.onclick = () => run(() => Api.patch(`/admin/quizzes/${b.dataset.toggle}`, { active: b.dataset.active !== '1' }), 'Quiz updated.');
    });
    main.querySelectorAll('[data-poll-toggle]').forEach((b) => {
      b.onclick = () => run(() => Api.patch(`/admin/polls/${b.dataset.pollToggle}`, { active: b.dataset.active !== '1' }), 'Poll updated.');
    });
    main.querySelectorAll('[data-stock]').forEach((inp) => {
      inp.onchange = async () => {
        try { await Api.patch(`/admin/rewards/${inp.dataset.stock}`, { stock: Number(inp.value) }); toast('Stock updated.'); }
        catch (err) { toast(err.message, true); }
      };
    });
    $('#qForm').onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      try {
        await Api.post(`/admin/quizzes/${f.get('quiz')}/questions`, questionBody(f));
        toast('Question added.'); viewAdmin();
      } catch (err) { $('#qErr').textContent = err.message; }
    };
    $('#nqForm').onsubmit = async (e) => {
      e.preventDefault();
      try { await Api.post('/admin/quizzes', Object.fromEntries(new FormData(e.target))); toast('Quiz created. Add questions to publish it.'); viewAdmin(); }
      catch (err) { $('#nqErr').textContent = err.message; }
    };
    $('#pollForm').onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      try {
        await Api.post('/admin/polls', { question: f.get('question'), options: [0, 1, 2, 3].map((i) => f.get('opt' + i)) });
        toast('Poll published.'); viewAdmin();
      } catch (err) { $('#pErr').textContent = err.message; }
    };
  }

  /* ---------- Router ---------- */

  const routes = [
    [/^#?\/?$/, 'home', viewHome],
    [/^#\/login$/, null, () => viewAuth('login')],
    [/^#\/register$/, null, () => viewAuth('register')],
    [/^#\/quiz\/(\d+)$/, 'home', (m) => viewQuiz(m[1])],
    [/^#\/challenge$/, 'challenge', viewChallenge],
    [/^#\/explore$/, 'explore', viewExplore],
    [/^#\/rewards$/, 'rewards', viewRewards],
    [/^#\/leaderboard(?:\/(week))?$/, 'leaderboard', (m) => viewLeaderboard(m[1] === 'week' ? 'week' : 'all')],
    [/^#\/contribute$/, 'contribute', viewContribute],
    [/^#\/me$/, 'me', viewDashboard],
    [/^#\/admin$/, 'admin', viewAdmin],
  ];

  async function router() {
    if (cleanup) { cleanup(); cleanup = null; }
    const hash = location.hash || '#/';
    const match = routes.find(([re]) => re.test(hash)) || routes[0];
    document.querySelectorAll('#nav a, .tabbar a').forEach((a) => {
      if (a.dataset.route === match[1]) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    window.scrollTo(0, 0);
    try { await match[2](hash.match(match[0])); } catch (err) { failed(err); }
  }

  window.addEventListener('hashchange', router);
  window.addEventListener('auth:expired', () => { state.me = null; renderChrome(); toast('Your session has expired. Sign in again.', true); });

  // Show the official logo if public/assets/logo.png has been added
  const probe = new Image();
  probe.onload = () => { $('#brandLogo').hidden = false; $('#brandText').hidden = true; };
  probe.src = '/assets/logo.png';

  (async () => { await loadMe(); renderChrome(); router(); })();
})();
