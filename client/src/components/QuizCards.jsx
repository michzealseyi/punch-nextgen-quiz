import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { fmt } from '../utils.js';
import { Countdown } from './common.jsx';

const quizPoints = (q, challengeId, mult) => q.question_count * q.points_per_correct * (q.id === challengeId ? mult : 1);

export function QuizItem({ q, challengeId, mult }) {
  const { playedToday } = useAuth();
  const done = playedToday.has(q.id);
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
        <Link className={'btn' + (done ? ' btn--ghost' : '')} to={`/quiz/${q.id}`}>
          {done ? 'Practise' : `Play for ${fmt(quizPoints(q, challengeId, mult))} pts`}
        </Link>
        {done && <span className="quiz-item__done">Points earned today</span>}
      </div>
    </li>
  );
}

export function ChallengeCard({ quiz, mult }) {
  const { playedToday } = useAuth();
  if (!quiz) return null;
  const done = playedToday.has(quiz.id);
  return (
    <article className="challenge">
      <span className="ribbon">Daily challenge · {mult}× points</span>
      <p className="challenge__meta">{quiz.category} · {quiz.question_count} questions · {quiz.seconds_per_question}s each</p>
      <h2 className="challenge__title">{quiz.title}</h2>
      <p className="challenge__desc">{quiz.description}</p>
      <div className="challenge__foot">
        <span className="countdown"><small>New challenge in</small><Countdown /></span>
        <Link className="btn" to={`/quiz/${quiz.id}`}>{done ? 'Practise' : `Play for ${fmt(quizPoints(quiz, quiz.id, mult))} pts`}</Link>
      </div>
      {done && <p className="challenge__done">Done today. A new challenge lands at midnight.</p>}
    </article>
  );
}
