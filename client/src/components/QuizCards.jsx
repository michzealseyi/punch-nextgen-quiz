import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { fmt } from '../utils.js';
import { Countdown } from './common.jsx';

const quizPoints = (q, challengeId, mult) => q.question_count * q.points_per_correct * (q.id === challengeId ? mult : 1);

// The button text for a quiz: continue an unfinished attempt, practise one already rewarded today, or play
function useQuizAction(q, points) {
  const { playedToday, inProgress } = useAuth();
  const open = inProgress.get(q.id);
  if (open) return { label: `Continue (${open.answered} of ${open.total} answered)`, ghost: false, done: false };
  const done = playedToday.has(q.id);
  return { label: done ? 'Practise' : `Play for ${fmt(points)} pts`, ghost: done, done };
}

export function QuizItem({ q, challengeId, mult }) {
  const action = useQuizAction(q, quizPoints(q, challengeId, mult));
  return (
    <li className="quiz-item">
      <div>
        <div className="quiz-item__meta">
          {q.category}, {q.question_count} questions, {q.seconds_per_question}s each{' '}
          {q.id === challengeId && <span className="tag tag--hot">{mult}× today</span>}
        </div>
        <h3>{q.title}</h3>
        <p>{q.description}</p>
      </div>
      <div className="quiz-item__action">
        <Link className={'btn' + (action.ghost ? ' btn--ghost' : '')} to={`/quiz/${q.id}`}>{action.label}</Link>
        {action.done && <span className="quiz-item__done">Points earned today</span>}
      </div>
    </li>
  );
}

export function ChallengeCard({ quiz, mult }) {
  const action = useQuizAction(quiz || { id: null }, quiz ? quizPoints(quiz, quiz.id, mult) : 0);
  if (!quiz) return null;
  return (
    <article className="challenge">
      <span className="ribbon">Daily challenge · {mult}× points</span>
      <p className="challenge__meta">{quiz.category} · {quiz.question_count} questions · {quiz.seconds_per_question}s each</p>
      <h2 className="challenge__title">{quiz.title}</h2>
      <p className="challenge__desc">{quiz.description}</p>
      <div className="challenge__foot">
        <span className="countdown"><small>New challenge in</small><Countdown /></span>
        <Link className="btn" to={`/quiz/${quiz.id}`}>{action.label}</Link>
      </div>
      {action.done && <p className="challenge__done">Done today. A new challenge lands at midnight.</p>}
    </article>
  );
}
