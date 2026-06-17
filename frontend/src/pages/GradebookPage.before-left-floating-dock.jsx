import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

const API_BASE = "http://localhost:3000";
const QUICK_SCORES = [1, 2, 3, 4, 5, 6];

function formatPercent(value) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return "—";
  return `${numberValue.toFixed(1)}%`;
}

function getProficiency(value) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return "Not graded";
  if (numberValue >= 86) return "Extending";
  if (numberValue >= 73) return "Proficient";
  if (numberValue >= 60) return "Developing";
  return "Emerging";
}

function getDraftKey(studentEmail, assignmentId) {
  return `${studentEmail}:${assignmentId}`;
}

function getExistingKdu(match) {
  const rubric = match?.rubric_selection || {};
  return {
    doScore: rubric.DO ?? rubric.doScore ?? "",
    knowScore: rubric.KNOW ?? rubric.knowScore ?? "",
    understandScore: rubric.UNDERSTAND ?? rubric.understandScore ?? "",
  };
}

function hasCompleteKduScores(draft) {
  return draft.doScore !== "" && draft.knowScore !== "" && draft.understandScore !== "";
}

function QuickScoreRow({ label, value, onChange, onBlur }) {
  return (
    <>
      <div style={floatingPageNavWrapStyle}>
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          style={floatingPageNavButtonStyle}
        >
          ↑ Top
        </button>

        <button
          type="button"
          onClick={() =>
            window.scrollTo({
              top: document.body.scrollHeight,
              behavior: "smooth",
            })
          }
          style={floatingPageNavButtonStyle}
        >
          ↓ Bottom
        </button>
      </div>

    <div style={{ display: "grid", gap: "6px" }}>
      <div style={{ fontWeight: 700 }}>{label}</div>

      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
        {QUICK_SCORES.map((score) => (
          <button
            key={score}
            type="button"
            className="secondary-button"
            style={{
              padding: "5px 8px",
              minWidth: "32px",
              border:
                Number(value) === score
                  ? "2px solid #111827"
                  : "1px solid #cbd5e1",
            }}
            onClick={() => onChange(String(score), true)}
          >
            {score}
          </button>
        ))}
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        Decimal
        <input
          type="number"
          min="1"
          max="6"
          step="0.1"
          value={value}
          onChange={(event) => onChange(event.target.value, false)}
          onBlur={onBlur}
          className="form-input"
          style={{ width: "90px" }}
        />
      </label>
    </div>
  );
    </>
  );
}

