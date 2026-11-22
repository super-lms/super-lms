export default function StudentGradeCalculation({student, groups = []}) {
  if (!student) return <p>Select a student to see their calculation.</p>;
  const graded = student.group_breakdown || [];
  const rows = groups.map(group => ({...group, result: graded.find(item => String(item.subcategory_id) === String(group.subcategory_id))}));
  for (const result of graded) if (!rows.some(row => String(row.subcategory_id) === String(result.subcategory_id))) rows.push({...result,result});
  const number = value => Number(value || 0).toFixed(2);
  return <section aria-label="How this grade is calculated">
    <h3>How this grade is calculated — {student.student_name}</h3>
    <p>Each pathway and evidence tier uses the average of its graded assignment percentages. Its course weight is counted once. Blank and excused marks are excluded; a recorded zero counts.</p>
    <div className="table-wrap"><table><thead><tr><th>Learning pathway</th><th>Evidence tier</th><th>Average</th><th>Course weight</th><th>Weighted contribution</th><th>Included?</th></tr></thead>
    <tbody>{rows.map(row => <tr key={row.subcategory_id}><td>{row.category_name || 'Unlinked'}</td><td>{row.subcategory_name || 'Unlinked'}</td><td>{row.result ? `${number(row.result.average_score)}%` : 'No graded evidence'}</td><td>{number(row.course_weight_percent)}%</td><td>{row.result ? `${number(row.result.average_score)} × ${number(row.result.course_weight_percent)} ÷ 100 = ${number(row.result.earned_course_points)}` : '—'}</td><td>{row.result ? 'Yes' : 'Excluded for now'}</td></tr>)}</tbody></table></div>
    {Number(student.graded_weight_percent) > 0 ? <p><strong>Current course mark: {number(student.earned_course_points)} earned course points ÷ {number(student.graded_weight_percent)} graded weight × 100 = {number(student.current_percent)}%</strong></p> : <p>No weighted evidence has been graded yet.</p>}
    <p>Ungraded pathways do not count as zero. The current mark changes when a new pathway or tier receives its first grade. Displayed contributions are rounded to two decimals, matching the gradebook.</p>
  </section>;
}
