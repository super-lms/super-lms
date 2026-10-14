import { useState } from 'react';
import authFetch from '../services/authFetch.js';

export default function AssignmentBatchDownloads({ assignmentId, sectionId }) {
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  async function download(kind) {
    setBusy(kind); setMessage(''); setError(false);
    try {
      const params = new URLSearchParams({ kind, ...(sectionId ? { sectionId } : {}) });
      const response = await authFetch(`/api/assignments/${assignmentId}/batch-download?${params}`);
      if (!response.ok) throw new Error((await response.json()).error || 'Could not prepare the download.');
      const blob = await response.blob(), url = URL.createObjectURL(blob);
      const disposition = response.headers.get('content-disposition') || '';
      const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i);
      const plain = disposition.match(/filename="([^"]+)"/i);
      let filename = `assignment-${assignmentId}-${kind}.zip`;
      try { filename = encoded ? decodeURIComponent(encoded[1]) : plain?.[1] || filename; } catch { /* Use the safe default name. */ }
      const link = document.createElement('a'); link.href = url; link.download = filename;
      document.body.append(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      setMessage('Download ready. Open the ZIP to get the class folder and its student subfolders. Check Submission list.csv for missing work or unavailable files.');
    } catch (err) { setError(true); setMessage(err.message || 'Download failed. Please try again.'); }
    finally { setBusy(''); }
  }
  return <section aria-label="Class submission downloads" style={{ border: '1px solid #d7dce5', borderRadius: 12, padding: 16, marginBottom: 16 }}>
    <strong>Download this class’s work</strong>
    <p style={{ margin: '8px 0', lineHeight: 1.5 }}>Downloads use the class section selected above. Each ZIP contains a folder organised by student.</p>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
      {[['written', 'Download Class Written Responses'], ['attachments', 'Download Class Attachments'], ['all', 'Download Both']].map(([kind, label]) =>
        <button key={kind} type="button" disabled={!!busy || !assignmentId} onClick={() => download(kind)}
          style={{ padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: 10, background: 'white', font: 'inherit', fontWeight: 700, cursor: busy ? 'wait' : 'pointer' }}>
          {busy === kind ? 'Preparing download…' : label}
        </button>)}
    </div>
    {message && <p role={error ? 'alert' : 'status'} style={{ marginBottom: 0, lineHeight: 1.5, color: error ? '#b91c1c' : '#245b50' }}>{message}</p>}
  </section>;
}
