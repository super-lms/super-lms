import { useEffect, useState } from 'react';
import authFetch from '../../services/authFetch';
import './RubricContribution.css';

export default function StudentAssignmentRubric({ assignmentId }) {
  const [state, setState] = useState({ loading: true });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setState({ loading: true });
    async function load() {
      try {
        const response = await authFetch(`/api/assignments/${assignmentId}/student-rubric`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to load the rubric.');
        if (!cancelled) setState({ rubric: data.rubric });
      } catch (error) {
        if (!cancelled) setState({ error: error.message || 'Unable to load the rubric.' });
      }
    }
    load();
    return () => { cancelled = true; };
  }, [assignmentId, attempt]);

  return <section className="saved-teacher-rubric" aria-label="Assignment rubric">
    <h3>Rubric</h3>
    {state.loading ? <p role="status">Loading rubric...</p> : state.error ?
      <div role="alert"><p>{state.error}</p><button type="button" onClick={() => setAttempt(value => value + 1)}>Retry loading rubric</button></div> :
      !state.rubric?.criteria_json?.length ? <p>No teacher-created rubric has been posted for this assignment.</p> : <>
        <h4>{state.rubric.title || 'How your work will be graded'}</h4>
        <p>Review these criteria before starting. Each percentage shows how much that criterion counts toward your rubric grade. Your teacher will select a level for each criterion.</p>
        {state.rubric.criteria_json.map((criterion, index) => <div key={criterion.id || index} className="saved-rubric-criterion">
          <strong>{criterion.name} — {criterion.weight}% of the rubric grade</strong>
          <div className="rubric-levels" style={{ marginTop: 10 }}>
            {Array.from({ length: state.rubric.level_count }, (_, level) => <div key={level} className="saved-rubric-level">
              <strong>{criterion.level_labels?.[level] || `Level ${level + 1}`}</strong>
              <p>{criterion.descriptors?.[`level_${level + 1}`] || ''}</p>
            </div>)}
          </div>
        </div>)}
        <p>Each criterion contributes selected level ÷ maximum level × its percentage weight to the rubric grade.</p>
      </>}
  </section>;
}
