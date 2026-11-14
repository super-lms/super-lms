import { noticeClassSection } from "../services/lateNoticeClass";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import authFetch from "../services/authFetch";
import { displayAssignmentTime } from "../services/assignmentTime";

const actionStyle = { display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "8px 12px", border: "1px solid #aeb4bd", borderRadius: 6, background: "#fff", color: "#111827", font: "inherit", textDecoration: "none", cursor: "pointer" };
const alertKey = alert => `${alert.assignment_id}:${alert.student_id}:${alert.due_at}`;

export default function LateSubmissionAlerts({ classId, masterView = false }) {
  const [alerts, setAlerts] = useState([]);
  const [error, setError] = useState("");
  const [activeAction, setActiveAction] = useState(null);
  const [message, setMessage] = useState("");

  async function loadAlerts(signal) {
    const response = await authFetch(`/api/assignments/late-submission-alerts?classId=${encodeURIComponent(classId)}&scope=${masterView ? "master" : "section"}`, signal ? { signal } : undefined);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to refresh past-due notices.");
    setAlerts(data.alerts || []);
    setError("");
  }

  useEffect(() => {
    const controller = new AbortController();
    setMessage("");
    loadAlerts(controller.signal).catch(loadError => { if (loadError.name !== "AbortError") setError(loadError.message); });
    const interval = setInterval(() => loadAlerts().catch(loadError => setError(loadError.message)), 60000);
    const refreshOnFocus = () => loadAlerts().catch(loadError => setError(loadError.message));
    window.addEventListener("focus", refreshOnFocus);
    return () => { controller.abort(); clearInterval(interval); window.removeEventListener("focus", refreshOnFocus); };
  }, [classId, masterView]);

  async function approveClass(alert) {
    const sectionId = noticeClassSection(alert, classId, masterView);
    if (!sectionId) { setError("Choose an individual class in Speed Grading before approving the whole class."); return; }
    const action = { type: "approve-class", key: alertKey(alert) };
    setActiveAction(action);
    setError("");
    setMessage(`Approving the whole class for “${alert.title}”… Please wait.`);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    try {
      const response = await authFetch(`/api/assignments/${alert.assignment_id}/late-submission/class`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sectionId, enabled: true }), signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Whole-class approval failed.");
      setMessage(`Approved ✓ “${alert.title}” for ${data.students} students. ${data.promoted} saved item${Number(data.promoted) === 1 ? " was" : "s were"} released for marking.${data.skipped_declined ? ` ${data.skipped_declined} declined student${Number(data.skipped_declined) === 1 ? " still needs" : "s still need"} individual review.` : ""}`);
      setAlerts(current => current.filter(item => !(Number(item.assignment_id) === Number(alert.assignment_id) && Number(noticeClassSection(item, classId, masterView)) === Number(sectionId))));
      try {
        await loadAlerts();
      } catch (refreshError) {
        setError(`Approval was saved, but the notice list could not refresh: ${refreshError.message}`);
      }
    } catch (actionError) {
      setError(actionError.name === "AbortError" ? "Approval is taking too long. Nothing is confirmed yet; please try again." : actionError.message);
      setMessage("");
    } finally {
      window.clearTimeout(timeout);
      setActiveAction(null);
    }
  }

  async function decline(alert, disposition) {
    if (disposition === "delete" && !window.confirm("Permanently delete the pending late work and notify this student that it was declined? Earlier submitted or marked work will be kept.")) return;
    const action = { type: `decline-${disposition}`, key: alertKey(alert) };
    setActiveAction(action);
    setError("");
    setMessage(disposition === "delete" ? "Declining and deleting the saved late work…" : "Declining and retaining the saved late work…");
    try {
      const response = await authFetch(`/api/assignments/${alert.assignment_id}/late-submission/decline`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ student_email: alert.student_email, disposition, confirm_delete: disposition === "delete" }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to decline this submission.");
      setAlerts(current => current.filter(item => !(item.assignment_id === alert.assignment_id && item.student_id === alert.student_id)));
      setMessage("Declined ✓ The student has been notified to see their teacher.");
    } catch (actionError) {
      setError(actionError.message);
      setMessage("");
    } finally { setActiveAction(null); }
  }

  if (!alerts.length && !error && !message) return null;
  return <section style={{ border: "1px solid #c58a37", borderRadius: 12, padding: 18, marginBottom: 18, background: "#fffaf2" }}>
    <h2>Past-due submission notices</h2>
    <p>Late work is saved and held for teacher approval. Open Review / Approve to approve the saved work and make it available for marking. Use Approve whole class to approve all currently enrolled students for that assignment and class. Declined work still needs individual review. Older blocked attempts may still require the student to submit. Times are Beijing time. Approved and declined notices are removed automatically. This list refreshes every minute and when you return to this window.</p>
    {activeAction && message ? <div role="status" aria-live="polite" style={savingBannerStyle}>{message}</div> : null}
    {!activeAction && message ? <div role="status" aria-live="polite" style={successBannerStyle}>{message}</div> : null}
    {error ? <div role="alert" aria-live="assertive" style={errorBannerStyle}>Not saved: {error}</div> : null}
    {alerts.map(alert => {
      const extended = !alert.current_due_date || Date.parse(alert.current_due_date) > Date.now();
      const key = alertKey(alert);
      const thisAction = activeAction?.key === key ? activeAction : null;
      const busy = Boolean(activeAction);
      return <div key={key} style={{ padding: "12px 0", borderTop: "1px solid #ddd" }}>
        <strong>{alert.student_name?.trim() || alert.student_email}</strong> · {alert.course_title} · {alert.title}
        <p>Last blocked attempt: {displayAssignmentTime(alert.last_attempt_at)} · Attempts: {alert.attempt_count} · Deadline at attempt: {displayAssignmentTime(alert.due_at)}</p>
        <p>{alert.has_held_work ? "Saved work awaiting approval" : alert.approved ? "Late submission approved" : extended ? "Deadline extended or removed" : "Needs teacher review"}</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <Link style={actionStyle} to={`/assignments/${alert.assignment_id}/edit`}>Extend deadline</Link>
          <Link style={actionStyle} to={`/assignments/${alert.assignment_id}/grade?sectionId=${encodeURIComponent(alert.section_id || (masterView ? "all" : classId))}&studentId=${encodeURIComponent(alert.student_id)}&studentEmail=${encodeURIComponent(alert.student_email || "")}`}>Review / Approve</Link>
          {noticeClassSection(alert, classId, masterView) ? <button type="button" disabled={busy} onClick={() => approveClass(alert)} style={{ ...actionStyle, fontWeight: 700, opacity: busy && !thisAction ? 0.6 : 1 }}>{thisAction?.type === "approve-class" ? "Approving whole class…" : "Approve whole class"}</button> : <Link style={actionStyle} to={`/assignments/${alert.assignment_id}/grade?sectionId=all`}>Choose class for whole class approval</Link>}
          <button type="button" disabled={busy} onClick={() => decline(alert, "keep")} style={{ ...actionStyle, color: "#991b1b", opacity: busy && !thisAction ? 0.6 : 1 }}>{thisAction?.type === "decline-keep" ? "Declining…" : "Decline and keep saved work"}</button>
          <button type="button" disabled={busy} onClick={() => decline(alert, "delete")} style={{ ...actionStyle, color: "#991b1b", opacity: busy && !thisAction ? 0.6 : 1 }}>{thisAction?.type === "decline-delete" ? "Deleting…" : "Decline and delete saved work"}</button>
        </div>
      </div>;
    })}
  </section>;
}

const savingBannerStyle = { padding: 12, margin: "12px 0", border: "2px solid #1d4ed8", borderRadius: 8, background: "#eff6ff", color: "#1e3a8a", fontWeight: 800 };
const successBannerStyle = { padding: 12, margin: "12px 0", border: "2px solid #15803d", borderRadius: 8, background: "#f0fdf4", color: "#166534", fontWeight: 800 };
const errorBannerStyle = { padding: 12, margin: "12px 0", border: "2px solid #b91c1c", borderRadius: 8, background: "#fef2f2", color: "#991b1b", fontWeight: 800 };
