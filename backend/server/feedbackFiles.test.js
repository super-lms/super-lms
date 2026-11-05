const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createFeedbackFiles, MAX_FEEDBACK_FILE_BYTES } = require('./feedbackFiles');
function fixture({ member = true, published = true, school = true } = {}) {
  const records = [], calls = [];
  const pool = { query: async (sql, params = []) => {
    calls.push({ sql, params });
    if (sql.includes('CREATE TABLE')) return { rows: [] };
    if (sql.includes('SELECT a.*')) return { rows: school ? [{ id: 3, class_id: 10, cohort_id: 11, is_published: published }] : [] };
    if (sql.includes("FROM users WHERE role='student'")) return { rows: [{ id: params[0] || 7, email: 'student@example.com' }] };
    if (sql.includes('FROM class_enrollments')) return { rows: member ? [{}] : [] };
    if (sql.includes('INSERT INTO teacher_feedback_files')) {
      const file = { id: records.length + 1, assignment_id: params[0], student_id: params[1], original_name: params[2], mime_type: params[3], size_bytes: params[4], file_data: params[5], created_by: params[6] };
      records.push(file); return { rows: [file] };
    }
    if (sql.includes('SELECT * FROM teacher_feedback_files')) return { rows: records.filter(file => file.id === params[0]) };
    if (sql.includes('FROM teacher_feedback_files WHERE assignment_id')) return { rows: records.filter(file => file.assignment_id === params[0] && file.student_id === params[1]).map(({ file_data, ...metadata }) => metadata) };
    throw Error(`Unexpected query: ${sql}`);
  }};
  return { files: createFeedbackFiles(pool), records, calls };
}
const teacher = { id: 5, role: 'teacher' }, student = { id: 7, role: 'student' };
const target = { studentEmail: 'student@example.com' };
const document = { originalname: 'Marked Volleyball.docx', buffer: Buffer.from('feedback document contents') };

test('teacher attaches a document; only the selected student can list and download the original bytes', async () => {
  const { files, records } = fixture();
  const saved = await files.attach(teacher, 3, target, document);
  assert.equal(saved.student_id, 7); assert.equal(saved.assignment_id, 3);
  const visible = await files.list(student, 3, { studentEmail: 'someone-else@example.com' });
  assert.equal(visible.length, 1); assert.equal(visible[0].original_name, document.originalname);
  assert.equal(visible[0].file_data, undefined);
  const downloaded = await files.download(student, saved.id);
  assert.deepEqual(downloaded.file_data, document.buffer);
  assert.equal((await files.list({ id: 8, role: 'student' }, 3, target)).length, 0);
  await assert.rejects(files.download({ id: 8, role: 'student' }, saved.id), { status: 403 });
  assert.equal(records.length, 1);
});
test('students cannot upload, and unrelated teachers cannot upload or download', async () => {
  await assert.rejects(fixture().files.attach(student, 3, target, document), { status: 403 });
  const { files, records } = fixture({ member: false });
  await assert.rejects(files.attach(teacher, 3, target, document), { status: 403 });
  records.push({ id: 1, assignment_id: 3, student_id: 7, file_data: document.buffer });
  await assert.rejects(files.download(teacher, 1), { status: 403 });
});
test('unpublished assessments, inactive enrollment, and another school cannot expose feedback', async () => {
  await assert.rejects(fixture({ published: false }).files.list(student, 3), { status: 403 });
  await assert.rejects(fixture({ member: false }).files.list(student, 3), { status: 403 });
  await assert.rejects(fixture({ school: false }).files.list(student, 3), { status: 404 });
  const { files, calls } = fixture(); await files.list(student, 3);
  const access = calls.find(call => call.sql.includes('FROM class_enrollments'));
  assert.deepEqual(access.params, [7, 10, 11, 'student', 7]);
  assert.ok(access.sql.includes('c.is_live=TRUE'));
});
test('empty and oversize files fail without a database write; filenames cannot contain paths or control characters', async () => {
  const { files, records } = fixture();
  for (const buffer of [Buffer.alloc(0), Buffer.alloc(MAX_FEEDBACK_FILE_BYTES + 1)]) {
    await assert.rejects(files.attach(teacher, 3, target, { ...document, buffer }), { status: 400 });
  }
  assert.equal(records.length, 0);
  const saved = await files.attach(teacher, 3, target, { ...document, originalname: '../folder/Feedback\r\n.pdf' });
  assert.equal(saved.original_name, 'Feedback.pdf');
});
test('attachments remain separate from grades and student submissions', async () => {
  const { files, calls } = fixture();
  await files.attach(teacher, 3, target, document);
  await files.attach(teacher, 3, target, document);
  assert.equal((await files.list(student, 3)).length, 2);
  assert.equal(calls.some(call => /INSERT INTO submissions|UPDATE submissions|UPDATE assignments/.test(call.sql)), false);
});
