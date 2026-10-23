# PUNCH NextGen: Quiz & Rewards Platform

A full-stack prototype where students play timed quizzes from the PUNCH desks and see right or wrong after every answer. They earn points and XP, unlock badges, climb leaderboards and redeem points for rewards. It's built around the NextGen pillars: **Learn, Play, Explore, Belong**.

**Stack:** React 18 (Vite) front end · Node.js + Express API · SQLite database.

- **Live demo:** https://punch-nextgen-quiz.onrender.com (free hosting: the first visit after a quiet spell can take 30–60 seconds to wake up)
- **Walkthrough video:** https://youtu.be/4vL77_LIYSM (4:57)

## Assessment checklist

Where each requirement in the brief is met:

| Brief | How it's met | Where |
|---|---|---|
| **1. Registration & dashboard** | Register and log in (bcrypt + JWT) | `server/routes/auth.js`, `client/src/pages/Auth.jsx` |
| | Dashboard with the student's name, **total XP**, points to spend, **quizzes completed**, **badges earned**, streak, rank, accuracy | `server/routes/me.js` (`/me/dashboard`), `client/src/pages/Dashboard.jsx` |
| **2. Quiz system** | 5 quizzes, each with a 12-question bank; every attempt **presents 10 multiple-choice questions** | `server/seedData.js` |
| | Questions are released **one at a time** by the server; select an answer (click or A–D), lock it, see feedback, then fetch the next | `server/routes/quizzes.js`, `client/src/pages/Play.jsx` |
| | **Scores calculated on the server** and **results shown** with a full review | `server/routes/quizzes.js` (`/submit`) |
| | **Attempts and answers saved** | `attempts`, `attempt_answers` tables |
| | **Repeat submissions can't earn duplicate rewards**: an attempt can only be submitted once (`409`), and quiz points are paid once per quiz per day | `quizzes.js`, tests |
| **3. Gamification** | Points and XP, 7 levels | `server/gamification.js` |
| | **12 badges** | `gamification.js` (`BADGES`) |
| | **Leaderboard** by points: all time and this week | `server/routes/leaderboard.js`, `client/src/pages/Leaderboard.jsx` |
| | Points, level, streak and badges **update automatically** when a quiz is submitted | `/submit` returns them; the UI shows a level-up or badge modal |
| **4. Back end, database & security** | Express + SQLite, with transactions for every points change | `server/` |
| | Authentication, and access control for students and admins | `server/middleware.js` |
| | Score calculation and reward allocation only on the server | `quizzes.js`, `rewards.js` |
| | Invalid and duplicate requests refused with clear errors | `tests/validation.test.js` |
| | Modular structure: one route file per area | `server/routes/` |
| **5. UX & docs** | Works on phones and desktops: phone tab bar, stacked tables, bottom-sheet dialogs | `client/src/styles.css`, `client/src/components/Layout.jsx` |
| | Clear feedback during the quiz: timer, progress bar, right/wrong with explanation, live score | `Play.jsx` (`Question` component) |
| | This README: technologies, setup, features, limitations, AI disclosure | |

## Technologies

| Layer | Choice | Why |
|---|---|---|
| Server | Node.js 18+, Express 4 | Small, well-known, easy to review |
| Database | SQLite via better-sqlite3 | No setup; real SQL with transactions and constraints; one file |
| Auth | bcryptjs, jsonwebtoken (7-day JWT) | Standard password hashing and stateless sessions |
| Security | Helmet (CSP and headers), express-rate-limit on login and registration | Sensible defaults with little code |
| Front end | React 18 with Vite, React Router 6, Context for auth and UI state | Component-based, widely used, fast dev server and a small production build |
| Styling | Hand-written CSS with design tokens; Google Fonts (Anton, Caveat, PT Serif, Roboto) | Matches the NextGen flyer and punchng.com |
| Tests | Node's built-in `node:test` and `fetch`, against an in-memory database | No test dependencies |

## Setup

Requires Node.js 18 or later.

```bash
git clone <your-repo-url> && cd punch-nextgen-quiz
npm install
cp .env.example .env        # set JWT_SECRET to a long random string
npm run build               # compiles the React app into client/dist
npm start                   # http://localhost:3000 (API + built React app)
```

For development, `npm run dev` runs the API on :3000 and the React dev server on **http://localhost:5173** (hot reload; `/api` calls are forwarded to :3000).

The database is created and seeded on first run. The seed includes 5 quizzes (60 questions), 6 rewards, a starter poll and four demo students, so the leaderboard isn't empty.

