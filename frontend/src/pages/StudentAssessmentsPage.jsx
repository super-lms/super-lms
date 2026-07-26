import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import authFetch from "../services/authFetch";

function formatDate(value) {
  if (!value) return "No date set";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "No date set" : date.toLocaleString();
}

function Button({ children, onClick, disabled = false, quiet = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        border: "1px solid #2563eb",
        borderRadius: "10px",
        padding: "11px 16px",
        background: quiet ? "#fff" : "#2563eb",
        color: quiet ? "#1d4ed8" : "#fff",
        fontWeight: 800,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {children}
    </button>
  );
}

function Question({ question, number, value, onChange, disabled }) {
  const answer = value ?? "";
  return (
    <div style={questionCardStyle}>
      <div style={rowBetweenStyle}>
        <strong>Question {number}</strong>
        <span>{Number(question.points).toFixed(1)} points</span>
      </div>
      <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, fontSize: "1.05rem" }}>
        {question.prompt}
      </p>

      {question.question_type === "multiple_choice" ? (
        <div style={{ display: "grid", gap: "10px" }}>
          {(question.options_json || []).map((option) => (
            <label key={option} style={choiceStyle(answer === option)}>
              <input
                type="radio"
                name={`question-${question.id}`}
                value={option}
                checked={answer === option}
                onChange={() => onChange(option)}
                disabled={disabled}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      ) : null}

      {question.question_type === "true_false" ? (
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          {["True", "False"].map((option) => (
            <label key={option} style={choiceStyle(answer === option)}>
              <input
                type="radio"
                name={`question-${question.id}`}
                value={option}
                checked={answer === option}
                onChange={() => onChange(option)}
                disabled={disabled}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      ) : null}

      {question.question_type === "short_answer" ? (
        <input
          value={answer}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          style={inputStyle}
          placeholder="Type your answer"
        />
      ) : null}

      {question.question_type === "essay" ? (
        <textarea
          rows="8"
          value={answer}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          style={inputStyle}
          placeholder="Write your response"
        />
      ) : null}
    </div>
  );
}

export default function StudentAssessmentsPage() {
  const navigate = useNavigate();
  const autosaveTimer = useRef(null);
  const hasLoadedAttempt = useRef(false);
  const [assessments, setAssessments] = useState([]);
  const [selected, setSelected] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [attempt, setAttempt] = useState(null);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [autosaveState, setAutosaveState] = useState("");

  async function request(path, options) {
    const response = await authFetch(path, options);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  async function loadAssessments() {
    setLoading(true);
    setError("");
    try {
      const data = await request("/api/assessments");
      setAssessments(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAssessments();
    return () => {
      if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!attempt || attempt.status !== "in_progress" || !hasLoadedAttempt.current) return;
    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    setAutosaveState("Unsaved changes");
    autosaveTimer.current = window.setTimeout(async () => {
      try {
        setAutosaveState("Saving...");
        const data = await request(`/api/assessment-attempts/${attempt.id}/autosave`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers }),
        });
        setAutosaveState(`Saved ${new Date(data.autosaved_at).toLocaleTimeString()}`);
      } catch (err) {
        setAutosaveState("Autosave failed — check your connection");
        setError(err.message);
      }
    }, 800);
  }, [answers, attempt?.id]);

  async function openAssessment(assessment) {
    setWorking(true);
    setError("");
    setMessage("");
    hasLoadedAttempt.current = false;
    try {
      const detail = await request(`/api/assessments/${assessment.id}`);
      setSelected(detail.assessment);

      if (assessment.student_attempt_id) {
        const attemptData = await request(
          `/api/assessment-attempts/${assessment.student_attempt_id}`
        );
        setAttempt(attemptData.attempt);
        setQuestions(attemptData.questions || []);
        setAnswers(attemptData.attempt.answers_json || {});
        hasLoadedAttempt.current = true;
      } else {
        setAttempt(null);
        setQuestions([]);
        setAnswers({});
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setWorking(false);
    }
  }

  async function startAssessment() {
    if (
      !window.confirm(
        "Start this assessment now? Your work will save automatically until you submit."
      )
    ) {
      return;
    }
    setWorking(true);
    setError("");
    try {
      const started = await request(
        `/api/assessments/${selected.id}/attempts/start`,
        { method: "POST" }
      );
      const attemptData = await request(`/api/assessment-attempts/${started.id}`);
      setAttempt(attemptData.attempt);
      setQuestions(attemptData.questions || []);
      setAnswers(attemptData.attempt.answers_json || {});
      hasLoadedAttempt.current = true;
      setMessage("Assessment started. Your answers will save automatically.");
    } catch (err) {
      setError(err.message);
    } finally {
      setWorking(false);
    }
  }

  async function submitAssessment() {
    if (!window.confirm("Submit your assessment? You cannot change answers afterward.")) {
      return;
    }
    setWorking(true);
    setError("");
    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    try {
      const submitted = await request(
        `/api/assessment-attempts/${attempt.id}/submit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers }),
        }
      );
      setAttempt(submitted);
      setMessage(
        submitted.status === "graded"
          ? "Assessment submitted and graded successfully."
          : "Assessment submitted successfully. Written responses are waiting for teacher grading."
      );
      setAutosaveState("");
      await loadAssessments();
    } catch (err) {
      setError(err.message);
    } finally {
      setWorking(false);
    }
  }

  function closeAssessment() {
    setSelected(null);
    setQuestions([]);
    setAttempt(null);
    setAnswers({});
    setMessage("");
    setError("");
    setAutosaveState("");
    hasLoadedAttempt.current = false;
  }

  if (loading) {
    return <div style={pageStyle}><div style={cardStyle}>Loading assessments...</div></div>;
  }

  return (
    <div style={pageStyle}>
      <div style={rowBetweenStyle}>
        <div>
          <h1 style={{ margin: 0 }}>Tests & Assessments</h1>
          <p style={mutedStyle}>
            Open available assessments, complete your work, and submit when ready.
          </p>
        </div>
        <Button quiet onClick={() => navigate("/student")}>← My Learning</Button>
      </div>

      {error ? <div style={errorStyle}>{error}</div> : null}
      {message ? <div style={noticeStyle}>{message}</div> : null}

      {!selected ? (
        <div style={assessmentGridStyle}>
          {assessments.length === 0 ? (
            <div style={cardStyle}>
              <h2 style={{ marginTop: 0 }}>No assessments available</h2>
              <p style={mutedStyle}>
                Published assessments will appear here when your teacher makes them available.
              </p>
            </div>
          ) : (
            assessments.map((assessment) => {
              const state = assessment.student_attempt_status || "not_started";
              const now = Date.now();
              const notOpen =
                assessment.available_from &&
                new Date(assessment.available_from).getTime() > now;
              const closed =
                assessment.status === "closed" ||
                (assessment.due_at && new Date(assessment.due_at).getTime() < now);
              return (
                <div key={assessment.id} style={cardStyle}>
                  <div style={rowBetweenStyle}>
                    <h2 style={{ margin: 0 }}>{assessment.title}</h2>
                    <span style={statusPillStyle}>{state.replace("_", " ")}</span>
                  </div>
                  <p style={mutedStyle}>{assessment.course_title}</p>
                  <div style={metaGridStyle}>
                    <div><strong>Available (China Standard Time, UTC+8)</strong><br />{formatDate(assessment.available_from)}</div>
                    <div><strong>Due (China Standard Time, UTC+8)</strong><br />{formatDate(assessment.due_at)}</div>
                    <div><strong>Questions</strong><br />{assessment.question_count}</div>
                    <div><strong>Points</strong><br />{assessment.points_possible}</div>
                  </div>
                  <Button
                    disabled={working || notOpen || (closed && !assessment.student_attempt_id)}
                    onClick={() => openAssessment(assessment)}
                  >
                    {notOpen
                      ? "Not Available Yet"
                      : closed && !assessment.student_attempt_id
                        ? "Closed"
                        : state === "not_started"
                          ? "View Assessment"
                          : state === "in_progress"
                            ? "Continue Assessment"
                            : "View Submission"}
                  </Button>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div style={assessmentShellStyle}>
          <div style={cardStyle}>
            <div style={rowBetweenStyle}>
              <div>
                <h1 style={{ margin: 0 }}>{selected.title}</h1>
                <p style={mutedStyle}>{selected.course_title}</p>
              </div>
              <Button quiet onClick={closeAssessment}>Close</Button>
            </div>
            <div style={instructionsStyle}>
              {selected.instructions || "No additional instructions."}
            </div>
            <div style={metaGridStyle}>
              <div><strong>Due</strong><br />{formatDate(selected.due_at)}</div>
              <div><strong>Questions</strong><br />{questions.length}</div>
              <div><strong>Points</strong><br />{selected.points_possible}</div>
              <div><strong>Status</strong><br />{attempt?.status || "Not started"}</div>
            </div>

            {!attempt ? (
              <div style={startPanelStyle}>
                <h2 style={{ margin: 0 }}>Ready to begin?</h2>
                <p style={mutedStyle}>
                  Read the instructions carefully. After starting, answers save automatically.
                </p>
                <Button disabled={working} onClick={startAssessment}>
                  {working ? "Starting..." : "Start Assessment"}
                </Button>
              </div>
            ) : null}
          </div>

          {attempt ? (
            <>
              <div style={stickySaveStyle}>
                <strong>
                  {attempt.status === "in_progress"
                    ? autosaveState || "Answers save automatically"
                    : attempt.status === "graded"
                      ? `Final score: ${Number(attempt.score_percent).toFixed(1)}%`
                      : "Submitted — waiting for teacher grading"}
                </strong>
              </div>

              <div style={{ display: "grid", gap: "16px" }}>
                {questions.map((question, index) => (
                  <Question
                    key={question.id}
                    question={question}
                    number={index + 1}
                    value={answers[String(question.id)]}
                    disabled={attempt.status !== "in_progress"}
                    onChange={(value) =>
                      setAnswers((current) => ({
                        ...current,
                        [String(question.id)]: value,
                      }))
                    }
                  />
                ))}
              </div>

              {attempt.status === "in_progress" ? (
                <div style={submitPanelStyle}>
                  <div>
                    <h2 style={{ margin: 0 }}>Review and submit</h2>
                    <p style={mutedStyle}>
                      Confirm your answers before submitting. Submission is final.
                    </p>
                  </div>
                  <Button disabled={working} onClick={submitAssessment}>
                    {working ? "Submitting..." : "Submit Assessment"}
                  </Button>
                </div>
              ) : (
                <div style={receiptStyle}>
                  <h2 style={{ marginTop: 0 }}>Submission received</h2>
                  <p>
                    Submitted: {formatDate(attempt.submitted_at)}
                  </p>
                  <p>
                    {attempt.status === "graded"
                      ? `Score: ${Number(attempt.score_percent).toFixed(1)}%`
                      : "Your teacher will grade the written responses."}
                  </p>
                  {attempt.teacher_feedback ? (
                    <p><strong>Teacher feedback:</strong> {attempt.teacher_feedback}</p>
                  ) : null}
                </div>
              )}
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

const pageStyle = { minHeight: "100vh", background: "#f8fafc", padding: "28px", display: "grid", alignContent: "start", gap: "18px", fontFamily: "Arial, sans-serif" };
const rowBetweenStyle = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" };
const mutedStyle = { color: "#64748b", lineHeight: 1.5, margin: "6px 0" };
const assessmentGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "18px" };
const assessmentShellStyle = { maxWidth: "980px", width: "100%", margin: "0 auto", display: "grid", gap: "18px" };
const cardStyle = { border: "1px solid #dbe3ee", borderRadius: "16px", padding: "20px", background: "#fff", display: "grid", gap: "14px" };
const questionCardStyle = { border: "1px solid #cbd5e1", borderRadius: "14px", padding: "20px", background: "#fff" };
const instructionsStyle = { border: "1px solid #dbe3ee", borderRadius: "11px", padding: "14px", background: "#f8fafc", whiteSpace: "pre-wrap", lineHeight: 1.6 };
const metaGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "12px" };
const inputStyle = { width: "100%", boxSizing: "border-box", border: "1px solid #cbd5e1", borderRadius: "10px", padding: "12px", font: "inherit" };
const startPanelStyle = { borderTop: "1px solid #e2e8f0", paddingTop: "16px", display: "grid", gap: "10px", justifyItems: "start" };
const submitPanelStyle = { border: "2px solid #2563eb", borderRadius: "14px", padding: "18px", background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" };
const receiptStyle = { border: "2px solid #22c55e", borderRadius: "14px", padding: "18px", background: "#f0fdf4" };
const stickySaveStyle = { position: "sticky", top: "10px", zIndex: 5, border: "1px solid #93c5fd", borderRadius: "999px", padding: "10px 16px", background: "#eff6ff", width: "fit-content", justifySelf: "end" };
const statusPillStyle = { border: "1px solid #cbd5e1", borderRadius: "999px", padding: "4px 10px", background: "#f8fafc", fontSize: "0.8rem", fontWeight: 800, textTransform: "uppercase" };
const noticeStyle = { border: "1px solid #93c5fd", background: "#eff6ff", color: "#1e3a8a", padding: "12px 14px", borderRadius: "10px" };
const errorStyle = { border: "1px solid #fca5a5", background: "#fff1f2", color: "#9f1239", padding: "12px 14px", borderRadius: "10px" };

function choiceStyle(selected) {
  return {
    display: "flex",
    gap: "10px",
    alignItems: "center",
    border: selected ? "2px solid #2563eb" : "1px solid #cbd5e1",
    borderRadius: "10px",
    padding: "12px",
    background: selected ? "#eff6ff" : "#fff",
    cursor: "pointer",
  };
}
