export const frequencyLabels = ['Never', 'Almost Never', 'Sometimes', 'Most of the times', 'Always'];
export function changeQuestionType(q, type) {
  return {...q, type, issues: [], answerKey: '',
    ...(type === 'Rating' && !q.ratingLabels?.some(x => x.trim()) ? {ratingLabels:[...frequencyLabels]} : {}),
    ...(['Multiple Choice','Ranking'].includes(type) && !q.options?.some(x => x.trim()) ? {options:[...frequencyLabels]} : {})};
}
export function applyFrequency(questions, type) {
  return questions.map(q => ({...changeQuestionType(q,type), ...(type==='Rating'?{ratingLabels:[...frequencyLabels]}:{options:[...frequencyLabels]})}));
}
export function checkBuilder(title, questions) {
  if (!title.trim()) throw Error('Survey not saved: enter a title.');
  if (!questions.length) throw Error('Survey not saved: add at least one question.');
  questions.forEach((q,i) => {
    const prefix=`Survey not saved — Question ${i+1}`;
    if (!q.title?.trim()) throw Error(`${prefix}: enter the question text.`);
    if (['Multiple Choice','Image Choice','Matching','Ranking','Form','Essay matching'].includes(q.type)) {
      const options=(q.options||[]).map(x=>x.trim()).filter(Boolean);
      if (!options.length || new Set(options).size!==options.length) throw Error(`${prefix}: enter unique options or row labels, one per line.`);
    }
  });
}
