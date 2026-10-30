export default function AssignmentSubmissionSetting({value, onChange}) {
  return <label style={{display: 'grid', gap: 6}}>
    <strong>Student submission</strong>
    <select value={value === false ? 'teacher' : 'student'} onChange={e => onChange(e.target.value !== 'teacher')} style={{padding: 10, font: 'inherit'}}>
      <option value="student">Student submission required</option>
      <option value="teacher">No submission required — teacher enters mark</option>
    </select>
    {value === false && <small>Enter a score out of Points Possible or a percentage in Speed Grading. Students see the saved mark and feedback without an upload request.</small>}
  </label>;
}