**Test accounts (all fictitious):**

| Account | Email | Password |
|---|---|---|
| Admin | admin@punchng.test | Admin@12345 |
| Demo student | adaeze.okafor@demo.test | Demo@12345 |

**Scripts:**

| Command | What it does |
|---|---|
| `npm run dev` | API (auto-restart) + React dev server with hot reload, at http://localhost:5173 |
| `npm run build` | Build the React app into `client/dist` for `npm start` |
| `npm start` | Serve the API and the built React app on port 3000 |
| `npm run seed` | Wipe all data and reseed |
| `npm test` | Run the 35 API tests against an in-memory database |

**Updating an older local database:** restarting adds any new tables and columns without losing data. To load the 12-question banks, run `npm run seed`; this wipes existing accounts and attempts.

**`EADDRINUSE: address already in use :::3000`** means something else, often an earlier copy of this app, is using the port. Either stop it, or set `PORT=3030` in `.env`.

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen | % { Get-Process -Id $_.OwningProcess }   # Windows
Stop-Process -Id <id>
```

On macOS or Linux, run `lsof -i :3000`, then `kill <pid>`.

## Features

### Students

| Page | What's there |
|---|---|
| Home `/` (Learn) | Today's challenge with a countdown, all quizzes, the live poll, top students |
| Daily challenge `/challenge` (Play) | One quiz a day worth double points |
| Desks `/explore` (Explore) | Quizzes grouped by desk, with progress in each |
| Leaderboard `/leaderboard`, `/leaderboard/week` (Belong) | Podium for the top 3, all-time or weekly ranking, your rank pinned at the bottom |
| Dashboard `/me` | XP and level bar, points, quizzes completed, badges, streak, rank, accuracy, recommended quiz, desk progress, points history |
| Quiz `/quiz/:id` | A "Before you start" rules screen (the timer only starts on **Start quiz**), then 10 timed questions with instant right/wrong and an explanation, a live score, and a standing notice that leaving mid-question counts it as missed; results with XP, level and a full review |
| Contribute `/contribute` | Suggest a question; an approved question earns 25 points |
| Rewards `/rewards` | Progress towards each reward, a confirm dialog, redemption codes |

**Points:**

| Action | Points |
|---|---|
| Sign up | 50 |
| Correct answer | 10 to 12, depending on the quiz |
| Correct answer in the daily challenge | 2× |
| Perfect round | +20 |
| Poll vote | 5 |
| Approved question | 25 |

Quiz points are paid once per quiz per day (West Africa Time); replays are practice.

**Levels:** XP is lifetime points earned, so spending points never lowers a level.

| Level | XP needed |
|---|---|
| Rookie | 0 |
| Learner | 100 |
| Explorer | 250 |
| Insider | 500 |
| Analyst | 1,000 |
| Editor | 2,000 |
| Legend | 4,000 |

**Badges:**

| Badge | How to earn it |
|---|---|
| First steps | Finish a quiz |
| Perfect round | Get every answer in a quiz right |
| Regular player | Finish 10 quizzes |
| On a roll | Play 3 days in a row |
| Week warrior | Play 7 days in a row |
| Desk hopper | Finish a quiz from every desk |
| Challenger | Complete a daily challenge |
| Rising star | Earn 500 XP |
| Headliner | Earn 1,000 XP |
| Voice of the people | Vote in a poll |
| Contributor | Have a question you wrote approved |
| Treat yourself | Redeem a reward |

### Admins (`/admin`)

- See platform stats.
- Approve or reject student questions.
- Create quizzes and add questions, with an optional https image link.
- Hide or publish quizzes.
- Run polls.
- Set reward stock and see recent redemptions.

## Engineering decisions

- **The server is the only authority on anything that affects points.** The browser never receives a correct answer before the student has locked their own. Scores, points, levels and badges are all worked out on the server inside a database transaction.
- **One question at a time.** The browser only ever holds the question being answered. `/start` returns question 1; `/next` releases the following question only after the current one is locked, and starts that question's timer on the server. Even with DevTools open, a student can't read ahead and look answers up.
- **Leaving can't be used to cheat.** Starting a quiz that has an unfinished attempt resumes it: same questions, same score. If the student left during an unanswered question, that question is **counted as missed** and they get the next one; leaving after answering just returns them to that answer's feedback. So stepping away to look an answer up, refreshing for a new timer, or restarting for easier questions all fail. Quiz cards show "Continue (N of 10 answered)".
- **Lock, then reveal.** Instant feedback needed the answer revealed per question without letting anyone change it afterwards. `/answer` writes the choice to `attempt_answers` first, and the primary key `(attempt_id, question_id)` makes the lock permanent. At submit time, locked answers override anything the client sends.
- **Two layers against duplicate rewards.**
  1. An attempt can only move from `in_progress` once; a second submit gets `409`.
  2. Points are paid only if no other attempt for that quiz has earned points the same WAT day.

  Both checks run inside the submit transaction.
- **Ledger plus balance.** Every point change goes through one `addPoints` helper that updates the balance and writes a `point_ledger` row, so balances can always be reconciled. Redemptions use conditional `UPDATE … WHERE stock > 0 AND points >= cost`, so stock can't go negative and points can't be double-spent.
- **XP is separate from spendable points.** XP is `lifetime_points`, so redeeming a reward never costs a student their level or all-time rank.
- **Badges are rules, not counters.** Each badge is a small function in `gamification.js` that checks the database. They're re-checked after every quiz, vote, redemption and approval and inserted with `INSERT OR IGNORE`, so adding a badge means writing one function.
- **Validation at the edge, consistent errors.** Each route checks and trims its input. A shared `HttpError` and error handler return `{ error }` with the right status (400, 401, 403, 404, 409, 429), and unexpected errors never leak details.
- **Modular routes.** One file per area in `server/routes/` (auth, me, quizzes, leaderboard, rewards, community, admin), sharing rules and helpers from `helpers.js`.
- **React structure.** Pages in `client/src/pages`, shared pieces in `components/`, and two contexts: `AuthContext` (the signed-in student, level, streak, quizzes rewarded today) and `UiContext` (toasts, and a promise-based `modal()` built on the native `<dialog>`). A small `useApi` hook loads page data. The quiz player is a `Question` component keyed by question number, so each question's timer, lock and feedback state starts fresh.
- **One deploy.** Vite builds the React app into `client/dist` and Express serves it, with every non-API path returning `index.html` for React Router. So it's one service and one URL, with no CORS to configure.
- **Schema changes without a migration tool.** Tables use `CREATE TABLE IF NOT EXISTS`, and new columns are added on startup by a small `addColumn` check, so an existing database upgrades itself.

## Integrity rules (enforced on the server)

- Questions are released one at a time, and correct answers are never sent before an answer is locked.
- Only the question currently showing can be answered (`409` otherwise), and the next is released only after it's answered.
- **A timer per question, kept by the server:** an answer that arrives after that question's seconds (plus 5 seconds of network grace) is recorded as "no answer".
- Each attempt is tied to the question IDs it was given; answers for other questions are refused. The score is calculated only from answers locked during play, and anything sent at submit time is ignored.
- **Leaving and coming back resumes the same attempt.** A question left unanswered is locked as "no answer" and the next question is released; a question already answered stays as it was. A fresh attempt is only possible once an abandoned one passes its overall time limit, and an expired attempt earns 0 points.
- One submission per attempt. Points are paid once per quiz per day.
- The daily challenge rotates by WAT date, and each attempt records whether it was a challenge when it started.
- One vote per poll. At most 5 student questions waiting for review per student, and they go live only after an admin approves them.
- Atomic redemptions and an audit ledger, as above.
- **Also:**
  - passwords hashed with bcrypt
  - JWTs expire after 7 days, and login and registration are rate-limited
  - Helmet headers with a strict script CSP
  - input length limits; React escapes all rendered text, and the app never uses `dangerouslySetInnerHTML`
  - images allowed only from `https:` sources

## Architecture

```
server/
  index.js            boot: seed on first run, listen
  app.js              Express app: security headers, JSON, static files, error handler
  db.js               SQLite schema and additive column migrations
  middleware.js       JWT auth (required and optional), admin guard, HttpError, WAT day helpers
  gamification.js     XP levels, streaks, badges, daily challenge, week boundaries
  routes/
    index.js          mounts each area under /api
    helpers.js        RULES (point values and limits), addPoints, input parsing, shared queries
    auth.js           register, login
    me.js             profile, dashboard, history, redemptions, my submissions
    quizzes.js        catalogue, start, lock answer, submit
    leaderboard.js    all time and weekly
    rewards.js        catalogue, redeem
    community.js      polls, student question submissions
    admin.js          stats, quizzes, questions, submissions review, polls, stock
  seed.js, seedData.js
