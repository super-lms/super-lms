import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../AuthContext.jsx';
import authFetch from '../services/authFetch.js';
import './StudentAnnouncementAlert.css';

const keyOf = item => `${item.id}:${item.updated_at}`;

export default function StudentAnnouncementAlert() {
  const { user } = useAuth();
  // Remount the account-specific queue when signing out or changing accounts.
  return user?.role === 'student' ? <AnnouncementQueue key={user.id} /> : null;
}

function AnnouncementQueue() {
  const [pending, setPending] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dialog = useRef(null);
  const acknowledged = useRef(new Set());
  const refresh = useRef(null);
  const current = pending[0];

  useEffect(() => {
    let alive = true, fetching = false;
    const controller = new AbortController();
    async function load() {
      if (!alive || fetching) return;
      fetching = true;
      try {
        const response = await authFetch('/api/announcements/pending', { signal: controller.signal });
        if (!response.ok) return; // Keep an already-open notice during connectivity failures.
        const items = await response.json();
        if (alive && Array.isArray(items)) setPending(items.filter(item => !acknowledged.current.has(keyOf(item))));
      } catch { /* Next polling or focus event retries without interrupting student work. */ }
      finally { fetching = false; }
    }
    refresh.current = load;
    load();
    const timer = window.setInterval(load, 15000);
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    window.addEventListener('focus', load);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false; controller.abort(); window.clearInterval(timer);
      window.removeEventListener('focus', load);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  useEffect(() => {
    if (!current) return;
    const element = dialog.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element.showModal();
    return () => { element.close(); document.body.style.overflow = previousOverflow; };
  }, [current?.id, current?.updated_at]);

  async function acknowledge() {
    if (saving) return;
    const item = current;
    setSaving(true); setError('');
    try {
      const response = await authFetch(`/api/announcements/${item.id}/acknowledge`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: item.updated_at }),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 409) await refresh.current?.();
        throw new Error(result.error || 'Could not save your acknowledgement. Please try again.');
      }
      acknowledged.current.add(keyOf(item));
      setPending(items => items.filter(entry => keyOf(entry) !== keyOf(item)));
    } catch (err) { setError(err.message || 'Could not save your acknowledgement. Please try again.'); }
    finally { setSaving(false); }
  }

  if (!current) return null;
  return createPortal(
    <dialog ref={dialog} className="student-announcement-alert" aria-labelledby="student-announcement-title"
      aria-describedby="student-announcement-instruction" onCancel={event => event.preventDefault()}>
      <div className="student-announcement-alert-header">
        <p className="student-announcement-alert-eyebrow">New announcement{pending.length > 1 ? ` · ${pending.length} to read` : ''}</p>
        <h2 id="student-announcement-title">{current.title}</h2>
        {current.author_name && <p>From {current.author_name}</p>}
      </div>
      <div className="student-announcement-alert-message">
        <p>{current.body}</p>
        {current.event_date && <p><strong>Event date:</strong> {String(current.event_date).slice(0, 10)}</p>}
        {current.files?.length > 0 && <div><strong>Attached documents</strong><ul>{current.files.map(file => <li key={file.id}>{file.filename}</li>)}</ul><p>You can open these documents on the Announcements page after acknowledging this message.</p></div>}
      </div>
      <div className="student-announcement-alert-footer">
        <p id="student-announcement-instruction">Read this announcement, then click Got It to continue.</p>
        {error && <p role="alert" className="student-announcement-alert-error">{error}</p>}
        <button type="button" autoFocus disabled={saving} onClick={acknowledge}>{saving ? 'Saving…' : 'Got It'}</button>
      </div>
    </dialog>, document.body,
  );
}
