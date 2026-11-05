import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../AuthContext.jsx';
import authFetch from '../services/authFetch';

export default function FeedbackFiles({ assignmentId, studentEmail = '', studentName = '', editable = false }) {
  const { user } = useAuth();
  const [files, setFiles] = useState([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const uploadRef = useRef(null);
  const canUpload = editable && ['admin', 'teacher'].includes(user?.role);
  const canRead = user?.role === 'student' || Boolean(studentEmail);
  const url = `/api/feedback-files/assignments/${assignmentId}${studentEmail ? `?student_email=${encodeURIComponent(studentEmail)}` : ''}`;

  useEffect(() => {
    let active = true;
    setFiles([]);
    setMessage('');
    if (!assignmentId || !canRead) return;
    authFetch(url).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load feedback files.');
      if (active) setFiles(data.files || []);
    }).catch(error => { if (active) setMessage(error.message); });
    return () => { active = false; };
  }, [url, assignmentId, canRead]);

  async function attach(event) {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.size || file.size > 10 * 1024 * 1024) {
      setMessage('Choose a non-empty file up to 10 MB.'); input.value = ''; return;
    }
    setBusy(true); setMessage('Attaching feedback file…');
    try {
      const body = new FormData(); body.append('file', file); body.append('student_email', studentEmail);
      const response = await authFetch(`/api/feedback-files/assignments/${assignmentId}`, { method: 'POST', body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not attach file.');
      setFiles(current => [...current, data.file]);
      setMessage(`Attached for ${studentName || 'this student'}. Available beside their teacher feedback.`);
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); input.value = ''; }
  }

  async function download(file) {
    setBusy(true); setMessage('');
    try {
      const response = await authFetch(`/api/feedback-files/files/${file.id}`);
      if (!response.ok) {
        const data = await response.json(); throw new Error(data.error || 'Could not download feedback.');
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a'); link.href = url; link.download = file.original_name;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }

  if (!assignmentId || !canRead || (!canUpload && !files.length && !message)) return null;
  return <div style={{ marginTop: '12px', display: 'grid', gap: '8px', overflowWrap: 'anywhere' }}>
    <strong>Feedback files</strong>
    {canUpload ? <>
      <input ref={uploadRef} type="file" aria-label="Choose feedback file" onChange={attach} disabled={busy} style={{ display: 'none' }} />
      <button type="button" disabled={busy} onClick={() => uploadRef.current?.click()} style={{ justifySelf: 'start', padding: '9px 12px', border: '1px solid #94a3b8', borderRadius: '8px', fontWeight: 700 }}>
        {busy ? 'Please wait…' : 'Attach feedback file'}
      </button>
      <small>Up to 10 MB per file. Saved immediately for {studentName || 'this student'} on this assessment.</small>
    </> : null}
    {files.map(file => <button key={file.id} type="button" disabled={busy} onClick={() => download(file)} style={{ justifySelf: 'start', textAlign: 'left', padding: '8px', maxWidth: '100%', overflowWrap: 'anywhere' }}>
      Download {file.original_name} ({Math.max(1, Math.round(file.size_bytes / 1024))} KB)
    </button>)}
    {message ? <div role="status">{message}</div> : null}
  </div>;
}
