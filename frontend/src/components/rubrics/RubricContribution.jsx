import { calculateTeacherRubric } from '../../services/teacherRubricScoring.js';
import './RubricContribution.css';

export function RubricContribution({ result, levelCount }) {
  const hasScore = result?.contribution !== null && Number.isFinite(result?.contribution);
  return <aside className="rubric-contribution" aria-label="Criterion weighted contribution">
    <strong>Contribution to total</strong>
    <output>{hasScore ? `${result.contribution.toFixed(2)}%` : '—'}</output>
    <span>{hasScore ? `${result.level} ÷ ${levelCount} × ${result.weight}% = ${result.contribution.toFixed(2)}%` : 'No level selected'}</span>
    {hasScore && <small>Percentage points of the rubric total</small>}
  </aside>;
}

export default function SavedTeacherRubric({ rubric, overallPercent }) {
  if (!rubric?.criteria_json?.length || !rubric.selections) return null;
  let calculation;
  try { calculation = calculateTeacherRubric(rubric, rubric.selections); }
  catch { return <section><h3>Saved teacher rubric</h3><p>The detailed calculation is unavailable for this saved rubric. Your saved overall grade remains unchanged.</p></section>; }
  const saved = Number(overallPercent);
  const different = calculation.complete && Number.isFinite(saved) && Math.abs(saved - calculation.percent) > 0.01;
  return <section className="saved-teacher-rubric">
    <h3>{rubric.title || 'Teacher-designed rubric'}</h3>
    <p>Your teacher’s saved selections. Each contribution is selected level ÷ maximum level × criterion weight.</p>
    {rubric.criteria_json.map(criterion => <div key={criterion.id} className="saved-rubric-criterion">
      <strong>{criterion.name} — {criterion.weight}%</strong>
      <div className="rubric-criterion-row">
        <div className="rubric-levels">{Array.from({ length: rubric.level_count }, (_, index) => index + 1).map(position =>
          <div key={position} className={`saved-rubric-level${Number(rubric.selections[criterion.id]) === position ? ' selected' : ''}`}>
            <strong>{criterion.level_labels?.[position - 1] || `Level ${position}`}</strong>
            <p>{criterion.descriptors?.[`level_${position}`] || ''}</p>
            {Number(rubric.selections[criterion.id]) === position && <small>Teacher selected</small>}
          </div>)}</div>
        <RubricContribution result={calculation.criterionResults.find(item => item.id === String(criterion.id))} levelCount={rubric.level_count} />
      </div>
    </div>)}
    <p className="rubric-total"><strong>Saved overall grade: {Number.isFinite(saved) ? `${saved.toFixed(2)}%` : 'Not graded'}</strong></p>
    {different && <p role="status">The displayed numbered levels calculate to {calculation.percent.toFixed(2)}%. This older saved grade needs teacher review because its level labels were scored by column position. The saved grade above has not been changed.</p>}
  </section>;
}
