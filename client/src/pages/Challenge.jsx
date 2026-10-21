import { api } from '../api.js';
import { ErrorState, Intro, Skeleton } from '../components/common.jsx';
import { ChallengeCard } from '../components/QuizCards.jsx';
import { useApi } from '../useApi.js';

export default function Challenge() {
  const { data, error } = useApi(() => api.get('/quizzes'), []);
  if (error) return <ErrorState error={error} />;
  if (!data) return <Skeleton />;

  const { quizzes, challengeId, challengeMultiplier: mult } = data;
  const quiz = quizzes.find((q) => q.id === challengeId);
  return (
    <>
      <Intro pillar="Play" title="Daily challenge">
        One quiz a day pays {mult}× points. It changes at midnight West Africa Time, so tap in before it’s gone.
      </Intro>
      {quiz ? <ChallengeCard quiz={quiz} mult={mult} /> : <div className="empty"><p>No challenge today. Check back soon.</p></div>}
      <h2 className="section-head">How it works</h2>
      <ol className="steps">
        <li><b>Beat the clock.</b> Every question has its own timer.</li>
        <li><b>Find out straight away.</b> Each answer shows if you were right, with a short explanation.</li>
        <li><b>Score {mult}×.</b> Correct answers pay {mult}× the usual points, plus a 20-point bonus for a perfect round.</li>
      </ol>
    </>
  );
}
