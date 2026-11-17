import {useId} from 'react';
import {canTryScore} from '../../services/whatIfGrades.js';
import './StudentWhatIfGrades.css';

export function StudentWhatIfControls({open,onToggle,onReset,result,standing,disabled}) {
  const id=useId();
  return <section className="student-what-if" aria-label="What-if course grades">
    <div className="student-what-if-heading"><span><strong>Current course grade:</strong> {standing}</span><button type="button" disabled={disabled} aria-expanded={open} aria-controls={id} onClick={onToggle}>What-if grades</button></div>
    <div id={id} className="student-what-if-bar" hidden={!open}>
      <span aria-live="polite"><strong>What-if course grade: {result.percent==null?'—':`${result.percent.toFixed(2)}%`}</strong>{result.incomplete?' Reload this course to load the full grading details.':Object.keys(result.errors).length?' Check the highlighted score.':!result.eligibleCount?' No unfinished weighted assignments are available to try.':' Practice only. Recorded marks stay unchanged.'}</span>
      <div className="student-what-if-actions"><button type="button" onClick={onReset}>Reset</button><button type="button" onClick={onToggle}>Close</button></div>
    </div>
  </section>;
}
export function StudentWhatIfScore({assignment,state,value,onChange,error}) {
  const id=useId();
  if(!canTryScore(assignment,state))return null;
  const total=Number(assignment.points_possible)>0?Number(assignment.points_possible):100;
  return <div className="student-what-if-score"><label htmlFor={id}>Try a score</label><input id={id} type="number" inputMode="decimal" step="any" min="0" max={total} value={value??''} onChange={e=>onChange(e.target.value)} aria-label={`What-if score for ${assignment.title || 'assignment'}`} aria-invalid={Boolean(error)} aria-describedby={error?`${id}-error`:undefined}/><span>/ {total}</span>{error&&<span id={`${id}-error`} role="alert" className="student-what-if-error">{error}</span>}</div>;
}
