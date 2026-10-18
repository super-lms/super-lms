function normalizeName(value) {
  return String(value || '').normalize('NFKC').toLocaleLowerCase('en').replace(/[^\p{L}\p{N}]/gu, '');
}
function previewStudentIds(rows, users) {
  if (!Array.isArray(rows) || !rows.length || rows.length > 2000) throw new Error('Supply between 1 and 2000 name and student ID pairs.');
  const names = new Map(), ids = new Map();
  for (const row of rows) {
    const name = normalizeName(row.name), id = String(row.student_id || '').trim();
    names.set(name, (names.get(name) || 0) + 1); ids.set(id, (ids.get(id) || 0) + 1);
  }
  return rows.map(row => {
    const name = String(row.name || '').trim(), id = String(row.student_id || '').trim();
    const matches = users.filter(user => user.role === 'student' && normalizeName(user.name) === normalizeName(name));
    const user = matches.length === 1 ? matches[0] : null;
    const current = String(user?.student_id || '').trim();
    let issue = '';
    if (!normalizeName(name) || !/^\d{6}$/.test(id)) issue = 'A full student name and six-digit Student ID are required (not the nine-digit PEN).';
    else if (names.get(normalizeName(name)) > 1 || ids.get(id) > 1) issue = 'Duplicate name or Student ID in the import.';
    else if (!user) issue = matches.length ? 'More than one student account has this name.' : 'No exact full-name match. Review spelling or account name.';
    else if (users.some(other => other.id !== user.id && String(other.student_id || '').trim() === id)) issue = 'This Student ID is already assigned to a different account.';
    else if (/^\d{6}$/.test(current) && current !== id) issue = 'The account already has a different six-digit ID. Review manually.';
    return {source_name:name,student_id:id,user_id:user?.id || null,name:user?.name || '',email:user?.email || '',previous_id:current,
      status:issue ? 'Review' : current === id ? 'Already set' : 'Ready',issue};
  });
}
function readySnapshot(preview) {
  return preview.filter(row => row.status === 'Ready').map(({user_id,student_id,previous_id})=>({user_id,student_id,previous_id}));
}
module.exports = {normalizeName,previewStudentIds,readySnapshot};
