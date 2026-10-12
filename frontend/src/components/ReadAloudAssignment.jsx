import { useCallback, useEffect, useRef, useState } from 'react';
import authFetch from '../services/authFetch';
import { toReadingWav } from '../services/readAloudAudio';
const panel = {
  border: '1px solid #cbd5e1',
  borderRadius: 12,
  padding: 18,
  margin: '16px 0',
  lineHeight: 1.5,
  minWidth: 0,
  overflowWrap: 'anywhere'
};
async function request(url, options) {
  const r = await authFetch(url, options),
    b = await r.json();
  if (!r.ok) throw Error(b.error || 'Read aloud request failed.');
  return b;
}
function AudioPlayback({
  url
}) {
  const [src, setSrc] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => () => {
    if (src) URL.revokeObjectURL(src);
  }, [src]);
  async function listen() {
    setBusy(true);
    setError('');
    try {
      const r = await authFetch(url);
      if (!r.ok) throw Error('Recording unavailable.');
      setSrc(URL.createObjectURL(await r.blob()));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return <div>{src ? <audio controls src={src} style={{
      width: '100%'
    }} /> : <button type="button" onClick={listen} disabled={busy}>{busy ? 'Loading…' : 'Listen to recording'}</button>}{error && <p role="alert">{error}</p>}</div>;
}
function Attempt({
  attempt,
  base,
  teacher,
  onSaved,
  points,
  best,
  onPublished
}) {
  const [percent, setPercent] = useState(attempt.result?.accuracy ?? ''),
    [reason, setReason] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function act(action) {
    setBusy(true);
    setError('');
    try {
      await request(`${base}/attempts/${attempt.id}/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(action === 'publish' ? {
          percent: percent === '' ? null : Number(percent),
          reason
        } : {})
      });
      await onSaved();
      if (action === 'publish') await onPublished?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const r = attempt.result;
  return <article style={panel}><h4 style={{
      margin: '0 0 8px'
    }}>{teacher ? `${attempt.student_name} · ` : ''}Attempt {attempt.id}{best ? ' · Best assessed attempt' : ''}</h4><p>{new Date(attempt.created_at).toLocaleString()} · {Number(attempt.seconds).toFixed(1)} seconds</p><AudioPlayback url={`${base}/attempts/${attempt.id}/audio`} />{r ? <><p><strong>Reading accuracy {r.accuracy}%</strong> · {(r.accuracy * points / 100).toFixed(2)} / {points} marks</p><p>Missed {r.missed} · Changed {r.changed} · Added {r.added}{r.needsReview ? ' · Recognition uncertain — teacher review required' : ''}</p><div aria-label="Word comparison" style={{
        lineHeight: 2.2
      }}>{r.alignment.map((w, i) => <span key={i} title={w.type === 'changed' ? `Expected ${w.expected}; heard ${w.spoken}` : w.type} style={{
          display: 'inline-block',
          margin: '2px 3px',
          padding: '0 4px',
          background: w.type === 'correct' ? '#edf7ed' : w.type === 'added' ? '#e0f2fe' : '#fff1d6'
        }}>{w.type === 'missed' ? `[missed: ${w.expected}]` : w.type === 'changed' ? `${w.expected} → ${w.spoken}` : w.type === 'added' ? `[added: ${w.spoken}]` : w.expected}</span>)}</div><details><summary>Recognized text</summary><p>{attempt.transcript}</p></details></> : <p role="status">{attempt.status === 'processing' ? 'Assessment in progress. Refresh shortly.' : attempt.error || 'Needs teacher review.'}</p>}<p>{attempt.published_at ? `Published mark: ${attempt.published_percent}%` : 'Not yet published to the gradebook.'}</p>{teacher && <div style={{
      display: 'grid',
      gap: 8
    }}>{(attempt.status !== 'processing' || Date.now() - Date.parse(attempt.processing_started_at) > 300000) && <button type="button" disabled={busy} onClick={() => act('retry')}>Reassess saved recording</button>}<label>Reviewed percentage<input type="number" min="0" max="100" step="0.01" value={percent} onChange={e => setPercent(e.target.value)} style={{
          display: 'block'
        }} /></label><label>Review note or reason for adjusting the mark<textarea value={reason} onChange={e => setReason(e.target.value)} style={{
          width: '100%'
        }} /></label><button type="button" disabled={busy || percent === ''} onClick={() => act('publish')}>{busy ? 'Saving…' : 'Publish reviewed mark to gradebook'}</button><small>Publishing replaces this student’s current mark for this assignment. Select the best attempt you have reviewed.</small></div>}{error && <p role="alert">{error}</p>}</article>;
}
export default function ReadAloudAssignment({
  assignmentId,
  teacher = false,
  onModeChange,
  sectionId,
  reviewOnly = false,
  onPublished
}) {
  const base = `/api/assignments/${assignmentId}/read-aloud`,
    [data, setData] = useState(null),
    [passage, setPassage] = useState(''),
    [max, setMax] = useState(3),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [recording, setRecording] = useState(false),
    [seconds, setSeconds] = useState(0),
    [blob, setBlob] = useState(null),
    [preview, setPreview] = useState('');
  const rec = useRef(null),
    stream = useRef(null),
    timer = useRef(null),
    mounted = useRef(true),
    conversion = useRef(0);
  const load = useCallback(async (syncSettings = false) => {
    const b = await request(`${base}${sectionId ? `?sectionId=${encodeURIComponent(sectionId)}` : ''}`);
    if (!mounted.current) return;
    setData(b);
    if (syncSettings) {
      setPassage(b.settings?.passage || '');
      setMax(b.settings?.max_attempts || 3);
    }
    onModeChange?.(!!b.settings);
    return b;
  }, [base, onModeChange, sectionId]);
  useEffect(() => {
    mounted.current = true;
    load(true).catch(e => {
      if (mounted.current) {
        setError(e.message);
        onModeChange?.(false);
      }
    });
    return () => {
      mounted.current = false;
      clearInterval(timer.current);
      if (rec.current?.state === 'recording') rec.current.stop();
      stream.current?.getTracks().forEach(t => t.stop());
    };
  }, [load, onModeChange]);
  useEffect(() => {
    if (!data?.attempts.some(a => a.status === 'processing')) return;
    const poll = setInterval(() => load().catch(() => {}), 5000);
    return () => clearInterval(poll);
  }, [data?.attempts, load]);
  useEffect(() => {
    if (!blob) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(blob);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);
  async function convert(file) {
    if (!file) return;
    if (file.size > 30000000) {
      setError('Choose an audio file smaller than 30 MB.');
      return;
    }
    const revision = ++conversion.current;
    setBusy(true);
    setError('');
    setBlob(null);
    try {
      const wav = await toReadingWav(file);
      if (mounted.current && conversion.current === revision) setBlob(wav);
    } catch (e) {
      if (mounted.current) setError(e.message);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function start() {
    setError('');
    setNotice('');
    setBlob(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw Error('Recording is unavailable in this browser. Upload an audio file instead.');
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: true
      });
      if (!mounted.current) {
        stream.current.getTracks().forEach(t => t.stop());
        return;
      }
      const recorder = new MediaRecorder(stream.current);
      rec.current = recorder;
      const chunks = [];
      recorder.ondataavailable = e => {
        if (e.data.size) chunks.push(e.data);
      };
      recorder.onstop = () => {
        clearInterval(timer.current);
        stream.current?.getTracks().forEach(t => t.stop());
        if (mounted.current) {
          setRecording(false);
          convert(new Blob(chunks, {
            type: recorder.mimeType
          }));
        }
      };
      recorder.start();
      setRecording(true);
      setSeconds(0);
      let elapsed = 0;
      timer.current = setInterval(() => {
        elapsed++;
        setSeconds(elapsed);
        if (elapsed >= 180 && recorder.state === 'recording') recorder.stop();
      }, 1000);
    } catch (e) {
      stream.current?.getTracks().forEach(t => t.stop());
      setError(e.message);
    }
  }
  async function save() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await request(base, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          passage,
          maxAttempts: Number(max)
        })
      });
      await load(true);
      setNotice('Read aloud settings saved. New attempts use these settings.');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const form = new FormData();
      form.append('audio', blob, 'reading.wav');
      await request(`${base}/attempts`, {
        method: 'POST',
        body: form
      });
      setBlob(null);
      await load();
      setNotice('Recording saved. Review your result below. Your teacher will publish the reviewed mark.');
    } catch (e) {
      setError(e.message);
      await load().catch(() => {});
    } finally {
      setBusy(false);
    }
  }
  if ((!teacher || reviewOnly) && !data?.settings) return error ? <p role="alert">Read aloud: {error}</p> : null;
  const attempts = data?.attempts || [],
    best = {};
  for (const a of attempts) if (a.result && (!best[a.student_id] || a.result.accuracy > best[a.student_id].result.accuracy)) best[a.student_id] = a;
  return <section style={panel}><h2>Read Aloud</h2><p>Read the passage aloud. The LMS compares recognized words with the passage and calculates a reading accuracy percentage. This measures word accuracy, not pronunciation.</p>{!data && !error && <p>Loading…</p>}{data && !data.serviceReady && <p role="status">Automatic assessment is not connected yet. The administrator must configure Azure Speech.</p>}{teacher && !reviewOnly ? <><p>Set up this existing assignment for reading. Keep its course, deadline, grading category and points in the usual assignment settings. Recordings may be up to 3 minutes.</p><label>Reference passage<textarea value={passage} onChange={e => setPassage(e.target.value)} rows={6} maxLength={6000} style={{
          width: '100%'
        }} /></label><p>Use English text, up to 300 words. The passage locks after the first attempt. Punctuation and capitalization are ignored; repeated words count as additions.</p><label>Attempts allowed<input type="number" min="1" max="10" value={max} onChange={e => setMax(e.target.value)} style={{
          display: 'block'
        }} /></label><button type="button" disabled={busy || !data} onClick={save}>{busy ? 'Saving…' : 'Save Read Aloud settings'}</button><p>Marks wait for your review. Listen, check highlighted words, and publish the best assessed attempt. Uncertain or unrecognized recordings need a review note.</p></> : teacher ? <p>Review the saved recordings below, then publish the best attempt for each student.</p> : <><div style={{
        whiteSpace: 'pre-wrap',
        padding: 14,
        background: '#f8fafc'
      }}>{data.settings.passage}</div><p>{attempts.length} / {data.settings.max_attempts} attempts used · Up to 3 minutes per recording</p><p>Your voice recording is sent to the school’s Azure Speech service for transcription when you submit.</p><div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 10
      }}>{recording ? <button type="button" onClick={() => rec.current?.stop()}>Stop recording ({seconds}s)</button> : <button type="button" onClick={start} disabled={busy || !data.serviceReady || attempts.length >= data.settings.max_attempts}>Record reading</button>}<label>Or upload audio<input type="file" accept="audio/*" disabled={recording || busy || !data.serviceReady || attempts.length >= data.settings.max_attempts} onChange={e => convert(e.target.files[0])} /></label></div>{preview && <audio controls src={preview} style={{
        width: '100%',
        marginTop: 10
      }} />}<button type="button" disabled={!blob || busy || recording || !data.serviceReady || attempts.length >= data.settings.max_attempts} onClick={submit}>{busy ? 'Processing…' : 'Submit for accuracy marking'}</button></>}{error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}{attempts.length > 0 && <h3>Recordings and results</h3>}{attempts.map(a => <Attempt key={`${a.id}:${a.status}:${a.published_at}`} attempt={a} base={base} teacher={teacher} onSaved={load} points={data.pointsPossible} best={best[a.student_id]?.id === a.id} onPublished={onPublished} />)}</section>;
}