export default function GradebookPage() {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const requestedClassId = queryParams.get("classId") || "13";

  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState(requestedClassId);
  const [gradebook, setGradebook] = useState(null);
  const [status, setStatus] = useState("Loading classes...");
  const [draftScores, setDraftScores] = useState({});
  const [savingKey, setSavingKey] = useState("");
  const [cellSaveStatus, setCellSaveStatus] = useState({});
  const autosaveTimersRef = useRef({});

  async function loadCourses() {
    try {
      const response = await fetch(`${API_BASE}/api/classes`);
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Failed to load classes");

      setCourses(Array.isArray(data) ? data : []);
      setStatus("");
    } catch (error) {
      console.error(error);
      setCourses([]);
      setStatus(error.message || "Failed to load classes");
    }
  }

  async function loadKduGradebook(courseId) {
    if (!courseId) {
      setGradebook(null);
      return;
    }

    setStatus("Loading KDU gradebook...");

    try {
      const response = await fetch(
        `${API_BASE}/api/classes/${courseId}/kdu-gradebook`
      );
      const data = await response.json();

      if (!response.ok)
        throw new Error(data.error || "Failed to load KDU gradebook");

      setGradebook(data);
      setStatus("");
    } catch (error) {
      console.error(error);
      setGradebook(null);
      setStatus(error.message || "Failed to load KDU gradebook");
    }
  }

  function buildDraft(studentEmail, assignmentId, field, value) {
    const key = getDraftKey(studentEmail, assignmentId);

    const currentDraft = draftScores[key] || {};
    const currentStudent = (gradebook?.students || []).find(
      (student) => student.student_email === studentEmail
    );
    const currentAssignment = (gradebook?.assignments || []).find(
      (assignment) => assignment.id === assignmentId
    );
    const currentMatch = (currentStudent?.assignment_scores || []).find(
      (item) => item.assignment_id === assignmentId
    );
    const existing = getExistingKdu(currentMatch);

    return {
      doScore:
        field === "doScore"
          ? value
          : currentDraft.doScore ?? existing.doScore,
      knowScore:
        field === "knowScore"
          ? value
          : currentDraft.knowScore ?? existing.knowScore,
      understandScore:
        field === "understandScore"
          ? value
          : currentDraft.understandScore ?? existing.understandScore,
      student: currentStudent,
      assignment: currentAssignment,
      match: currentMatch,
    };
  }

  function updateDraft(studentEmail, assignmentId, field, value, shouldAutosave) {
    const key = getDraftKey(studentEmail, assignmentId);

    setDraftScores((current) => ({
      ...current,
      [key]: {
        ...(current[key] || {}),
        [field]: value,
      },
    }));

    setCellSaveStatus((current) => ({
      ...current,
      [key]: shouldAutosave ? "Queued save..." : "Editing...",
    }));

    if (shouldAutosave) {
      const nextDraft = buildDraft(studentEmail, assignmentId, field, value);

      if (!hasCompleteKduScores(nextDraft)) {
        setCellSaveStatus((current) => ({
          ...current,
          [key]: "Needs DO, KNOW, and UNDERSTAND",
        }));
        return;
      }

      scheduleAutosave(key, nextDraft);
    }
  }

  function scheduleAutosave(key, nextDraft) {
    if (autosaveTimersRef.current[key]) {
      clearTimeout(autosaveTimersRef.current[key]);
    }

    autosaveTimersRef.current[key] = setTimeout(() => {
      saveKduScore(nextDraft.student, nextDraft.assignment, nextDraft.match, nextDraft);
    }, 450);
  }

  function getCellDraft(student, assignment, match) {
    const key = getDraftKey(student.student_email, assignment.id);
    const existing = getExistingKdu(match);
    const draft = draftScores[key] || {};

    return {
      doScore: draft.doScore ?? existing.doScore,
      knowScore: draft.knowScore ?? existing.knowScore,
      understandScore: draft.understandScore ?? existing.understandScore,
    };
  }

  async function saveKduScore(student, assignment, match, overrideDraft = null) {
    if (!student || !assignment) return;

    const key = getDraftKey(student.student_email, assignment.id);
    const draft = overrideDraft || getCellDraft(student, assignment, match);

    if (!hasCompleteKduScores(draft)) {
      setStatus("Enter DO, KNOW, and UNDERSTAND before saving.");
      setCellSaveStatus((current) => ({
        ...current,
        [key]: "Needs DO, KNOW, and UNDERSTAND",
      }));
      return;
    }

    setSavingKey(key);
    setCellSaveStatus((current) => ({
      ...current,
      [key]: "Saving...",
    }));
    setStatus(`Auto-saving KDU score for ${student.student_name}...`);

    try {
      const response = await fetch(
        `${API_BASE}/api/assignments/${assignment.id}/kdu-scores`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            student_email: student.student_email,
            doScore: Number(draft.doScore),
            knowScore: Number(draft.knowScore),
            understandScore: Number(draft.understandScore),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Failed to save KDU score");

      setStatus(`Saved KDU score for ${student.student_name}.`);
      setCellSaveStatus((current) => ({
        ...current,
        [key]: "Saved ✓",
      }));
      await loadKduGradebook(selectedCourseId);
    } catch (error) {
      console.error(error);
      setStatus(error.message || "Failed to save KDU score");
      setCellSaveStatus((current) => ({
        ...current,
        [key]: "Save failed",
      }));
    } finally {
      setSavingKey("");
    }
  }

  useEffect(() => {
    loadCourses();
  }, []);

  useEffect(() => {
    loadKduGradebook(selectedCourseId);
  }, [selectedCourseId]);

  useEffect(() => {
    return () => {
      Object.values(autosaveTimersRef.current).forEach((timer) =>
        clearTimeout(timer)
      );
    };
  }, []);

  const assignments = gradebook?.assignments || [];
  const students = gradebook?.students || [];
  const assessmentGroups = gradebook?.assessment_groups || [];

  const groupedAssignments = useMemo(() => {
    const groups = [];

    assessmentGroups.forEach((group) => {
      groups.push({
        key: `group-${group.category_id}-${group.subcategory_id}`,
        groupName: group.category_name || "Assessment Group",
        bucketName: group.subcategory_name || "KDU Rubric Assessments",
        courseWeight: group.course_weight_percent,
        assignments: assignments.filter(
          (assignment) =>
            String(assignment.category_id || "") === String(group.category_id || "")
        ),
      });
    });

    assignments.forEach((assignment) => {
      const alreadyGrouped = groups.some((group) =>
        group.assignments.some((item) => item.id === assignment.id)
      );

      if (!alreadyGrouped) {
        let fallbackGroup = groups.find((group) => group.key === "ungrouped");

        if (!fallbackGroup) {
          fallbackGroup = {
            key: "ungrouped",
            groupName: "Ungrouped Assignments",
            bucketName: "No assessment group",
            courseWeight: null,
            assignments: [],
          };
          groups.push(fallbackGroup);
        }

        fallbackGroup.assignments.push(assignment);
      }
    });

    return groups.filter((group) => group.assignments.length > 0);
  }, [assignments, assessmentGroups]);

  const classSummary = useMemo(() => {
    const gradedStudents = students.filter((student) =>
      Number.isFinite(Number(student.current_percent))
    );

    return {
      classAverage:
        gradedStudents.length === 0
          ? null
          : gradedStudents.reduce(
              (sum, student) => sum + Number(student.current_percent),
              0
            ) / gradedStudents.length,
      extending: students.filter((student) => getProficiency(student.current_percent) === "Extending").length,
      proficient: students.filter((student) => getProficiency(student.current_percent) === "Proficient").length,
      developing: students.filter((student) => getProficiency(student.current_percent) === "Developing").length,
      emerging: students.filter((student) => getProficiency(student.current_percent) === "Emerging").length,
      notGraded: students.filter((student) => getProficiency(student.current_percent) === "Not graded").length,
      gradedCount: gradedStudents.length,
      totalCount: students.length,
    };
  }, [students]);

  return (
    <div className="content-area">
      <section className="panel">
        <div className="section-header">
          <div>
            <h2>KDU Course Gradebook</h2>
            <p className="section-subtitle">
              Click whole-score buttons for fast grading, or enter decimals for precision.
            </p>
          </div>
        </div>

        <div className="form-stack">
          <div className="form-field" style={{ maxWidth: "420px" }}>
            <label htmlFor="gradebook-class-select" className="form-label">
              Select Class
            </label>
            <select
              id="gradebook-class-select"
              value={selectedCourseId}
              onChange={(event) => setSelectedCourseId(event.target.value)}
              className="form-input"
            >
              <option value="">Choose a class</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.class_name || course.title}
                </option>
              ))}
            </select>
          </div>

          {status ? <p className="form-message">{status}</p> : null}
        </div>
      </section>

      {gradebook ? (
        <>
          <section className="panel">
            <h2>Class Summary</h2>
            <p className="section-subtitle">
              Quick view of how the class is doing based on currently graded work.
            </p>

            <div className="summary-grid">
              <div className="summary-card">
                <strong>Class Average:</strong> {formatPercent(classSummary.classAverage)}
                <div>Assessment Groups: {assessmentGroups.length}</div>
              </div>
              <div className="summary-card">
                <strong>Graded Students:</strong> {classSummary.gradedCount} / {classSummary.totalCount}
                <div>Assignments: {assignments.length}</div>
              </div>
              <div className="summary-card">
                <strong>Model:</strong> Assessment Group → Assignment → KDU → Course
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
                gap: "10px",
                marginTop: "14px",
              }}
            >
              <div className="summary-card">Extending<br /><strong>{classSummary.extending}</strong></div>
              <div className="summary-card">Proficient<br /><strong>{classSummary.proficient}</strong></div>
              <div className="summary-card">Developing<br /><strong>{classSummary.developing}</strong></div>
              <div className="summary-card">Emerging<br /><strong>{classSummary.emerging}</strong></div>
              <div className="summary-card">Not graded<br /><strong>{classSummary.notGraded}</strong></div>
            </div>
          </section>

          <section className="panel">
            <h2>Assessment Groups</h2>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Assessment Group</th>
                    <th>Assignment Bucket</th>
                    <th>Course Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {assessmentGroups.map((group) => (
                    <tr key={`${group.category_id}-${group.subcategory_id}`}>
                      <td>{group.category_name}</td>
                      <td>{group.subcategory_name}</td>
                      <td>{formatPercent(group.course_weight_percent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel">
            <h2>Student Course Standing</h2>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Graded Weight</th>
                    <th>Earned Course Points</th>
                    <th>Current %</th>
                    <th>Proficiency</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => (
                    <tr key={student.student_user_id}>
                      <td>
                        <strong>{student.student_name}</strong>
                        <div style={{ fontSize: "0.9rem" }}>
                          {student.student_email}
                        </div>
                      </td>
                      <td>{formatPercent(student.graded_weight_percent)}</td>
                      <td>{formatPercent(student.earned_course_points)}</td>
                      <td>
                        <strong>{formatPercent(student.current_percent)}</strong>
                      </td>
                      <td>{getProficiency(student.current_percent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel">
            <h2>Assignment KDU Scores by Assessment Group</h2>
            <p className="section-subtitle">
              Assignments are grouped under the real course assessment groups. Each assignment still uses DO / KNOW / UNDERSTAND scoring.
            </p>

            <div style={{ display: "grid", gap: "22px" }}>
              {groupedAssignments.map((group) => (
                <div
                  key={group.key}
                  style={{
                    border: "1px solid #d7dce5",
                    borderRadius: "14px",
                    background: "#ffffff",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      padding: "16px",
                      borderBottom: "1px solid #e5e7eb",
                      background: "#f8fafc",
                    }}
                  >
                    <h3 style={{ margin: 0, fontSize: "1.15rem" }}>
                      {group.groupName}
                    </h3>
                    <div style={{ marginTop: "6px", color: "#4b5563" }}>
                      Bucket: {group.bucketName} • Course Weight: {formatPercent(group.courseWeight)}
                    </div>
                  </div>

                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Student</th>
                          {group.assignments.map((assignment) => (
                            <th key={assignment.id}>
                              {assignment.title}
                              <div style={{ fontSize: "0.85rem", fontWeight: 500 }}>
                                {assignment.category_name || "No group"}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {students.map((student) => (
                          <tr key={student.student_user_id}>
                            <td>
                              <strong>{student.student_name}</strong>
                            </td>

                            {group.assignments.map((assignment) => {
                              const match = (student.assignment_scores || []).find(
                                (item) => item.assignment_id === assignment.id
                              );

                              const draft = getCellDraft(student, assignment, match);
                              const key = getDraftKey(
                                student.student_email,
                                assignment.id
                              );

                              return (
                                <td key={assignment.id} style={{ minWidth: "260px" }}>
                                  <div style={{ fontWeight: 700, marginBottom: "10px" }}>
                                    Saved: {formatPercent(match?.score)}
                                  </div>

                                  <div style={{ display: "grid", gap: "14px" }}>
                                    <QuickScoreRow
                                      label="DO"
                                      value={draft.doScore}
                                      onChange={(value, shouldAutosave) =>
                                        updateDraft(
                                          student.student_email,
                                          assignment.id,
                                          "doScore",
                                          value,
                                          shouldAutosave
                                        )
                                      }
                                      onBlur={() =>
                                        saveKduScore(student, assignment, match)
                                      }
                                    />

                                    <QuickScoreRow
                                      label="KNOW"
                                      value={draft.knowScore}
                                      onChange={(value, shouldAutosave) =>
                                        updateDraft(
                                          student.student_email,
                                          assignment.id,
                                          "knowScore",
                                          value,
                                          shouldAutosave
                                        )
                                      }
                                      onBlur={() =>
                                        saveKduScore(student, assignment, match)
                                      }
                                    />

                                    <QuickScoreRow
                                      label="UNDERSTAND"
                                      value={draft.understandScore}
                                      onChange={(value, shouldAutosave) =>
                                        updateDraft(
                                          student.student_email,
                                          assignment.id,
                                          "understandScore",
                                          value,
                                          shouldAutosave
                                        )
                                      }
                                      onBlur={() =>
                                        saveKduScore(student, assignment, match)
                                      }
                                    />

                                    <div style={{ fontSize: "0.9rem", fontWeight: 700 }}>
                                      {savingKey === key
                                        ? "Saving..."
                                        : cellSaveStatus[key] || "Auto-save ready"}
                                    </div>
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}


const floatingPageNavWrapStyle = {
  position: "fixed",
  right: "16px",
  bottom: "20px",
  zIndex: 25,
  display: "grid",
  gap: "10px",
};

const floatingPageNavButtonStyle = {
  padding: "12px 14px",
  borderRadius: "12px",
  border: "2px solid #111",
  background: "#ffffff",
  color: "#111",
  fontSize: "15px",
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 4px 12px rgba(0,0,0,0.14)",
  minWidth: "110px",
};