client/                React front end (Vite)
  index.html          HTML shell and fonts
  src/
    main.jsx          routes (React Router) and providers
    api.js            fetch wrapper with token handling
    useApi.js         data-loading hook for pages
    utils.js          formatting, confetti, WAT countdown
    styles.css        design tokens, components, animations
    context/          AuthContext (student state), UiContext (toast, modal, celebrations)
    components/       Layout, PollCard, QuizCards, Board, QuestionFields, RequireAuth, common UI
    pages/            Home, Challenge, Explore, Auth, Play, Leaderboard, Rewards, Dashboard, Contribute, Admin
  public/assets/      put logo.png here
vite.config.mjs       Vite config: root client/, /api proxy for dev
tests/
  helpers.js          in-memory DB + server per test file
  api.test.js         features and rules (25 tests)
  validation.test.js  invalid, unauthorised and duplicate requests (10 tests)
```

### Data model

| Table | Holds |
|---|---|
| `users` | points balance, lifetime points (= XP), role |
| `quizzes` | desk, timer, points per answer, questions per attempt, active flag |
| `questions` | options as JSON, `answer_index` (server only), optional `image_url` |
| `attempts` | issued question IDs, deadline, status, score, points, `challenge` flag |
| `attempt_answers` | answers locked during play |
| `rewards`, `redemptions` | catalogue and stock; unique codes |
| `point_ledger` | every credit and debit |
| `user_badges` | badge id and when it was earned |
| `polls`, `poll_votes` | one vote per student per poll |
| `question_submissions` | `pending`, `approved` or `rejected` |

### API

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | /api/auth/register | | Create account (+50 pts) |
| POST | /api/auth/login | | Sign in |
| GET | /api/me | student | Profile, stats, rank, level, streak |
| GET | /api/me/dashboard | student | Everything the dashboard shows |
| GET | /api/me/history | student | Attempts and points ledger |
| GET | /api/me/redemptions | student | Your reward codes |
| GET | /api/me/submissions | student | Your suggested questions and their status |
| GET | /api/quizzes | | Live quizzes and today's challenge |
| GET | /api/quizzes/played-today | student | Quizzes already rewarded today |
| POST | /api/quizzes/:id/start | student | Start an attempt, or resume an unfinished one; returns the current question (no answer), position, score and time left |
| GET | /api/quizzes/in-progress | student | Unfinished attempts, for "Continue" buttons |
| POST | /api/attempts/:id/answer | student | Lock `{questionId, choice}` for the current question; returns right/wrong, answer, explanation |
| POST | /api/attempts/:id/next | student | Release the next question once the current one is answered |
| POST | /api/attempts/:id/submit | student | Finish; returns score, points, review, level, streak, new badges |
| GET | /api/leaderboard?period=week | optional | Top 10 all time (default) or this week, plus your rank |
| GET | /api/rewards | | Catalogue |
| POST | /api/rewards/:id/redeem | student | Redeem; returns code |
| GET | /api/polls/current | optional | Live poll, results and your vote |
| POST | /api/polls/:id/vote | student | Vote once (+5 pts) |
| POST | /api/submissions | student | Suggest a question |
| GET | /api/admin/stats | admin | Platform stats |
| GET/POST | /api/admin/quizzes | admin | List or create quizzes |
| PATCH | /api/admin/quizzes/:id | admin | Publish or hide |
| GET/POST | /api/admin/quizzes/:id/questions | admin | List or add questions |
| DELETE | /api/admin/questions/:id | admin | Remove a question |
| PATCH | /api/admin/rewards/:id | admin | Set stock |
| GET | /api/admin/submissions | admin | Questions waiting for review |
| POST | /api/admin/submissions/:id/approve | admin | Publish (+25 pts to the student) |
| POST | /api/admin/submissions/:id/reject | admin | Reject |
| GET/POST | /api/admin/polls | admin | List polls, or publish one (closes the current poll) |
| PATCH | /api/admin/polls/:id | admin | Close or reopen a poll |

"optional" means the route works signed out and adds your own rank or vote when you're signed in. Errors are always `{ "error": "message" }`.

## Testing

`npm test` runs 35 integration tests. Each test file starts the real Express app on a random port with a fresh in-memory database.

**Features and rules** (`tests/api.test.js`):
- every quiz presents 10 four-option questions
- `/start` sends only the current question and never an answer; questions can't be answered early, skipped, or after their time
- leaving mid-question counts that question as missed and moves on; leaving after answering keeps the answer
- perfect-score bonus, and points once per day
- a second submit gets `409`, and late submissions earn nothing
- locked answers can't be changed, and only locked answers are scored
- badges, the dashboard, the double-points challenge
- polls, student submissions, the weekly leaderboard
- atomic redemptions

**Invalid requests** (`tests/validation.test.js`):
- missing or forged tokens (`401`), and students on admin routes (`403`)
- registration validation, and malformed JSON
- other students' attempts (`404`)
- answering after submitting (`409`), and junk answer payloads
- bad poll votes and bad submissions, and the 5-pending limit (`429`)
- admin input validation

## Design

The look comes from the PUNCH NextGen flyer, in PUNCH's own colours:
- **Colours:** logo red `#FF0000` as the main colour, black and white, and the logo's stripe colours as small accents.
- **Type:** Anton for poster headlines, Caveat for handwritten accents, PT Serif for story headlines, Roboto for interface text.
- **Flyer touches:** slanted section tabs, a "Daily challenge" ribbon, and the Learn / Play / Explore / Belong icon row.
- **Logo:** put the official logo at `client/public/assets/logo.png` and it replaces the text badge.

