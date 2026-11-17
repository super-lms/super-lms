export const hasRecordedScore = submission => submission?.score !== null && submission?.score !== undefined && submission?.score !== '' && Number.isFinite(Number(submission.score));
export function whatIfWeight(assignment) {
  const direct = assignment.course_weight_percent;
  return direct !== null && direct !== undefined && direct !== '' ? Number(direct) : Number(assignment.category_weight_percent) * Number(assignment.weight_percent_of_parent) / 100;
}
export function canTryScore(assignment, state) {
  const submission=state?.submission;
  const unfinished=!hasRecordedScore(submission) || submission?.rubric_selection?.notSubmitted === true;
  return Boolean(assignment.subcategory_id) && whatIfWeight(assignment) > 0 && Number.isFinite(whatIfWeight(assignment)) && unfinished && submission?.rubric_selection?.excused !== true;
}
export function whatIfGrades(assignments, states, drafts, gradebook) {
  const groups = new Map();
  const authoritative = Array.isArray(gradebook?.group_breakdown) && gradebook.group_breakdown.every(g => g.subcategory_id != null && Number.isFinite(Number(g.score_total)) && Number(g.graded_count) > 0);
  if (authoritative) {
    for (const g of gradebook.group_breakdown) groups.set(String(g.subcategory_id), {weight:Number(g.course_weight_percent),total:Number(g.score_total),count:Number(g.graded_count)});
  } else {
    for (const a of assignments) {
      const s=states[String(a.id)]?.submission,weight=whatIfWeight(a);
      if (!a.subcategory_id || !hasRecordedScore(s) || s.rubric_selection?.excused === true || !(weight > 0)) continue;
      const key=String(a.subcategory_id),g=groups.get(key)||{weight,total:0,count:0};g.total+=Number(s.score);g.count++;groups.set(key,g);
    }
  }
  const calculate=()=>{let total=0,weight=0;for(const g of groups.values()){if(g.count&&g.weight>0){total+=g.total/g.count*g.weight;weight+=g.weight;}}return weight?Number((total/weight).toFixed(2)):null;};
  const base=calculate(),errors={};let count=0;
  const saved=gradebook?.current_percent;
  const incomplete=Boolean(gradebook) && !authoritative || saved!=null && (base==null || Math.abs(base-Number(saved))>0.02);
  for(const a of assignments){
    if(!canTryScore(a,states[String(a.id)]))continue;
    const raw=drafts[String(a.id)];if(raw==null||String(raw).trim()==='')continue;
    const possible=Number(a.points_possible)>0?Number(a.points_possible):100,points=Number(raw);
    if(!Number.isFinite(points)||points<0||points>possible){errors[String(a.id)]=`Enter 0 to ${possible}.`;continue;}
    const key=String(a.subcategory_id),g=groups.get(key)||{weight:whatIfWeight(a),total:0,count:0};
    // A teacher may have recorded a zero for explicitly missing work. Replace
    // that mark only in this local calculation rather than adding another mark.
    const recorded=states[String(a.id)]?.submission;
    if(hasRecordedScore(recorded) && g.count>0){g.total-=Number(recorded.score);g.count--;}
    g.total+=points/possible*100;g.count++;groups.set(key,g);count++;
  }
  return {percent:incomplete||Object.keys(errors).length?null:calculate(),count,errors,incomplete,eligibleCount:assignments.filter(a=>canTryScore(a,states[String(a.id)])).length};
}
