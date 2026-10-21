// Question form fields shared by Contribute (students) and Admin
import { KEYS } from '../utils.js';

export function QuestionFields({ quizzes, prefix, withImage = false }) {
  return (
    <>
      <div className="field">
        <label htmlFor={`${prefix}Quiz`}>Quiz</label>
        <select id={`${prefix}Quiz`} name="quiz">
          {quizzes.map((q) => <option key={q.id} value={q.id}>{q.title} ({q.category})</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`${prefix}Text`}>Question</label>
        <textarea id={`${prefix}Text`} name="text" rows={2} maxLength={300} required />
      </div>
      <fieldset className="field options-set">
        <legend className="hint">Options. Select the correct one.</legend>
        {KEYS.map((k, i) => (
          <div className="radio-row" key={k}>
            <input type="radio" name="answer" value={i} defaultChecked={i === 0} aria-label={`Option ${k} is correct`} />
            <input type="text" name={`opt${i}`} placeholder={`Option ${k}`} aria-label={`Option ${k}`} maxLength={120} required />
          </div>
        ))}
      </fieldset>
      <div className="field">
        <label htmlFor={`${prefix}Exp`}>Explanation shown after answering</label>
        <input id={`${prefix}Exp`} name="explanation" maxLength={300} />
      </div>
      {withImage && (
        <div className="field">
          <label htmlFor={`${prefix}Img`}>Image link (optional)</label>
          <input id={`${prefix}Img`} name="imageUrl" type="url" placeholder="https://" />
          <span className="hint">Shown above the question. Use an https link to an image PUNCH has rights to.</span>
        </div>
      )}
    </>
  );
}

// Turns the submitted form into the API body
export const questionBody = (form) => {
  const f = new FormData(form);
  return {
    quizId: Number(f.get('quiz')),
    text: f.get('text'),
    options: [0, 1, 2, 3].map((i) => f.get('opt' + i)),
    answerIndex: Number(f.get('answer')),
    explanation: f.get('explanation'),
    imageUrl: f.get('imageUrl') || '',
  };
};