The app is responsive down to 360 px, with keyboard focus always visible. Motion (rise-ins, right/wrong animations, count-ups, confetti, badge modals) is switched off for anyone who sets reduce-motion on their device.

## Limitations and incomplete features

- **A student can still try to look up the one question on screen** within its 15–20 second timer. That's inherent to any timed online quiz; the per-question timer is the defence.
- **Seeing your own password in DevTools is expected.** Your browser shows what you typed. Over the network it's protected by HTTPS, it's stored as a bcrypt hash, and login is rate-limited. Encrypting payloads in the browser wouldn't add protection, because the key would have to ship to the browser too.
- **SQLite and a single server.** That's fine for a prototype, but a production deployment would use Postgres and versioned migrations. On free hosts without a persistent disk, the demo database resets on each deploy.
- **No password reset, email verification or account deletion.** JWTs sit in `localStorage` with no refresh tokens or server-side logout.
- **Admin tools are basic.** Questions can be added and deleted through the API, but there's no edit screen. Question images are links, not uploads.
- **Reward fulfilment isn't implemented.** Codes are generated and stored, but nothing sends airtime or E-Paper access.
- **Streaks and the weekly board use West Africa Time only.**
- **No end-to-end tests in the repo.** The API is covered by integration tests. The React UI was checked by clicking through every page, as a student and as an admin, in headless Chrome at desktop (1280px) and phone (390px) widths. That run had no JavaScript errors, but the script isn't part of `npm test`.
- **No front-end unit tests** (for example React Testing Library).
- **The question bank is fixed.** There are 60 seeded questions in total. Admins and students can add more, but nothing pulls questions from PUNCH articles yet.

