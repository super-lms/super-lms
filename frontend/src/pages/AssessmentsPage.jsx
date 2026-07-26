import { useEffect, useMemo, useState } from "react";
import authFetch from "../services/authFetch";
import { useAuth } from "../AuthContext.jsx";

const EMPTY_ASSESSMENT = {
  course_id: "",
  title: "",
  instructions: "",
  subcategory_id: "",
  available_from: "",
  due_at: "",
  time_limit_minutes: "",
  max_attempts: "1",
  shuffle_questions: false,
  shuffle_answers: false,
};

const EMPTY_QUESTION = {
  question_type: "multiple_choice",
  prompt: "",
  options: ["", ""],
  correct_answer: "",
  points: "1",
  teacher_feedback: "",
};

const EMPTY_GROUP = {
  bank_id: "",
  title: "",
  draw_count: "1",
  points_per_question: "1",
};

function localDateTimeValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}

function toApiDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function formatDate(value) {
  if (!value) return "No date set";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "No date set" : date.toLocaleString();
}

function typeLabel(type) {
  return {
    multiple_choice: "Multiple Choice",
    true_false: "True / False",
    short_answer: "Short Answer",
    essay: "Essay",
  }[type] || type;
}

function StatusPill({ children }) {
  return <span style={statusPillStyle}>{children}</span>;
}

function Button({ children, onClick, disabled = false, quiet = false, danger = false, type = "button" }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={buttonStyle({ disabled, quiet, danger })}
    >
      {children}
    </button>
  );
}

function QuestionPreview({ question, number }) {
  return (
    <div style={questionCardStyle}>
      <div style={rowBetweenStyle}>
        <strong>Question {number}</strong>
        <span>{Number(question.points).toFixed(1)} points</span>
      </div>
      <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.55 }}>{question.prompt}</p>
      {question.question_type === "multiple_choice" ? (
        <div style={{ display: "grid", gap: "8px" }}>
          {(question.options_json || []).map((option) => (
            <label key={option} style={choiceStyle}>
              <input type="radio" disabled /> {option}
            </label>
          ))}
        </div>
      ) : null}
      {question.question_type === "true_false" ? (
        <div style={{ display: "flex", gap: "16px" }}>
          <label><input type="radio" disabled /> True</label>
          <label><input type="radio" disabled /> False</label>
        </div>
      ) : null}
      {question.question_type === "short_answer" ? (
        <input disabled placeholder="Student short answer" style={inputStyle} />
      ) : null}
      {question.question_type === "essay" ? (
        <textarea disabled rows="5" placeholder="Student written response" style={inputStyle} />
      ) : null}
    </div>
  );
}

