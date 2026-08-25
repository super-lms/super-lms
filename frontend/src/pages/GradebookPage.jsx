import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import FloatingTeacherCoach from "../components/FloatingTeacherCoach.jsx";
import authFetch from "../services/authFetch";

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
  return (
    draft.doScore !== "" &&
    draft.knowScore !== "" &&
    draft.understandScore !== ""
  );
}

function makeSafeElementId(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function getStudentLastName(studentName) {
  const nameParts = String(studentName || "").trim().split(/\s+/).filter(Boolean);
  return nameParts.length > 0 ? nameParts[nameParts.length - 1] : "";
}

function isFocusedStudent(student, requestedStudentEmail, requestedStudentName) {
  const studentEmail = String(student?.student_email || "").toLowerCase();
  const studentName = String(student?.student_name || "").toLowerCase();
  const focusEmail = String(requestedStudentEmail || "").toLowerCase();
  const focusName = String(requestedStudentName || "").toLowerCase();

  return Boolean(
    (focusEmail && studentEmail === focusEmail) ||
      (focusName && studentName === focusName)
  );
}

function QuickScoreRow({
  label,
  value,
  onChange,
  onBlur,
  isFocused = false,
}) {
  return (
    <div style={isFocused ? focusedKduBoxStyle : { display: "grid", gap: "6px" }}>
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
}

export default function GradebookPage() {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const requestedClassId = queryParams.get("classId") || "13";
  const requestedContentClassId = queryParams.get("contentClassId") || requestedClassId;
  const requestedStudentEmail = queryParams.get("studentEmail") || "";
  const requestedStudentName = queryParams.get("studentName") || "";
  const requestedFocus = queryParams.get("focus") || "";

  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState(requestedClassId);
  const [gradebook, setGradebook] = useState(null);
  const [status, setStatus] = useState("Loading classes...");
  const [draftScores, setDraftScores] = useState({});
  const [savingKey, setSavingKey] = useState("");
  const [cellSaveStatus, setCellSaveStatus] = useState({});
  const [expandedCompetencyStudents, setExpandedCompetencyStudents] = useState({});
  const [selectedStudentEmail, setSelectedStudentEmail] = useState("");
  const [activeGradebookSection, setActiveGradebookSection] = useState("spreadsheet");
  const [spreadsheetStudentSort, setSpreadsheetStudentSort] = useState("first-name");
  const [spreadsheetAssignmentSort, setSpreadsheetAssignmentSort] = useState("due-date");
  const [spreadsheetCustomOrder, setSpreadsheetCustomOrder] = useState([]);
  const [draggedAssignmentId, setDraggedAssignmentId] = useState("");
  const [communicationType, setCommunicationType] = useState("progress-update");
  const [communicationRecipient, setCommunicationRecipient] = useState("parent");
  const [communicationNotes, setCommunicationNotes] = useState("");
  const autosaveTimersRef = useRef({});

  async function loadCourses() {
    try {
      const response = await authFetch("/api/classes");
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
      const response = await authFetch(
        `/api/classes/${courseId}/kdu-gradebook?contentClassId=${encodeURIComponent(requestedContentClassId)}`
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
      saveKduScore(
        nextDraft.student,
        nextDraft.assignment,
        nextDraft.match,
        nextDraft
      );
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
      const response = await authFetch(
        `/api/assignments/${assignment.id}/kdu-scores`,
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

  useEffect(() => {
    if (!selectedCourseId || assignments.length === 0) {
      setSpreadsheetCustomOrder([]);
      return;
    }

    const storageKey = `super-lms-gradebook-assignment-order:${selectedCourseId}`;
    let savedOrder = [];

    try {
      const parsedOrder = JSON.parse(window.localStorage.getItem(storageKey) || "[]");
      savedOrder = Array.isArray(parsedOrder) ? parsedOrder.map(String) : [];
    } catch {
      savedOrder = [];
    }

    const currentIds = assignments.map((assignment) => String(assignment.id));
    const reconciledOrder = [
      ...savedOrder.filter((assignmentId) => currentIds.includes(assignmentId)),
      ...currentIds.filter((assignmentId) => !savedOrder.includes(assignmentId)),
    ];

    setSpreadsheetCustomOrder(reconciledOrder);

    if (savedOrder.length > 0) {
      setSpreadsheetAssignmentSort("custom");
    }
  }, [selectedCourseId, gradebook?.assignments]);

  function toggleCompetencySnapshot(studentId) {
    setExpandedCompetencyStudents((current) => ({
      ...current,
      [studentId]: !current[studentId],
    }));
  }

  function getCommunicationTypeLabel(type) {
    if (type === "academic-concern") return "Academic Concern";
    if (type === "missing-work") return "Missing Work";
    if (type === "meeting-request") return "Parent Meeting Request";
    if (type === "intervention-update") return "Intervention Update";
    if (type === "custom") return "Custom Communication";
    return "Positive Progress Update";
  }

  function getStudentMissingAssignments(student) {
    return assignments.filter((assignment) => {
      const match = (student?.assignment_scores || []).find(
        (item) => item.assignment_id === assignment.id
      );

      return !match || match.score === null || match.score === undefined;
    });
  }

  function getStudentAssignmentSummary(student) {
    const graded = (student?.assignment_scores || []).filter((item) =>
      Number.isFinite(Number(item.score))
    );

    if (graded.length === 0) {
      return "No graded assignments yet.";
    }

    return graded
      .slice(0, 8)
      .map((item) => {
        const assignment = assignments.find((assignmentItem) => assignmentItem.id === item.assignment_id);
        return `${assignment?.title || assignment?.name || "Assignment"}: ${formatPercent(item.score)}`;
      })
      .join("\n");
  }

  function getStudentKduSummary(student) {
    const scored = (student?.assignment_scores || []).filter(
      (item) => item.rubric_selection
    );

    if (scored.length === 0) {
      return "No KDU evidence has been scored yet.";
    }

    return scored
      .slice(0, 8)
      .map((item) => {
        const assignment = assignments.find((assignmentItem) => assignmentItem.id === item.assignment_id);
        const rubric = item.rubric_selection || {};
        return `${assignment?.title || assignment?.name || "Assignment"}: KNOW ${rubric.KNOW ?? "—"}, DO ${rubric.DO ?? "—"}, UNDERSTAND ${rubric.UNDERSTAND ?? "—"}`;
      })
      .join("\n");
  }

  function createStudentCommunicationEmail(student) {
    if (!student) return;

    const communicationLabel = getCommunicationTypeLabel(communicationType);
    const missingAssignments = getStudentMissingAssignments(student);
    const selectedCourse =
      courses.find((course) => String(course.id) === String(selectedCourseId)) || null;

    const subject = `CBC Wenzhou - ${communicationLabel} - ${student.student_name}`;

    const bodyLines = [
      "Good afternoon,",
      "",
      `I am writing with a student progress update for ${student.student_name}.`,
      "",
      `Communication Type: ${communicationLabel}`,
      `Course: ${selectedCourse?.class_name || selectedCourse?.title || "Selected Course"}`,
      `Current Course Grade: ${formatPercent(student.current_percent)}`,
      `Current Proficiency: ${getProficiency(student.current_percent)}`,
      "",
      "Assignment Summary:",
      getStudentAssignmentSummary(student),
      "",
      "KDU Summary:",
      getStudentKduSummary(student),
      "",
      "Missing / Not Yet Graded Assignments:",
      missingAssignments.length === 0
        ? "None currently showing in the gradebook."
        : missingAssignments.map((assignment) => `- ${assignment.title || assignment.name || "Assignment"}`).join("\n"),
      "",
      "Additional Teacher Notes:",
      communicationNotes.trim() || "(Add comments here before sending.)",
      "",
      "Thank you,",
      "",
    ];

    const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyLines.join("\n"))}`;
    window.location.href = mailtoUrl;
  }

  const students = gradebook?.students || [];
  const spreadsheetStudents = useMemo(() => {
    return [...students].sort((studentA, studentB) => {
      const nameA =
        spreadsheetStudentSort === "last-name"
          ? getStudentLastName(studentA.student_name)
          : String(studentA.student_name || "");
      const nameB =
        spreadsheetStudentSort === "last-name"
          ? getStudentLastName(studentB.student_name)
          : String(studentB.student_name || "");

      return nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
    });
  }, [students, spreadsheetStudentSort]);

  const spreadsheetAssignments = useMemo(() => {
    if (spreadsheetAssignmentSort === "custom") {
      const assignmentById = new Map(
        assignments.map((assignment) => [String(assignment.id), assignment])
      );

      return spreadsheetCustomOrder
        .map((assignmentId) => assignmentById.get(String(assignmentId)))
        .filter(Boolean);
    }

    return [...assignments].sort((assignmentA, assignmentB) => {
      if (spreadsheetAssignmentSort === "title") {
        return String(assignmentA.title || "").localeCompare(
          String(assignmentB.title || ""),
          undefined,
          { sensitivity: "base" }
        );
      }

      if (spreadsheetAssignmentSort === "assessment-pathway") {
        const pathwayComparison = String(
          assignmentA.category_name || ""
        ).localeCompare(String(assignmentB.category_name || ""), undefined, {
          sensitivity: "base",
        });

        return pathwayComparison !== 0
          ? pathwayComparison
          : String(assignmentA.title || "").localeCompare(
              String(assignmentB.title || ""),
              undefined,
              { sensitivity: "base" }
            );
      }

      if (spreadsheetAssignmentSort === "assignment-weight") {
        return (
          Number(assignmentB.course_weight_percent || 0) -
          Number(assignmentA.course_weight_percent || 0)
        );
      }

      const dueDateA = assignmentA.due_date
        ? new Date(assignmentA.due_date).getTime()
        : Number.POSITIVE_INFINITY;
      const dueDateB = assignmentB.due_date
        ? new Date(assignmentB.due_date).getTime()
        : Number.POSITIVE_INFINITY;

      return dueDateA - dueDateB;
    });
  }, [assignments, spreadsheetAssignmentSort, spreadsheetCustomOrder]);

  function saveSpreadsheetCustomOrder(nextOrder) {
    const normalizedOrder = nextOrder.map(String);
    setSpreadsheetCustomOrder(normalizedOrder);
    setSpreadsheetAssignmentSort("custom");

    if (selectedCourseId) {
      window.localStorage.setItem(
        `super-lms-gradebook-assignment-order:${selectedCourseId}`,
        JSON.stringify(normalizedOrder)
      );
    }
  }

  function moveSpreadsheetAssignment(assignmentId, direction) {
    const currentOrder = spreadsheetAssignments.map((assignment) =>
      String(assignment.id)
    );
    const currentIndex = currentOrder.indexOf(String(assignmentId));
    const nextIndex = currentIndex + direction;

    if (
      currentIndex === -1 ||
      nextIndex < 0 ||
      nextIndex >= currentOrder.length
    ) {
      return;
    }

    const nextOrder = [...currentOrder];
    const [movedAssignmentId] = nextOrder.splice(currentIndex, 1);
    nextOrder.splice(nextIndex, 0, movedAssignmentId);
    saveSpreadsheetCustomOrder(nextOrder);
  }

  function dropSpreadsheetAssignment(targetAssignmentId) {
    if (!draggedAssignmentId || String(draggedAssignmentId) === String(targetAssignmentId)) {
      setDraggedAssignmentId("");
      return;
    }

    const currentOrder = spreadsheetAssignments.map((assignment) =>
      String(assignment.id)
    );
    const sourceIndex = currentOrder.indexOf(String(draggedAssignmentId));
    const targetIndex = currentOrder.indexOf(String(targetAssignmentId));

    if (sourceIndex === -1 || targetIndex === -1) {
      setDraggedAssignmentId("");
      return;
    }

    const nextOrder = [...currentOrder];
    const [movedAssignmentId] = nextOrder.splice(sourceIndex, 1);
    nextOrder.splice(targetIndex, 0, movedAssignmentId);
    saveSpreadsheetCustomOrder(nextOrder);
    setDraggedAssignmentId("");
  }

  const selectedStudent =
    students.find((student) => student.student_email === selectedStudentEmail) ||
    students[0] ||
    null;
  const selectedStudentCompetencyCount = selectedStudent?.group_breakdown?.length || 0;
  const assignmentCount = assignments.length;
  const assessmentGroups = gradebook?.assessment_groups || [];

  useEffect(() => {
    if (!gradebook || (!requestedStudentEmail && !requestedStudentName)) {
      return;
    }

    const targetKey = makeSafeElementId(requestedStudentEmail || requestedStudentName);
    const targetElement = document.getElementById(`student-standing-${targetKey}`);

    if (targetElement) {
      window.setTimeout(() => {
        targetElement.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 300);
    }
  }, [gradebook, requestedStudentEmail, requestedStudentName, requestedFocus]);

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
      extending: students.filter(
        (student) => getProficiency(student.current_percent) === "Extending"
      ).length,
      proficient: students.filter(
        (student) => getProficiency(student.current_percent) === "Proficient"
      ).length,
      developing: students.filter(
        (student) => getProficiency(student.current_percent) === "Developing"
      ).length,
      emerging: students.filter(
        (student) => getProficiency(student.current_percent) === "Emerging"
      ).length,
      notGraded: students.filter(
        (student) => getProficiency(student.current_percent) === "Not graded"
      ).length,
      gradedCount: gradedStudents.length,
      totalCount: students.length,
    };
  }, [students]);

  const gradebookCoachRecommendation = useMemo(() => {
    if (!selectedCourseId) {
      return {
        title: "Select a course",
        reason:
          "The gradebook needs a course before SUPER LMS can show student progress, competency evidence, or report readiness.",
        action:
          "Choose a course from the gradebook selector to load the class results.",
      };
    }

    if (!gradebook) {
      return {
        title: "Wait for gradebook data",
        reason:
          "SUPER LMS is still loading or has not received gradebook data for this course yet.",
        action:
          "Wait for the gradebook to finish loading. If no data appears, confirm the course has assignments and students.",
      };
    }

    if (classSummary.totalCount === 0) {
      return {
        title: "Check class enrollment",
        reason:
          "No students are showing in this gradebook. A teacher cannot review progress until students are enrolled.",
        action:
          "Go back to the course and confirm students are imported or enrolled.",
      };
    }

    if (classSummary.notGraded === classSummary.totalCount) {
      return {
        title: "Start grading evidence",
        reason:
          "Students are enrolled, but the gradebook does not yet show marked evidence.",
        action:
          "Open an assignment and enter raw marks or KDU scores so the gradebook can calculate progress.",
      };
    }

    if (classSummary.developing + classSummary.emerging > 0) {
      return {
        title: "Review students needing support",
        reason:
          "Some students are currently Developing or Emerging. These students may need feedback, reassessment, or parent communication.",
        action:
          "Use the student rows and competency snapshot to identify which evidence areas need attention.",
      };
    }

    return {
      title: "Review report readiness",
      reason:
        "The class has graded evidence and most students are showing stable progress.",
      action:
        "Review competency patterns, check any missing evidence, and use the gradebook to prepare report comments or parent updates.",
    };
  }, [selectedCourseId, gradebook, classSummary]);

  return (
    <>
    <div className="content-area">
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

          <div className="form-field" style={{ maxWidth: "420px" }}>
            <label htmlFor="gradebook-section-select" className="form-label">
              Gradebook View
            </label>
            <select
              id="gradebook-section-select"
              value={activeGradebookSection}
              onChange={(event) => setActiveGradebookSection(event.target.value)}
              className="form-input"
            >
              <option value="summary">Class Summary</option>
              <option value="assessment-groups">Assessment Groups</option>
              <option value="spreadsheet">Spreadsheet Gradebook</option>
              <option value="student-standing">Student Course Standing</option>
              <option value="selected-student">Selected Student Detail</option>
              <option value="assignment-kdu">Assignment KDU Scores</option>
              <option value="assignment-test-mark-entry">Assignment / Test Mark Entry</option>
            </select>
          </div>

          {status ? <p className="form-message">{status}</p> : null}

          {(requestedStudentEmail || requestedStudentName) ? (
            <div style={focusNoticeStyle}>
              Heatmap focus loaded:{" "}
              <strong>{requestedStudentName || requestedStudentEmail}</strong>
              {requestedFocus ? (
                <>
                  {" "}
                  • Competency: <strong>{requestedFocus}</strong>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      {gradebook ? (
        <>
          {activeGradebookSection === "summary" ? (
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
              <div className="summary-card">
                Extending<br /><strong>{classSummary.extending}</strong>
              </div>
              <div className="summary-card">
                Proficient<br /><strong>{classSummary.proficient}</strong>
              </div>
              <div className="summary-card">
                Developing<br /><strong>{classSummary.developing}</strong>
              </div>
              <div className="summary-card">
                Emerging<br /><strong>{classSummary.emerging}</strong>
              </div>
              <div className="summary-card">
                Not graded<br /><strong>{classSummary.notGraded}</strong>
              </div>
            </div>
          </section>
          ) : null}

          {activeGradebookSection === "assessment-groups" ? (
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
          ) : null}

          {activeGradebookSection === "spreadsheet" ? (
          <section className="panel">
            <h2>Spreadsheet Gradebook</h2>
            <p className="section-subtitle">
              Scroll horizontally to review assignments. Select an assignment heading to open it in Speed Grading.
            </p>

            <div style={spreadsheetToolbarStyle}>
              <details style={spreadsheetMenuStyle}>
                <summary style={spreadsheetMenuSummaryStyle}>View</summary>
                <div style={spreadsheetMenuPanelStyle}>
                  <div style={spreadsheetMenuHeadingStyle}>Arrange assignments by</div>
                  {spreadsheetCustomOrder.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setSpreadsheetAssignmentSort("custom")}
                      style={spreadsheetMenuButtonStyle}
                    >
                      {spreadsheetAssignmentSort === "custom" ? "✓ " : ""}Custom Order
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setSpreadsheetAssignmentSort("due-date")}
                    style={spreadsheetMenuButtonStyle}
                  >
                    {spreadsheetAssignmentSort === "due-date" ? "✓ " : ""}Due Date
                  </button>
                  <button
                    type="button"
                    onClick={() => setSpreadsheetAssignmentSort("title")}
                    style={spreadsheetMenuButtonStyle}
                  >
                    {spreadsheetAssignmentSort === "title" ? "✓ " : ""}Assignment Title
                  </button>
                  <button
                    type="button"
                    onClick={() => setSpreadsheetAssignmentSort("assignment-weight")}
                    style={spreadsheetMenuButtonStyle}
                  >
                    {spreadsheetAssignmentSort === "assignment-weight" ? "✓ " : ""}Assignment Weight
                  </button>
                  <button
                    type="button"
                    onClick={() => setSpreadsheetAssignmentSort("assessment-pathway")}
                    style={spreadsheetMenuButtonStyle}
                  >
                    {spreadsheetAssignmentSort === "assessment-pathway" ? "✓ " : ""}Assessment Pathway
                  </button>
                </div>
              </details>

              <div style={spreadsheetSortStatusStyle}>
                Assignments arranged by:{" "}
                <strong>
                  {spreadsheetAssignmentSort === "due-date"
                    ? "Due Date"
                    : spreadsheetAssignmentSort === "title"
                      ? "Assignment Title"
                      : spreadsheetAssignmentSort === "assignment-weight"
                        ? "Assignment Weight"
                        : spreadsheetAssignmentSort === "assessment-pathway"
                          ? "Assessment Pathway"
                          : "Custom Order"}
                </strong>
              </div>
            </div>

            {assignments.length === 0 ? (
              <p>No assignments found for this course yet.</p>
            ) : (
              <div style={spreadsheetGradebookWrapStyle}>
                <table style={spreadsheetGradebookTableStyle}>
                  <thead>
                    <tr>
                      <th style={spreadsheetStudentHeaderStyle}>
                        <div style={spreadsheetStudentHeaderContentStyle}>
                          <span>Student</span>
                          <details style={spreadsheetStudentMenuStyle}>
                            <summary
                              style={spreadsheetStudentMenuSummaryStyle}
                              title="Sort student names"
                            >
                              ⋮
                            </summary>
                            <div style={spreadsheetStudentMenuPanelStyle}>
                              <button
                                type="button"
                                onClick={() => setSpreadsheetStudentSort("first-name")}
                                style={spreadsheetMenuButtonStyle}
                              >
                                {spreadsheetStudentSort === "first-name" ? "✓ " : ""}First Name
                              </button>
                              <button
                                type="button"
                                onClick={() => setSpreadsheetStudentSort("last-name")}
                                style={spreadsheetMenuButtonStyle}
                              >
                                {spreadsheetStudentSort === "last-name" ? "✓ " : ""}Last Name
                              </button>
                            </div>
                          </details>
                        </div>
                      </th>
                      {spreadsheetAssignments.map((assignment, assignmentIndex) => (
                        <th
                          key={assignment.id}
                          draggable
                          onDragStart={() => setDraggedAssignmentId(String(assignment.id))}
                          onDragEnd={() => setDraggedAssignmentId("")}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={() => dropSpreadsheetAssignment(assignment.id)}
                          style={{
                            ...spreadsheetAssignmentHeaderStyle,
                            ...(String(draggedAssignmentId) === String(assignment.id)
                              ? spreadsheetDraggingHeaderStyle
                              : {}),
                          }}
                        >
                          <div style={spreadsheetColumnMoveControlsStyle}>
                            <span style={spreadsheetDragHandleStyle} title="Drag to rearrange">
                              ↔ Drag
                            </span>
                            <button
                              type="button"
                              onClick={() => moveSpreadsheetAssignment(assignment.id, -1)}
                              disabled={assignmentIndex === 0}
                              style={spreadsheetMoveButtonStyle}
                              title="Move assignment left"
                            >
                              ←
                            </button>
                            <button
                              type="button"
                              onClick={() => moveSpreadsheetAssignment(assignment.id, 1)}
                              disabled={assignmentIndex === spreadsheetAssignments.length - 1}
                              style={spreadsheetMoveButtonStyle}
                              title="Move assignment right"
                            >
                              →
                            </button>
                          </div>
                          <button
                            type="button"
                            title={`Open ${assignment.title || "Untitled Assignment"} in Speed Grading`}
                            onClick={() => {
                              window.location.href = `/assignments/${assignment.id}/grade`;
                            }}
                            style={spreadsheetAssignmentButtonStyle}
                          >
                            {assignment.title || "Untitled Assignment"}
                          </button>
                          <div style={spreadsheetAssignmentMetaStyle}>
                            {assignment.due_date
                              ? `Due ${new Date(assignment.due_date).toLocaleDateString()}`
                              : "No due date"}
                          </div>
                          <div
                            style={spreadsheetAssignmentPathwayStyle}
                            title={assignment.category_name || "No assessment pathway"}
                          >
                            {assignment.category_name || "No assessment pathway"}
                          </div>
                        </th>
                      ))}
                      <th style={spreadsheetSummaryHeaderStyle}>Current Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {spreadsheetStudents.map((student) => (
                      <tr key={student.student_user_id}>
                        <td style={spreadsheetStudentCellStyle}>
                          <strong>{student.student_name}</strong>
                          <div style={spreadsheetStudentEmailStyle}>
                            {student.student_email}
                          </div>
                        </td>
                        {spreadsheetAssignments.map((assignment) => {
                          const match = (student.assignment_scores || []).find(
                            (item) => item.assignment_id === assignment.id
                          );

                          return (
                            <td key={assignment.id} style={spreadsheetScoreCellStyle}>
                              {formatPercent(match?.score)}
                            </td>
                          );
                        })}
                        <td style={spreadsheetSummaryCellStyle}>
                          <strong>{formatPercent(student.current_percent)}</strong>
                          <div>{getProficiency(student.current_percent)}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          ) : null}

          {activeGradebookSection === "student-standing" ? (
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
                  {students.map((student) => {
                    const studentMatchesFocus = isFocusedStudent(
                      student,
                      requestedStudentEmail,
                      requestedStudentName
                    );
                    const isSelectedStudent =
                      selectedStudent?.student_email === student.student_email;

                    const targetKey = makeSafeElementId(
                      requestedStudentEmail ||
                        requestedStudentName ||
                        student.student_email ||
                        student.student_name
                    );

                    return (
                      <tr
                        key={student.student_user_id}
                        id={
                          studentMatchesFocus
                            ? `student-standing-${targetKey}`
                            : undefined
                        }
                        onClick={() => setSelectedStudentEmail(student.student_email)}
                        style={
                          studentMatchesFocus || isSelectedStudent
                            ? focusedStudentRowStyle
                            : { cursor: "pointer" }
                        }
                      >
                        <td>
                          <strong>{student.student_name}</strong>
                          <div style={{ fontSize: "0.9rem" }}>
                            {student.student_email}
                          </div>
                          {studentMatchesFocus ? (
                            <div style={focusBadgeStyle}>
                              Heatmap focus
                              {requestedFocus ? `: ${requestedFocus}` : ""}
                            </div>
                          ) : null}
                        </td>
                        <td>{formatPercent(student.graded_weight_percent)}</td>
                        <td>{formatPercent(student.earned_course_points)}</td>
                        <td>
                          <strong>{formatPercent(student.current_percent)}</strong>
                        </td>
                        <td>{getProficiency(student.current_percent)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
          ) : null}

          {activeGradebookSection === "selected-student" ? (
          <section className="panel">
            <h2>Selected Student Detail</h2>
            <p className="section-subtitle">
              Click a student above to view one focused competency snapshot instead of a long scrolling list.
            </p>

            <div style={{ display: "grid", gap: "18px" }}>
              {(selectedStudent ? [selectedStudent] : []).map((student) => (
                <div
                  key={`competency-snapshot-${student.student_user_id}`}
                  style={{
                    border: "1px solid #d7dce5",
                    borderRadius: "14px",
                    background: "#ffffff",
                    padding: "14px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                    <div>
                      <h3 style={{ marginTop: 0, marginBottom: "8px" }}>
                        {student.student_name}
                      </h3>

                      <div style={{ color: "#4b5563" }}>
                        Current Course Standing: <strong>{formatPercent(student.current_percent)}</strong>
                        {" "}• {getProficiency(student.current_percent)}
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                        gap: "10px",
                        width: "100%",
                        marginTop: "12px",
                      }}
                    >
                      <div className="summary-card">
                        <strong>Current Grade</strong>
                        <div>{formatPercent(student.current_percent)}</div>
                      </div>
                      <div className="summary-card">
                        <strong>Proficiency</strong>
                        <div>{getProficiency(student.current_percent)}</div>
                      </div>
                      <div className="summary-card">
                        <strong>Competencies Graded</strong>
                        <div>{selectedStudentCompetencyCount}</div>
                      </div>
                      <div className="summary-card">
                        <strong>Assignments</strong>
                        <div>{assignmentCount}</div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => toggleCompetencySnapshot(student.student_user_id)}
                    >
                      {expandedCompetencyStudents[student.student_user_id] ? "Hide Snapshot" : "Show Snapshot"}
                    </button>
                  </div>

                  {expandedCompetencyStudents[student.student_user_id] ? (
                    !student.group_breakdown || student.group_breakdown.length === 0 ? (
                    <div style={{ color: "#4b5563" }}>
                      No competency evidence has been graded yet.
                    </div>
                  ) : (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Learning Category</th>
                            <th>Evidence Tier</th>
                            <th>Average Score</th>
                            <th>Course Weight</th>
                            <th>Earned Points</th>
                          </tr>
                        </thead>
                        <tbody>
                          {student.group_breakdown.map((group) => (
                            <tr key={`${student.student_user_id}-${group.subcategory_id}`}>
                              <td>{group.category_name || "Unlinked"}</td>
                              <td>{group.subcategory_name || "Unlinked"}</td>
                              <td>{formatPercent(group.average_score)}</td>
                              <td>{formatPercent(group.course_weight_percent)}</td>
                              <td>{formatPercent(group.earned_course_points)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    )
                  ) : null}

                  <div style={studentSuccessCommunicationCentreStyle}>
                    <div>
                      <h3 style={{ marginTop: 0, marginBottom: "6px" }}>
                        Student Success Communication Centre
                      </h3>
                      <div style={{ color: "#4b5563", lineHeight: 1.5 }}>
                        Create a ready-to-edit email snapshot for parent, student, homeroom,
                        counselling, administrator, or teacher communication.
                      </div>
                    </div>

                    <div style={communicationGridStyle}>
                      <label className="form-field">
                        <span className="form-label">Communication Type</span>
                        <select
                          className="form-input"
                          value={communicationType}
                          onChange={(event) => setCommunicationType(event.target.value)}
                        >
                          <option value="progress-update">Positive Progress Update</option>
                          <option value="academic-concern">Academic Concern</option>
                          <option value="missing-work">Missing Work</option>
                          <option value="meeting-request">Parent Meeting Request</option>
                          <option value="intervention-update">Intervention Update</option>
                          <option value="custom">Custom Communication</option>
                        </select>
                      </label>

                      <label className="form-field">
                        <span className="form-label">Recipient</span>
                        <select
                          className="form-input"
                          value={communicationRecipient}
                          onChange={(event) => setCommunicationRecipient(event.target.value)}
                        >
                          <option value="parent">Parent / Guardian</option>
                          <option value="student">Student</option>
                          <option value="homeroom">Homeroom Teacher</option>
                          <option value="course-teacher">Course Teacher</option>
                          <option value="counsellor">Counsellor</option>
                          <option value="administrator">Administrator</option>
                        </select>
                      </label>
                    </div>

                    <div style={communicationSnapshotStyle}>
                      <div style={{ fontWeight: 900, marginBottom: "8px" }}>
                        Snapshot Included
                      </div>
                      <div>Student: <strong>{student.student_name}</strong></div>
                      <div>Current Grade: <strong>{formatPercent(student.current_percent)}</strong></div>
                      <div>Proficiency: <strong>{getProficiency(student.current_percent)}</strong></div>
                      <div>Assignments: <strong>{assignmentCount}</strong></div>
                      <div>
                        Missing / Not Yet Graded:{" "}
                        <strong>{getStudentMissingAssignments(student).length}</strong>
                      </div>
                    </div>

                    <label className="form-field">
                      <span className="form-label">Additional Teacher Notes</span>
                      <textarea
                        className="form-input"
                        value={communicationNotes}
                        onChange={(event) => setCommunicationNotes(event.target.value)}
                        rows={5}
                        placeholder="Add comments that should appear in the email body..."
                      />
                    </label>

                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() => createStudentCommunicationEmail(student)}
                      >
                        Create Email Snapshot
                      </button>

                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => setCommunicationNotes("")}
                      >
                        Clear Notes
                      </button>
                    </div>

                    <div style={{ color: "#4b5563", lineHeight: 1.5 }}>
                      Phase 1 opens a prepared email draft in your default mail app.
                      Direct sending, CC lists, communication history, and PDF snapshots can be added later.
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
          ) : null}

          {activeGradebookSection === "assignment-test-mark-entry" ? (
          <section className="panel">
            <h2>Assignment / Test Mark Entry</h2>
            <p className="section-subtitle">
              Choose an assignment or test, then open Speed Grading to enter raw marks or percentages. SUPER LMS converts those marks into KDU scores automatically.
            </p>

            {groupedAssignments.length === 0 ? (
              <div style={{ color: "#4b5563", lineHeight: 1.5 }}>
                No assignments found for this course yet.
              </div>
            ) : (
              <div style={{ display: "grid", gap: "16px" }}>
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
                        Evidence Tier: {group.bucketName} • Course Weight: {formatPercent(group.courseWeight)}
                      </div>
                    </div>

                    <div style={{ display: "grid", gap: "10px", padding: "16px" }}>
                      {group.assignments.map((assignment) => (
                        <div
                          key={assignment.id}
                          style={{
                            border: "1px solid #d7dce5",
                            borderRadius: "12px",
                            padding: "12px",
                            background: "#ffffff",
                          }}
                        >
                          <div style={{ fontWeight: 900, marginBottom: "6px" }}>
                            {assignment.title}
                          </div>

                          <div style={{ color: "#4b5563", lineHeight: 1.5, marginBottom: "10px" }}>
                            Assessment Pathway: {assignment.category_name || "No pathway"} • Evidence Tier: {assignment.subcategory_name || "No tier"}
                          </div>

                          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                            <button
                              type="button"
                              onClick={() => { window.location.href = `/assignments/${assignment.id}/edit` }}
                              className="btn secondary"
                            >
                              Open Edit Page
                            </button>

                            <button
                              type="button"
                              onClick={() => { window.location.href = `/assignments/${assignment.id}/grade` }}
                              className="btn"
                            >
                              Open Speed Grading / Raw Marks
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
          ) : null}

          {activeGradebookSection === "assignment-kdu" ? (
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
                        {students.map((student) => {
                          const studentMatchesFocus = isFocusedStudent(
                            student,
                            requestedStudentEmail,
                            requestedStudentName
                          );

                          return (
                            <tr
                              key={student.student_user_id}
                              style={studentMatchesFocus ? focusedStudentRowStyle : {}}
                            >
                              <td>
                                <strong>{student.student_name}</strong>
                                {studentMatchesFocus ? (
                                  <div style={focusBadgeStyle}>
                                    Heatmap focus
                                    {requestedFocus ? `: ${requestedFocus}` : ""}
                                  </div>
                                ) : null}
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
                                        isFocused={
                                          studentMatchesFocus && requestedFocus === "DO"
                                        }
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
                                        isFocused={
                                          studentMatchesFocus && requestedFocus === "KNOW"
                                        }
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
                                        isFocused={
                                          studentMatchesFocus &&
                                          requestedFocus === "UNDERSTAND"
                                        }
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
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </section>
          ) : null}
        </>
      ) : null}
    </div>

    <FloatingTeacherCoach
      subtitle="Gradebook Coach"
      recommendationTitle={gradebookCoachRecommendation.title}
      recommendationReason={gradebookCoachRecommendation.reason}
      recommendationAction={gradebookCoachRecommendation.action}
    >
      <div style={{ fontWeight: 900, marginBottom: "6px" }}>Gradebook workflow</div>
      <div style={{ color: "#111827", lineHeight: 1.55 }}>
        <div>□ Confirm students are showing</div>
        <div>□ Check current percentage and proficiency</div>
        <div>□ Review Developing or Emerging students</div>
        <div>□ Look for missing or uneven evidence</div>
        <div>□ Prepare parent updates or report comments</div>
      </div>
    </FloatingTeacherCoach>
    </>
  );
}

const floatingPageNavWrapStyle = {
  position: "fixed",
  left: "14px",
  top: "45%",
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

const focusNoticeStyle = {
  border: "2px solid #111",
  borderRadius: "12px",
  padding: "12px",
  background: "#ffffff",
  fontWeight: 800,
  lineHeight: 1.4,
};

const focusBadgeStyle = {
  marginTop: "8px",
  display: "inline-block",
  border: "2px solid #111",
  borderRadius: "999px",
  padding: "6px 10px",
  background: "#ffffff",
  fontSize: "0.8rem",
  fontWeight: 900,
};

const focusedStudentRowStyle = {
  outline: "3px solid #111",
  outlineOffset: "2px",
  background: "#f8fafc",
};

const spreadsheetGradebookWrapStyle = {
  maxWidth: "100%",
  overflowX: "auto",
  border: "1px solid #d7dce5",
  borderRadius: "14px",
  background: "#ffffff",
};

const spreadsheetToolbarStyle = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  flexWrap: "wrap",
  marginBottom: "14px",
};

const spreadsheetMenuStyle = {
  position: "relative",
};

const spreadsheetMenuSummaryStyle = {
  listStyle: "none",
  border: "1px solid #cbd5e1",
  borderRadius: "10px",
  background: "#ffffff",
  padding: "9px 14px",
  fontWeight: 900,
  cursor: "pointer",
};

const spreadsheetMenuPanelStyle = {
  position: "absolute",
  top: "calc(100% + 6px)",
  left: 0,
  zIndex: 8,
  minWidth: "220px",
  display: "grid",
  gap: "4px",
  border: "1px solid #cbd5e1",
  borderRadius: "12px",
  background: "#ffffff",
  padding: "10px",
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.16)",
};

const spreadsheetMenuHeadingStyle = {
  padding: "6px 8px",
  color: "#4b5563",
  fontSize: "0.82rem",
  fontWeight: 900,
  textTransform: "uppercase",
};

const spreadsheetMenuButtonStyle = {
  border: 0,
  borderRadius: "8px",
  background: "transparent",
  padding: "9px 10px",
  color: "#111827",
  font: "inherit",
  fontWeight: 700,
  textAlign: "left",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const spreadsheetSortStatusStyle = {
  color: "#4b5563",
  fontSize: "0.9rem",
};

const spreadsheetGradebookTableStyle = {
  width: "max-content",
  minWidth: "100%",
  borderCollapse: "separate",
  borderSpacing: 0,
};

const spreadsheetStudentHeaderStyle = {
  position: "sticky",
  left: 0,
  zIndex: 3,
  minWidth: "220px",
  background: "#f8fafc",
  borderRight: "2px solid #cbd5e1",
};

const spreadsheetStudentHeaderContentStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "10px",
};

const spreadsheetStudentMenuStyle = {
  position: "relative",
};

const spreadsheetStudentMenuSummaryStyle = {
  listStyle: "none",
  display: "grid",
  placeItems: "center",
  width: "30px",
  height: "30px",
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  background: "#ffffff",
  fontSize: "1.2rem",
  fontWeight: 900,
  cursor: "pointer",
};

const spreadsheetStudentMenuPanelStyle = {
  ...spreadsheetMenuPanelStyle,
  top: "calc(100% + 4px)",
  right: 0,
  left: "auto",
  minWidth: "160px",
};

const spreadsheetAssignmentHeaderStyle = {
  width: "220px",
  minWidth: "220px",
  maxWidth: "220px",
  verticalAlign: "top",
  background: "#f8fafc",
  whiteSpace: "normal",
  overflow: "hidden",
};

const spreadsheetDraggingHeaderStyle = {
  opacity: 0.55,
  outline: "3px dashed #2563eb",
  outlineOffset: "-4px",
};

const spreadsheetColumnMoveControlsStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "5px",
  marginBottom: "8px",
};

const spreadsheetDragHandleStyle = {
  marginRight: "auto",
  color: "#4b5563",
  fontSize: "0.76rem",
  fontWeight: 800,
  cursor: "grab",
  userSelect: "none",
};

const spreadsheetMoveButtonStyle = {
  width: "28px",
  height: "28px",
  display: "grid",
  placeItems: "center",
  border: "1px solid #cbd5e1",
  borderRadius: "7px",
  background: "#ffffff",
  color: "#111827",
  fontSize: "0.95rem",
  fontWeight: 900,
  cursor: "pointer",
};

const spreadsheetAssignmentButtonStyle = {
  width: "100%",
  border: 0,
  padding: 0,
  background: "transparent",
  color: "#111827",
  font: "inherit",
  fontWeight: 900,
  textAlign: "left",
  textDecoration: "underline",
  cursor: "pointer",
  whiteSpace: "normal",
  overflowWrap: "anywhere",
  lineHeight: 1.35,
};

const spreadsheetAssignmentMetaStyle = {
  marginTop: "6px",
  color: "#4b5563",
  fontSize: "0.82rem",
  fontWeight: 500,
  lineHeight: 1.35,
  whiteSpace: "normal",
  overflowWrap: "anywhere",
};

const spreadsheetAssignmentPathwayStyle = {
  ...spreadsheetAssignmentMetaStyle,
  paddingTop: "6px",
  borderTop: "1px solid #d7dce5",
};

const spreadsheetStudentCellStyle = {
  position: "sticky",
  left: 0,
  zIndex: 2,
  minWidth: "220px",
  background: "#ffffff",
  borderRight: "2px solid #cbd5e1",
};

const spreadsheetStudentEmailStyle = {
  marginTop: "4px",
  color: "#4b5563",
  fontSize: "0.82rem",
};

const spreadsheetScoreCellStyle = {
  width: "220px",
  minWidth: "220px",
  maxWidth: "220px",
  textAlign: "center",
  fontWeight: 800,
};

const spreadsheetSummaryHeaderStyle = {
  minWidth: "150px",
  background: "#f8fafc",
};

const spreadsheetSummaryCellStyle = {
  minWidth: "150px",
  lineHeight: 1.5,
};

const studentSuccessCommunicationCentreStyle = {
  border: "2px solid #111827",
  borderRadius: "16px",
  background: "#ffffff",
  padding: "16px",
  marginTop: "18px",
  display: "grid",
  gap: "14px",
};

const communicationGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "12px",
};

const communicationSnapshotStyle = {
  border: "1px solid #d7dce5",
  borderRadius: "12px",
  background: "#f8fafc",
  padding: "12px",
  lineHeight: 1.6,
};

const focusedKduBoxStyle = {
  display: "grid",
  gap: "6px",
  border: "3px solid #111",
  borderRadius: "12px",
  padding: "10px",
  background: "#ffffff",
};
