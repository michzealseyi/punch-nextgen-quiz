# Video walkthrough script (5 minutes maximum)

The brief allows **at most five minutes** and asks you to **explain your personal contributions**. Timings add up to 4:45, leaving a little slack. Practise once with a timer.

**Before recording:**
- Run `npm run seed`, then `npm start`, or use the live demo.
- Open two windows: one signed out, one signed in as admin (admin@punchng.test / Admin@12345).
- Open DevTools → Network in the student window.
- Close other tabs and notifications.

---

**1. Intro — 0:00 to 0:20**
- "I'm [name]. This is a mini PUNCH NextGen quiz and rewards platform."
- "It uses Node, Express, SQLite and a vanilla JavaScript front end, with no build step."
- "I'll go through the five tasks in order, then explain how I built it."

**2. Task 1: registration and dashboard — 0:20 to 1:00**
- Register a new student and point out the 50-point welcome bonus in the header.
- Open the **Dashboard**: name, total XP, points, **quizzes completed**, **badges earned**, streak and rank.
- Narrow the window briefly to phone width to show the bottom tab bar (this also covers Task 5).

**3. Task 2: the quiz — 1:00 to 2:15**
- From Home, start the **daily challenge** and point out the 2× ribbon.
- Show **"Question 1 of 10"**, the timer and the stripe progress bar.
- Answer a few questions: show a correct one (green and the explanation) and a wrong one (red shake and the right answer). Use the A–D keys once.
- Answer the rest quickly and submit. Show the **results**: score, points counting up, XP bar, review list, then the badge modal.
- Go back to the Dashboard: quizzes completed is now 1 and the badges have updated.

**4. Task 4: security and duplicates — 2:15 to 3:00**
- In Network, open `/start`: "No correct answers are sent to the browser."
- Open an `/answer` call: "The answer is locked first, then revealed, and it can't be changed."
- Replay the same quiz: the button says **Practise** and the results say points were already earned today.
- "A second submit of the same attempt returns 409. Scoring and rewards only happen on the server, inside a transaction."

**5. Task 3: gamification — 3:00 to 3:30**
- Leaderboard: the podium and the **This week** tab, plus your rank at the bottom.
- "XP and badges update automatically when you submit. There are 12 badges, defined as rules in `gamification.js`."

**6. Code and tests — 3:30 to 4:15**
- Show the `server/routes/` folder: "One file per area."
- In `quizzes.js`, the submit transaction: locked answers, the once-per-day check, `addPoints`.
- Run `npm test`: "27 tests, including a whole file for invalid and duplicate requests."

**7. My contributions and AI use — 4:15 to 4:45**
- Say this in your own words, and make sure it matches the README's "Use of AI tools" section.
- For example: "I used Claude Code as an AI pair programmer, as the brief allows. I [set the requirements, chose the features and the NextGen design direction, reviewed and tested each change in the browser, directed fixes, checked the quiz facts and deployed it]. Most of the code was generated with AI, and I've reviewed it and can explain any part, for example how duplicate rewards are prevented."
- Close: "Limitations and next steps are in the README. Thanks for watching."

---

**If you're running long:** cut the phone-width view and the leaderboard tab switch first. Don't cut the duplicate-submission demo or the contributions section, because both are marked.