## Use of AI tools

This project was built with **Claude Code** (Anthropic) as an AI assistant, which the brief allows with disclosure.

I treated the AI like a fast junior developer that I was directing. I owned the requirements and the decisions:
- what to build from the brief;
- the design direction, from the NextGen flyer and my own previous app;
- keeping PUNCH's brand;
- switching the front end to React, because it's what I work in.

I guided the AI as it wrote the code. That meant setting the structure and the order of work, reviewing each change, and testing it in the browser. I sent back problems and corrections, and checked everything against each task in the brief.

I've gone through the codebase module by module, so I can explain any part of it, for example how duplicate rewards are prevented.

## Deploying (Render, free tier)

1. Push to GitHub.
2. On render.com: New → Web Service → connect the repo.
3. Build command `npm install --include=dev && npm run build`, start command `npm start`. The repo's `render.yaml` sets this up for you (New → Blueprint).
4. Environment: `NODE_ENV=production`, `JWT_SECRET=<long random string>`, optionally `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
5. For data that survives redeploys, add a persistent disk mounted at `/var/data` and set `DB_PATH=/var/data/nextgen.db`. Without one, the app reseeds on each deploy, which is fine for a demo.

Railway and Fly.io work the same way. Serverless hosts like Vercel aren't a good fit for SQLite.

## With more time

- Postgres with versioned migrations.
- httpOnly cookie sessions with refresh tokens.
- Password reset.
- Admin screens for editing questions, with image uploads.
- Question banks drawn from PUNCH articles.
- Email delivery of reward codes.
- Notifications when a submitted question is reviewed.
- Playwright end-to-end tests and React Testing Library component tests.