export default function AssessmentsPage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [assessment, setAssessment] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [questionGroups, setQuestionGroups] = useState([]);
  const [questionBanks, setQuestionBanks] = useState([]);
  const [groupForm, setGroupForm] = useState(EMPTY_GROUP);
  const [tiers, setTiers] = useState([]);
  const [form, setForm] = useState(EMPTY_ASSESSMENT);
  const [questionForm, setQuestionForm] = useState(EMPTY_QUESTION);
  const [editingQuestionId, setEditingQuestionId] = useState("");
  const [view, setView] = useState("build");
  const [attempts, setAttempts] = useState([]);
  const [selectedAttempt, setSelectedAttempt] = useState(null);
  const [attemptQuestions, setAttemptQuestions] = useState([]);
  const [manualScores, setManualScores] = useState({});
  const [teacherFeedback, setTeacherFeedback] = useState("");
  const [accommodations, setAccommodations] = useState([]);
  const [selectedAccommodationId, setSelectedAccommodationId] = useState("");
  const [accommodationForm, setAccommodationForm] = useState({
    extra_time_minutes: "0",
    extra_attempts: "0",
    available_from_override: "",
    due_at_override: "",
    notes: "",
  });
  const [auditEvents, setAuditEvents] = useState([]);
  const [reopenMinutes, setReopenMinutes] = useState("15");
  const [status, setStatus] = useState("Loading assessments...");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedCourse = courses.find(
    (course) => String(course.id) === String(form.course_id)
  );
  const pointsPossible = useMemo(
    () =>
      questions.reduce((sum, question) => sum + Number(question.points || 0), 0) +
      questionGroups.reduce(
        (sum, group) =>
          sum + Number(group.draw_count || 0) * Number(group.points_per_question || 0),
        0
      ),
    [questions, questionGroups]
  );
  const totalQuestionCount =
    questions.length +
    questionGroups.reduce(
      (sum, group) => sum + Number(group.draw_count || 0),
      0
    );

  async function request(path, options) {
    const response = await authFetch(path, options);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  async function loadCourses() {
    const data = await request("/api/classes");
    setCourses(Array.isArray(data) ? data : []);
  }

  async function loadAssessments(keepId = selectedId) {
    const data = await request("/api/assessments");
    setAssessments(Array.isArray(data) ? data : []);
    if (keepId && !data.some((item) => String(item.id) === String(keepId))) {
      setSelectedId("");
      setAssessment(null);
    }
    setStatus("");
  }

  async function loadCourseStructure(courseId) {
    if (!courseId) {
      setTiers([]);
      return;
    }
    const categoryData = await request(`/api/courses/${courseId}/categories`);
    const safeCategories = Array.isArray(categoryData) ? categoryData : [];
    const tierGroups = await Promise.all(
      safeCategories.map(async (category) => {
        const data = await request(`/api/categories/${category.id}/subcategories`);
        return (Array.isArray(data) ? data : []).map((tier) => ({
          ...tier,
          category_name: category.name,
        }));
      })
    );
    setTiers(tierGroups.flat());
  }

  async function loadQuestionBanks(courseId) {
    if (!courseId) {
      setQuestionBanks([]);
      return;
    }
    const data = await request(`/api/question-banks?courseId=${courseId}`);
    setQuestionBanks(Array.isArray(data) ? data : []);
  }

  async function openAssessment(id, nextView = "build") {
    setError("");
    setStatus("Loading assessment...");
    try {
      const data = await request(`/api/assessments/${id}`);
      setSelectedId(String(id));
      setAssessment(data.assessment);
      setQuestions(data.questions || []);
      setQuestionGroups(data.question_groups || []);
      setForm({
        course_id: String(data.assessment.course_id),
        title: data.assessment.title || "",
        instructions: data.assessment.instructions || "",
        subcategory_id: data.assessment.subcategory_id
          ? String(data.assessment.subcategory_id)
          : "",
        available_from: localDateTimeValue(data.assessment.available_from),
        due_at: localDateTimeValue(data.assessment.due_at),
        time_limit_minutes: data.assessment.time_limit_minutes
          ? String(data.assessment.time_limit_minutes)
          : "",
        max_attempts: String(data.assessment.max_attempts || 1),
        shuffle_questions: Boolean(data.assessment.shuffle_questions),
        shuffle_answers: Boolean(data.assessment.shuffle_answers),
      });
      await Promise.all([
        loadCourseStructure(data.assessment.course_id),
        loadQuestionBanks(data.assessment.course_id),
      ]);
      await Promise.all([loadAccommodations(id), loadAuditEvents(id)]);
      setView(nextView);
      setQuestionForm(EMPTY_QUESTION);
      setEditingQuestionId("");
      setGroupForm(EMPTY_GROUP);
      if (nextView === "grade") await loadAttempts(id);
      setStatus("");
    } catch (err) {
      setError(err.message);
      setStatus("");
    }
  }

  async function loadAttempts(id = selectedId) {
    if (!id) return;
    const data = await request(`/api/assessments/${id}/attempts`);
    setAttempts(Array.isArray(data) ? data : []);
  }

  async function loadAccommodations(id = selectedId) {
    if (!id) return;
    const data = await request(`/api/assessments/${id}/accommodations`);
    setAccommodations(Array.isArray(data) ? data : []);
  }

  async function loadAuditEvents(id = selectedId) {
    if (!id) return;
    const data = await request(`/api/assessments/${id}/audit-events`);
    setAuditEvents(Array.isArray(data) ? data : []);
  }

  function chooseAccommodation(studentId) {
    setSelectedAccommodationId(String(studentId));
    const row = accommodations.find(
      (item) => String(item.student_user_id) === String(studentId)
    );
    setAccommodationForm({
      extra_time_minutes: String(row?.extra_time_minutes || 0),
      extra_attempts: String(row?.extra_attempts || 0),
      available_from_override: localDateTimeValue(row?.available_from_override),
      due_at_override: localDateTimeValue(row?.due_at_override),
      notes: row?.notes || "",
    });
  }

  async function saveAccommodation() {
    if (!selectedAccommodationId) {
      setError("Select a student before saving an accommodation.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await request(
        `/api/assessments/${selectedId}/accommodations/${selectedAccommodationId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...accommodationForm,
            available_from_override: toApiDate(
              accommodationForm.available_from_override
            ),
            due_at_override: toApiDate(accommodationForm.due_at_override),
          }),
        }
      );
      await Promise.all([
        loadAccommodations(selectedId),
        loadAuditEvents(selectedId),
      ]);
      setStatus("Student accommodation saved.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    Promise.all([loadCourses(), loadAssessments()]).catch((err) => {
      setError(err.message);
      setStatus("");
    });
  }, []);

  async function createAssessment(event) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const created = await request("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          teacher_id: user?.id,
          available_from: toApiDate(form.available_from),
          due_at: toApiDate(form.due_at),
        }),
      });
      await loadAssessments(created.id);
      await openAssessment(created.id);
      setStatus("Draft assessment created.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function persistAssessmentDetails() {
    return request(`/api/assessments/${selectedId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          available_from: toApiDate(form.available_from),
          due_at: toApiDate(form.due_at),
        }),
      });
  }

  async function saveAssessment() {
    setError("");
    setSaving(true);
    try {
      const saved = await persistAssessmentDetails();
      setAssessment((current) => ({ ...current, ...saved }));
      await loadAssessments(selectedId);
      setStatus("Assessment details saved.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function publishAssessment() {
    setError("");
    setSaving(true);
    try {
      await persistAssessmentDetails();
      await request(`/api/assessments/${selectedId}/publish`, { method: "POST" });
      await openAssessment(selectedId);
      await loadAssessments(selectedId);
      setStatus("Assessment published and added to the Gradebook.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function closeAssessment() {
    if (!window.confirm("Close this assessment to new attempts?")) return;
    setSaving(true);
    setError("");
    try {
      await request(`/api/assessments/${selectedId}/close`, { method: "POST" });
      await openAssessment(selectedId);
      await loadAssessments(selectedId);
      setStatus("Assessment closed.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteAssessment() {
    if (!window.confirm(`Delete draft assessment "${assessment.title}"?`)) return;
    setSaving(true);
    setError("");
    try {
      await request(`/api/assessments/${selectedId}`, { method: "DELETE" });
      setSelectedId("");
      setAssessment(null);
      setQuestions([]);
      setQuestionGroups([]);
      setForm(EMPTY_ASSESSMENT);
      await loadAssessments("");
      setStatus("Draft assessment deleted.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function changeQuestionType(questionType) {
    setQuestionForm((current) => ({
      ...current,
      question_type: questionType,
      options:
        questionType === "multiple_choice" ? current.options || ["", ""] : [],
      correct_answer: questionType === "true_false" ? "True" : "",
    }));
  }

  function editQuestion(question) {
    setEditingQuestionId(String(question.id));
    setQuestionForm({
      question_type: question.question_type,
      prompt: question.prompt || "",
      options: question.options_json || [],
      correct_answer: question.correct_answer_json ?? "",
      points: String(question.points || 1),
      teacher_feedback: question.teacher_feedback || "",
    });
    setView("build");
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  }

  async function saveQuestion(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const path = editingQuestionId
        ? `/api/assessments/${selectedId}/questions/${editingQuestionId}`
        : `/api/assessments/${selectedId}/questions`;
      await request(path, {
        method: editingQuestionId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(questionForm),
      });
      await openAssessment(selectedId);
      setQuestionForm(EMPTY_QUESTION);
      setEditingQuestionId("");
      setStatus(editingQuestionId ? "Question updated." : "Question added.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteQuestion(questionId) {
    if (!window.confirm("Delete this question?")) return;
    setSaving(true);
    try {
      await request(`/api/assessments/${selectedId}/questions/${questionId}`, {
        method: "DELETE",
      });
      await openAssessment(selectedId);
      setStatus("Question deleted.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function addQuestionGroup(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await request(`/api/assessments/${selectedId}/question-groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(groupForm),
      });
      await openAssessment(selectedId);
      await loadAssessments(selectedId);
      setGroupForm(EMPTY_GROUP);
      setStatus("Random question group added.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteQuestionGroup(groupId) {
    if (!window.confirm("Remove this random question group?")) return;
    setSaving(true);
    setError("");
    try {
      await request(`/api/assessments/${selectedId}/question-groups/${groupId}`, {
        method: "DELETE",
      });
      await openAssessment(selectedId);
      await loadAssessments(selectedId);
      setStatus("Random question group removed.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function openAttempt(attempt) {
    setError("");
    try {
      const data = await request(`/api/assessment-attempts/${attempt.id}`);
      setSelectedAttempt(data.attempt);
      setAttemptQuestions(data.questions || []);
      setManualScores(data.attempt.manual_scores_json || {});
      setTeacherFeedback(data.attempt.teacher_feedback || "");
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveGrade() {
    setSaving(true);
    setError("");
    try {
      await request(`/api/assessment-attempts/${selectedAttempt.id}/grade`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          manual_scores: manualScores,
          teacher_feedback: teacherFeedback,
        }),
      });
      await loadAttempts();
      await openAttempt({ id: selectedAttempt.id });
      setStatus("Assessment graded and synchronized to the Gradebook.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function reopenAttempt() {
    if (!selectedAttempt) return;
    if (
      !window.confirm(
        `Reopen attempt ${selectedAttempt.attempt_number || 1} for ${reopenMinutes} minutes?`
      )
    ) return;
    setSaving(true);
    setError("");
    try {
      await request(`/api/assessment-attempts/${selectedAttempt.id}/reopen`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extension_minutes: Number(reopenMinutes) }),
      });
      await Promise.all([loadAttempts(), loadAuditEvents()]);
      await openAttempt({ id: selectedAttempt.id });
      setStatus("Student attempt reopened.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function startNew() {
    setSelectedId("");
    setAssessment(null);
    setQuestions([]);
    setQuestionGroups([]);
    setForm(EMPTY_ASSESSMENT);
    setTiers([]);
    setQuestionBanks([]);
    setGroupForm(EMPTY_GROUP);
    setView("build");
    setError("");
    setStatus("");
  }

  return (
    <div className="content-area">
      <section className="panel" style={{ display: "grid", gap: "20px" }}>
        <div style={rowBetweenStyle}>
          <div>
            <h1 style={{ margin: 0 }}>Assessments</h1>
            <p style={mutedStyle}>
              Create, preview, publish, deliver, and grade native SUPER LMS assessments.
            </p>
          </div>
          <Button onClick={startNew}>+ New Assessment</Button>
        </div>

        {error ? <div style={errorStyle}>{error}</div> : null}
        {status ? <div style={noticeStyle}>{status}</div> : null}

        <div style={workspaceGridStyle}>
          <aside style={sidebarStyle}>
            <strong>Assessment Library</strong>
            {assessments.length === 0 ? (
              <p style={mutedStyle}>No assessments yet.</p>
            ) : (
              assessments.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => openAssessment(item.id)}
                  style={libraryItemStyle(String(item.id) === selectedId)}
                >
                  <strong>{item.title}</strong>
                  <span>{item.course_title}</span>
                  <span>{item.question_count} questions · {item.points_possible} points</span>
                  <StatusPill>{item.status}</StatusPill>
                </button>
              ))
            )}
          </aside>

          <main style={{ minWidth: 0 }}>
            {!assessment ? (
              <form onSubmit={createAssessment} style={cardStyle}>
                <h2 style={{ marginTop: 0 }}>Create Assessment Draft</h2>
                <label style={labelStyle}>
                  Course
                  <select
                    required
                    value={form.course_id}
                    onChange={async (event) => {
                      const courseId = event.target.value;
                      setForm((current) => ({
                        ...current,
                        course_id: courseId,
                        subcategory_id: "",
                      }));
                      await loadCourseStructure(courseId).catch((err) => setError(err.message));
                    }}
                    style={inputStyle}
                  >
                    <option value="">Select course</option>
                    {courses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.title || course.class_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={labelStyle}>
                  Assessment title
                  <input
                    required
                    value={form.title}
                    onChange={(event) => setForm({ ...form, title: event.target.value })}
                    style={inputStyle}
                    placeholder="Example: Unit 1 Reading Assessment"
                  />
                </label>
                <label style={labelStyle}>
                  Instructions
                  <textarea
                    rows="5"
                    value={form.instructions}
                    onChange={(event) => setForm({ ...form, instructions: event.target.value })}
                    style={inputStyle}
                    placeholder="Explain what students should do."
                  />
                </label>
                <Button type="submit" disabled={saving || !form.course_id || !form.title.trim()}>
                  {saving ? "Creating..." : "Create Draft"}
                </Button>
              </form>
            ) : (
              <div style={{ display: "grid", gap: "18px" }}>
                <div style={rowBetweenStyle}>
                  <div>
                    <h2 style={{ margin: 0 }}>{assessment.title}</h2>
                    <p style={mutedStyle}>
                      {assessment.course_title} · {totalQuestionCount} questions · {pointsPossible.toFixed(1)} points
                    </p>
                  </div>
                  <StatusPill>{assessment.status}</StatusPill>
                </div>

                <div style={tabRowStyle}>
                  <Button quiet={view !== "build"} onClick={() => setView("build")}>Build</Button>
                  <Button quiet={view !== "preview"} onClick={() => setView("preview")}>Preview as Student</Button>
                  <Button
                    quiet={view !== "grade"}
                    onClick={async () => {
                      setView("grade");
                      await loadAttempts();
                    }}
                  >
                    Grade ({assessment.submitted_count || 0})
                  </Button>
                </div>

                {view === "build" ? (
                  <>
                    <div style={cardStyle}>
                      <h3 style={{ marginTop: 0 }}>Assessment Details</h3>
                      <div style={twoColumnStyle}>
                        <label style={labelStyle}>
                          Title
                          <input
                            value={form.title}
                            onChange={(event) => setForm({ ...form, title: event.target.value })}
                            style={inputStyle}
                          />
                        </label>
                        <label style={labelStyle}>
                          Evidence Tier
                          <select
                            value={form.subcategory_id}
                            onChange={(event) => setForm({ ...form, subcategory_id: event.target.value })}
                            style={inputStyle}
                          >
                            <option value="">Select Evidence Tier</option>
                            {tiers.map((tier) => (
                              <option key={tier.id} value={tier.id}>
                                {tier.category_name} — {tier.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div style={twoColumnStyle}>
                        <label style={labelStyle}>
                          Time limit in minutes (leave blank for untimed)
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={form.time_limit_minutes}
                            onChange={(event) =>
                              setForm({ ...form, time_limit_minutes: event.target.value })
                            }
                            style={inputStyle}
                          />
                        </label>
                        <label style={labelStyle}>
                          Attempts allowed
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={form.max_attempts}
                            onChange={(event) =>
                              setForm({ ...form, max_attempts: event.target.value })
                            }
                            style={inputStyle}
                          />
                        </label>
                      </div>
                      <label style={labelStyle}>
                        Instructions
                        <textarea
                          rows="4"
                          value={form.instructions}
                          onChange={(event) => setForm({ ...form, instructions: event.target.value })}
                          style={inputStyle}
                        />
                      </label>
                      <div style={twoColumnStyle}>
                        <label style={labelStyle}>
                          Available from — China Standard Time (UTC+8)
                          <input
                            type="datetime-local"
                            value={form.available_from}
                            onChange={(event) => setForm({ ...form, available_from: event.target.value })}
                            style={inputStyle}
                          />
                        </label>
                        <label style={labelStyle}>
                          Due / closes — China Standard Time (UTC+8)
                          <input
                            type="datetime-local"
                            value={form.due_at}
                            onChange={(event) => setForm({ ...form, due_at: event.target.value })}
                            style={inputStyle}
                          />
                        </label>
                      </div>
                      <div style={twoColumnStyle}>
                        <label style={choiceStyle}>
                          <input
                            type="checkbox"
                            checked={form.shuffle_questions}
                            onChange={(event) =>
                              setForm({ ...form, shuffle_questions: event.target.checked })
                            }
                          />
                          Shuffle question order separately for each student
                        </label>
                        <label style={choiceStyle}>
                          <input
                            type="checkbox"
                            checked={form.shuffle_answers}
                            onChange={(event) =>
                              setForm({ ...form, shuffle_answers: event.target.checked })
                            }
                          />
                          Shuffle multiple-choice answers separately for each student
                        </label>
                      </div>
                      <div style={actionRowStyle}>
                        <Button onClick={saveAssessment} disabled={saving}>Save Details</Button>
                        {assessment.status === "draft" ? (
                          <>
                            <Button onClick={publishAssessment} disabled={saving}>Publish Assessment</Button>
                            <Button danger quiet onClick={deleteAssessment} disabled={saving}>Delete Draft</Button>
                          </>
                        ) : null}
                        {assessment.status === "published" ? (
                          <Button danger quiet onClick={closeAssessment} disabled={saving}>Close Assessment</Button>
                        ) : null}
                      </div>
                    </div>

                    <div style={cardStyle}>
                      <h3 style={{ marginTop: 0 }}>Student Accommodations</h3>
                      <p style={mutedStyle}>
                        Add extra time, extra attempts, or individual availability dates.
                      </p>
                      <label style={labelStyle}>
                        Student
                        <select
                          value={selectedAccommodationId}
                          onChange={(event) => chooseAccommodation(event.target.value)}
                          style={inputStyle}
                        >
                          <option value="">Select student</option>
                          {accommodations.map((item) => (
                            <option
                              key={item.student_user_id}
                              value={item.student_user_id}
                            >
                              {item.student_name || item.student_email}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div style={twoColumnStyle}>
                        <label style={labelStyle}>
                          Extra time (minutes)
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={accommodationForm.extra_time_minutes}
                            onChange={(event) =>
                              setAccommodationForm({
                                ...accommodationForm,
                                extra_time_minutes: event.target.value,
                              })
                            }
                            style={inputStyle}
                          />
                        </label>
                        <label style={labelStyle}>
                          Extra attempts
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={accommodationForm.extra_attempts}
                            onChange={(event) =>
                              setAccommodationForm({
                                ...accommodationForm,
                                extra_attempts: event.target.value,
                              })
                            }
                            style={inputStyle}
                          />
                        </label>
                        <label style={labelStyle}>
                          Available from override — China Standard Time (UTC+8)
                          <input
                            type="datetime-local"
                            value={accommodationForm.available_from_override}
                            onChange={(event) =>
                              setAccommodationForm({
                                ...accommodationForm,
                                available_from_override: event.target.value,
                              })
                            }
                            style={inputStyle}
                          />
                        </label>
                        <label style={labelStyle}>
                          Due / closes override — China Standard Time (UTC+8)
                          <input
                            type="datetime-local"
                            value={accommodationForm.due_at_override}
                            onChange={(event) =>
                              setAccommodationForm({
                                ...accommodationForm,
                                due_at_override: event.target.value,
                              })
                            }
                            style={inputStyle}
                          />
                        </label>
                      </div>
                      <label style={labelStyle}>
                        Accommodation notes
                        <textarea
                          rows="3"
                          value={accommodationForm.notes}
                          onChange={(event) =>
                            setAccommodationForm({
                              ...accommodationForm,
                              notes: event.target.value,
                            })
                          }
                          style={inputStyle}
                        />
                      </label>
                      <Button
                        onClick={saveAccommodation}
                        disabled={saving || !selectedAccommodationId}
                      >
                        Save Accommodation
                      </Button>
                    </div>

                    <div style={cardStyle}>
                      <h3 style={{ marginTop: 0 }}>Questions</h3>
                      {questions.length === 0 ? (
                        <p style={mutedStyle}>
                          {questionGroups.length > 0
                            ? "This assessment uses the random question groups below."
                            : "Add the first question below."}
                        </p>
                      ) : (
                        <div style={{ display: "grid", gap: "12px" }}>
                          {questions.map((question, index) => (
                            <div key={question.id} style={compactQuestionStyle}>
                              <div>
                                <strong>{index + 1}. {question.prompt}</strong>
                                <div style={mutedStyle}>
                                  {typeLabel(question.question_type)} · {question.points} points
                                </div>
                              </div>
                              <div style={actionRowStyle}>
                                {assessment.status === "draft" ? (
                                  <>
                                    <Button quiet onClick={() => editQuestion(question)}>Edit</Button>
                                    <Button danger quiet onClick={() => deleteQuestion(question.id)}>Delete</Button>
                                  </>
                                ) : (
                                  <StatusPill>Locked after publish</StatusPill>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={cardStyle}>
                      <div style={rowBetweenStyle}>
                        <div>
                          <h3 style={{ margin: 0 }}>Random Question Groups</h3>
                          <p style={mutedStyle}>
                            Draw a fixed number of questions from a reusable bank. Each student’s selection is frozen when the attempt begins.
                          </p>
                        </div>
                        <Button quiet onClick={() => window.location.assign("/question-banks")}>
                          Manage Question Banks
                        </Button>
                      </div>

                      {questionGroups.length === 0 ? (
                        <p style={mutedStyle}>No random question groups attached.</p>
                      ) : (
                        <div style={{ display: "grid", gap: "10px" }}>
                          {questionGroups.map((group) => (
                            <div key={group.id} style={compactQuestionStyle}>
                              <div>
                                <strong>{group.title}</strong>
                                <div style={mutedStyle}>
                                  Draw {group.draw_count} from {group.bank_title} · {group.points_per_question} points each · {group.bank_question_count} available
                                </div>
                              </div>
                              {assessment.status === "draft" ? (
                                <Button danger quiet onClick={() => deleteQuestionGroup(group.id)}>
                                  Remove
                                </Button>
                              ) : (
                                <StatusPill>Locked after publish</StatusPill>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {assessment.status === "draft" ? (
                        <form onSubmit={addQuestionGroup} style={{ display: "grid", gap: "12px" }}>
                          <div style={twoColumnStyle}>
                            <label style={labelStyle}>
                              Question bank
                              <select
                                required
                                value={groupForm.bank_id}
                                onChange={(event) => {
                                  const bank = questionBanks.find(
                                    (item) => String(item.id) === String(event.target.value)
                                  );
                                  setGroupForm({
                                    ...groupForm,
                                    bank_id: event.target.value,
                                    title: groupForm.title || bank?.title || "",
                                  });
                                }}
                                style={inputStyle}
                              >
                                <option value="">Select bank</option>
                                {questionBanks.map((bank) => (
                                  <option key={bank.id} value={bank.id}>
                                    {bank.title} ({bank.question_count} questions)
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label style={labelStyle}>
                              Group title
                              <input
                                required
                                value={groupForm.title}
                                onChange={(event) =>
                                  setGroupForm({ ...groupForm, title: event.target.value })
                                }
                                style={inputStyle}
                              />
                            </label>
                          </div>
                          <div style={twoColumnStyle}>
                            <label style={labelStyle}>
                              Questions to draw
                              <input
                                type="number"
                                min="1"
                                required
                                value={groupForm.draw_count}
                                onChange={(event) =>
                                  setGroupForm({ ...groupForm, draw_count: event.target.value })
                                }
                                style={inputStyle}
                              />
                            </label>
                            <label style={labelStyle}>
                              Points per selected question
                              <input
                                type="number"
                                min="0.1"
                                step="0.1"
                                required
                                value={groupForm.points_per_question}
                                onChange={(event) =>
                                  setGroupForm({
                                    ...groupForm,
                                    points_per_question: event.target.value,
                                  })
                                }
                                style={inputStyle}
                              />
                            </label>
                          </div>
                          <Button
                            type="submit"
                            disabled={saving || questionBanks.length === 0}
                          >
                            Add Random Group
                          </Button>
                          {questionBanks.length === 0 ? (
                            <p style={mutedStyle}>
                              Create a question bank for this course before adding a random group.
                            </p>
                          ) : null}
                        </form>
                      ) : null}
                    </div>

                    {assessment.status === "draft" ? (
                    <form onSubmit={saveQuestion} style={cardStyle}>
                      <h3 style={{ marginTop: 0 }}>
                        {editingQuestionId ? "Edit Question" : "Add Question"}
                      </h3>
                      <div style={twoColumnStyle}>
                        <label style={labelStyle}>
                          Question type
                          <select
                            value={questionForm.question_type}
                            onChange={(event) => changeQuestionType(event.target.value)}
                            style={inputStyle}
                          >
                            <option value="multiple_choice">Multiple Choice</option>
                            <option value="true_false">True / False</option>
                            <option value="short_answer">Short Answer</option>
                            <option value="essay">Essay</option>
                          </select>
                        </label>
                        <label style={labelStyle}>
                          Points
                          <input
                            type="number"
                            min="0.1"
                            step="0.1"
                            value={questionForm.points}
                            onChange={(event) => setQuestionForm({ ...questionForm, points: event.target.value })}
                            style={inputStyle}
                          />
                        </label>
                      </div>
                      <label style={labelStyle}>
                        Question
                        <textarea
                          required
                          rows="4"
                          value={questionForm.prompt}
                          onChange={(event) => setQuestionForm({ ...questionForm, prompt: event.target.value })}
                          style={inputStyle}
                        />
                      </label>

                      {questionForm.question_type === "multiple_choice" ? (
                        <div style={{ display: "grid", gap: "10px" }}>
                          <strong>Answer choices</strong>
                          {questionForm.options.map((option, index) => (
                            <div key={index} style={{ display: "flex", gap: "8px" }}>
                              <input
                                value={option}
                                onChange={(event) => {
                                  const options = [...questionForm.options];
                                  options[index] = event.target.value;
                                  setQuestionForm({ ...questionForm, options });
                                }}
                                style={inputStyle}
                                placeholder={`Choice ${index + 1}`}
                              />
                              {questionForm.options.length > 2 ? (
                                <Button
                                  danger
                                  quiet
                                  onClick={() =>
                                    setQuestionForm({
                                      ...questionForm,
                                      options: questionForm.options.filter((_, itemIndex) => itemIndex !== index),
                                    })
                                  }
                                >
                                  Remove
                                </Button>
                              ) : null}
                            </div>
                          ))}
                          <Button
                            quiet
                            onClick={() =>
                              setQuestionForm({
                                ...questionForm,
                                options: [...questionForm.options, ""],
                              })
                            }
                          >
                            + Add Choice
                          </Button>
                          <label style={labelStyle}>
                            Correct answer
                            <select
                              value={questionForm.correct_answer}
                              onChange={(event) =>
                                setQuestionForm({ ...questionForm, correct_answer: event.target.value })
                              }
                              style={inputStyle}
                            >
                              <option value="">Select correct answer</option>
                              {questionForm.options.filter(Boolean).map((option) => (
                                <option key={option} value={option}>{option}</option>
                              ))}
                            </select>
                          </label>
                        </div>
                      ) : null}

                      {questionForm.question_type === "true_false" ? (
                        <label style={labelStyle}>
                          Correct answer
                          <select
                            value={questionForm.correct_answer}
                            onChange={(event) =>
                              setQuestionForm({ ...questionForm, correct_answer: event.target.value })
                            }
                            style={inputStyle}
                          >
                            <option value="True">True</option>
                            <option value="False">False</option>
                          </select>
                        </label>
                      ) : null}

                      <label style={labelStyle}>
                        Feedback shown after grading (optional)
                        <textarea
                          rows="2"
                          value={questionForm.teacher_feedback}
                          onChange={(event) =>
                            setQuestionForm({ ...questionForm, teacher_feedback: event.target.value })
                          }
                          style={inputStyle}
                        />
                      </label>
                      <div style={actionRowStyle}>
                        <Button type="submit" disabled={saving}>
                          {editingQuestionId ? "Save Question" : "Add Question"}
                        </Button>
                        {editingQuestionId ? (
                          <Button
                            quiet
                            onClick={() => {
                              setEditingQuestionId("");
                              setQuestionForm(EMPTY_QUESTION);
                            }}
                          >
                            Cancel
                          </Button>
                        ) : null}
                      </div>
                    </form>
                    ) : (
                      <div style={noticeStyle}>
                        Published questions are locked to protect active and completed student attempts.
                      </div>
                    )}
                  </>
                ) : null}

                {view === "preview" ? (
                  <div style={cardStyle}>
                    <div style={rowBetweenStyle}>
                      <div>
                        <h2 style={{ margin: 0 }}>{form.title}</h2>
                        <p style={mutedStyle}>{selectedCourse?.title || assessment.course_title}</p>
                      </div>
                      <StatusPill>Student Preview</StatusPill>
                    </div>
                    <div style={instructionsStyle}>
                      {form.instructions || "No instructions provided."}
                    </div>
                    <div style={metaGridStyle}>
                      <div><strong>Available:</strong><br />{formatDate(form.available_from)}</div>
                      <div><strong>Due:</strong><br />{formatDate(form.due_at)}</div>
                      <div><strong>Points:</strong><br />{pointsPossible.toFixed(1)}</div>
                    </div>
                    <div style={{ display: "grid", gap: "14px" }}>
                      {questions.map((question, index) => (
                        <QuestionPreview key={question.id} question={question} number={index + 1} />
                      ))}
                      {questionGroups.map((group) => (
                        <div key={group.id} style={noticeStyle}>
                          <strong>{group.title}</strong>
                          <div>
                            Each student receives {group.draw_count} randomly selected questions
                            from {group.bank_title} when the assessment begins.
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {view === "grade" ? (
                  <div style={gradingGridStyle}>
                    <div style={cardStyle}>
                      <h3 style={{ marginTop: 0 }}>Student Attempts</h3>
                      {attempts.length === 0 ? (
                        <p style={mutedStyle}>No student attempts yet.</p>
                      ) : (
                        attempts.map((attempt) => (
                          <button
                            type="button"
                            key={attempt.id}
                            style={libraryItemStyle(selectedAttempt?.id === attempt.id)}
                            onClick={() => openAttempt(attempt)}
                          >
                            <strong>{attempt.student_name || attempt.student_email}</strong>
                            <span>
                              Attempt {attempt.attempt_number || 1} — {attempt.status}
                            </span>
                            <span>
                              {attempt.score_percent === null
                                ? "Needs grading"
                                : `${Number(attempt.score_percent).toFixed(1)}%`}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                    <div style={cardStyle}>
                      {!selectedAttempt ? (
                        <p style={mutedStyle}>Select a student attempt to review it.</p>
                      ) : (
                        <>
                          <h3 style={{ marginTop: 0 }}>Grade Attempt</h3>
                          {attemptQuestions.map((question, index) => {
                            const answer = selectedAttempt.answers_json?.[String(question.id)] ?? "";
                            const isManual = !["multiple_choice", "true_false"].includes(question.question_type);
                            return (
                              <div key={question.id} style={gradingQuestionStyle}>
                                <strong>{index + 1}. {question.prompt}</strong>
                                <div style={studentAnswerStyle}>
                                  <span style={mutedStyle}>Student response</span>
                                  <div style={{ whiteSpace: "pre-wrap" }}>{String(answer) || "No response"}</div>
                                </div>
                                {isManual ? (
                                  <label style={labelStyle}>
                                    Points earned (out of {question.points})
                                    <input
                                      type="number"
                                      min="0"
                                      max={question.points}
                                      step="0.1"
                                      value={manualScores[String(question.id)] ?? ""}
                                      onChange={(event) =>
                                        setManualScores({
                                          ...manualScores,
                                          [String(question.id)]: event.target.value,
                                        })
                                      }
                                      style={{ ...inputStyle, maxWidth: "180px" }}
                                    />
                                  </label>
                                ) : (
                                  <div style={mutedStyle}>Automatically scored</div>
                                )}
                              </div>
                            );
                          })}
                          <label style={labelStyle}>
                            Overall feedback
                            <textarea
                              rows="4"
                              value={teacherFeedback}
                              onChange={(event) => setTeacherFeedback(event.target.value)}
                              style={inputStyle}
                            />
                          </label>
                          <div style={actionRowStyle}>
                            <Button onClick={saveGrade} disabled={saving}>
                              Save Grade to Gradebook
                            </Button>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={reopenMinutes}
                              onChange={(event) => setReopenMinutes(event.target.value)}
                              aria-label="Reopen minutes"
                              style={{ ...inputStyle, maxWidth: "150px" }}
                            />
                            <Button quiet onClick={reopenAttempt} disabled={saving}>
                              Reopen Attempt
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                    <div style={{ ...cardStyle, gridColumn: "1 / -1" }}>
                      <h3 style={{ marginTop: 0 }}>Assessment History</h3>
                      {auditEvents.length === 0 ? (
                        <p style={mutedStyle}>No recorded assessment events yet.</p>
                      ) : (
                        <div style={{ display: "grid", gap: "8px" }}>
                          {auditEvents.map((event) => (
                            <div key={event.id} style={compactQuestionStyle}>
                              <strong>{event.event_type.replaceAll("_", " ")}</strong>
                              <span>
                                {event.student_name || "Assessment"} —{" "}
                                {formatDate(event.created_at)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </main>
        </div>
      </section>
    </div>
  );
}

const mutedStyle = { color: "#64748b", lineHeight: 1.5, margin: "6px 0" };
const rowBetweenStyle = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" };
const actionRowStyle = { display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" };
const workspaceGridStyle = { display: "grid", gridTemplateColumns: "minmax(230px, 300px) minmax(0, 1fr)", gap: "20px", alignItems: "start" };
const gradingGridStyle = { display: "grid", gridTemplateColumns: "minmax(220px, 300px) minmax(0, 1fr)", gap: "18px", alignItems: "start" };
const twoColumnStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "14px" };
const metaGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px", margin: "18px 0" };
const sidebarStyle = { border: "1px solid #dbe3ee", borderRadius: "14px", padding: "14px", display: "grid", gap: "10px", background: "#f8fafc", position: "sticky", top: "16px" };
const cardStyle = { border: "1px solid #dbe3ee", borderRadius: "14px", padding: "20px", background: "#fff", display: "grid", gap: "14px" };
const questionCardStyle = { border: "1px solid #dbe3ee", borderRadius: "12px", padding: "16px", background: "#fff" };
const compactQuestionStyle = { border: "1px solid #e2e8f0", borderRadius: "10px", padding: "12px", display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" };
const gradingQuestionStyle = { borderBottom: "1px solid #e2e8f0", paddingBottom: "16px", display: "grid", gap: "10px" };
const studentAnswerStyle = { border: "1px solid #dbe3ee", background: "#f8fafc", borderRadius: "10px", padding: "12px", display: "grid", gap: "6px" };
const instructionsStyle = { whiteSpace: "pre-wrap", lineHeight: 1.6, border: "1px solid #dbe3ee", background: "#f8fafc", borderRadius: "10px", padding: "14px" };
const choiceStyle = { border: "1px solid #e2e8f0", padding: "10px", borderRadius: "9px" };
const inputStyle = { width: "100%", boxSizing: "border-box", border: "1px solid #cbd5e1", borderRadius: "9px", padding: "10px 12px", font: "inherit", background: "#fff" };
const labelStyle = { display: "grid", gap: "6px", fontWeight: 700 };
const tabRowStyle = { display: "flex", gap: "8px", flexWrap: "wrap", borderBottom: "1px solid #e2e8f0", paddingBottom: "12px" };
const statusPillStyle = { display: "inline-flex", width: "fit-content", border: "1px solid #cbd5e1", borderRadius: "999px", padding: "3px 9px", fontSize: "0.78rem", fontWeight: 800, textTransform: "uppercase", background: "#f8fafc" };
const noticeStyle = { border: "1px solid #93c5fd", background: "#eff6ff", color: "#1e3a8a", padding: "12px 14px", borderRadius: "10px" };
const errorStyle = { border: "1px solid #fca5a5", background: "#fff1f2", color: "#9f1239", padding: "12px 14px", borderRadius: "10px" };

function libraryItemStyle(active) {
  return {
    width: "100%",
    textAlign: "left",
    border: active ? "2px solid #2563eb" : "1px solid #dbe3ee",
    borderRadius: "10px",
    padding: "11px",
    background: active ? "#eff6ff" : "#fff",
    display: "grid",
    gap: "4px",
    cursor: "pointer",
    font: "inherit",
  };
}

function buttonStyle({ disabled, quiet, danger }) {
  return {
    border: danger ? "1px solid #ef4444" : "1px solid #2563eb",
    borderRadius: "9px",
    padding: "9px 13px",
    background: quiet ? "#fff" : danger ? "#dc2626" : "#2563eb",
    color: quiet ? (danger ? "#b91c1c" : "#1d4ed8") : "#fff",
    fontWeight: 800,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
  };
}
