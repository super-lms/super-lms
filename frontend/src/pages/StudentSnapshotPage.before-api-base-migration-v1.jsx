import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

const API_BASE = "http://localhost:3000";

function formatPercent(value) {
  if (value === null || value === undefined || value === "") {
    return "Not calculated";
  }

  const numericValue = Number(value);

  if (Number.isNaN(numericValue)) {
    return "Not calculated";
  }

  return `${numericValue.toFixed(2)}%`;
}

function formatScore(value) {
  if (value === null || value === undefined || value === "") {
    return "Not graded";
  }

  const numericValue = Number(value);

  if (Number.isNaN(numericValue)) {
    return "Not graded";
  }

  return `${numericValue.toFixed(2)}%`;
}

function getAssignmentStatus(assignment) {
  const hasScore = assignment.score !== null && assignment.score !== undefined && assignment.score !== "";
  const hasFeedback = Boolean(String(assignment.feedback || "").trim());

  if (hasScore || hasFeedback) {
    return "Returned";
  }

  return "Not Started";
}

function getDueDateStatus(dueDate) {
  if (!dueDate) {
    return "No due date";
  }

  const due = new Date(dueDate);
  const today = new Date();

  if (Number.isNaN(due.getTime())) {
    return "No due date";
  }

  due.setHours(23, 59, 59, 999);
  today.setHours(0, 0, 0, 0);

  if (due < today) {
    return "Past due";
  }

  return "Upcoming";
}

function formatDueDate(dueDate) {
  if (!dueDate) {
    return "No due date";
  }

  const date = new Date(dueDate);

  if (Number.isNaN(date.getTime())) {
    return "No due date";
  }

  return date.toLocaleDateString();
}

function getMissingWork(assignments) {
  return assignments.filter((assignment) => {
    const status = getAssignmentStatus(assignment);
    const dueStatus = getDueDateStatus(assignment.due_date);

    return status === "Not Started" && dueStatus === "Past due";
  });
}

function getUpcomingWork(assignments) {
  return assignments.filter((assignment) => {
    const status = getAssignmentStatus(assignment);
    const dueStatus = getDueDateStatus(assignment.due_date);

    return status === "Not Started" && dueStatus === "Upcoming";
  });
}

function getStatusSummary(assignments) {
  const summary = {
    Returned: 0,
    Submitted: 0,
    Missing: 0,
    "Not Started": 0,
  };

  for (const assignment of assignments) {
    const status = getAssignmentStatus(assignment);
    summary[status] = (summary[status] || 0) + 1;
  }

  return summary;
}

function getAtRiskIndicators(student, missingWork, statusSummary) {
  const indicators = [];
  const currentPercent = Number(student?.current_percent);
  const gradedWeight = Number(student?.graded_weight_percent || 0);
  const returnedCount = Number(statusSummary?.Returned || 0);

  if (Number.isFinite(currentPercent) && currentPercent < 60) {
    indicators.push({
      title: "Current Grade Below 60%",
      detail: `Current standing is ${formatPercent(currentPercent)}.`,
    });
  }

  if (missingWork.length >= 3) {
    indicators.push({
      title: "Multiple Missing Assignments",
      detail: `${missingWork.length} assignments are past due and not started.`,
    });
  } else if (missingWork.length > 0) {
    indicators.push({
      title: "Missing Assignment",
      detail: `${missingWork.length} assignment${missingWork.length === 1 ? " is" : "s are"} past due and not started.`,
    });
  }

  if (gradedWeight > 0 && gradedWeight < 25) {
    indicators.push({
      title: "Limited Evidence Available",
      detail: `Only ${formatPercent(gradedWeight)} of the course weight has been graded.`,
    });
  }

  if (returnedCount === 0) {
    indicators.push({
      title: "No Returned Work Yet",
      detail: "No assignments have been returned with grades or feedback yet.",
    });
  }

  return indicators;
}

function getFamilySummary(student, gradedAssignments, totalAssignments) {
  if (!student) {
    return "No student record is available yet for this course.";
  }

  if (!student.current_percent && Number(student.current_percent) !== 0) {
    return `This course has ${totalAssignments} assignment${totalAssignments === 1 ? "" : "s"} visible, but no graded course evidence has been entered yet.`;
  }

  const gradedWeight = Number(student.graded_weight_percent || 0);

  return `Current standing is ${formatPercent(student.current_percent)} based on ${formatPercent(gradedWeight)} of the course weight currently graded across ${gradedAssignments.length} assignment${gradedAssignments.length === 1 ? "" : "s"}.`;
}

export default function StudentSnapshotPage() {
  const { courseId, studentEmail } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [gradebook, setGradebook] = useState(null);

  useEffect(() => {
    loadSnapshot();
  }, [courseId, studentEmail]);

  async function loadSnapshot() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${API_BASE}/api/classes/${courseId}/kdu-gradebook`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load student snapshot");
      }

      setGradebook(data);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load student snapshot");
      setGradebook(null);
    } finally {
      setLoading(false);
    }
  }

  const decodedStudentEmail = decodeURIComponent(String(studentEmail || "")).trim().toLowerCase();

  const student = useMemo(() => {
    const students = Array.isArray(gradebook?.students) ? gradebook.students : [];

    return (
      students.find(
        (item) => String(item.student_email || "").trim().toLowerCase() === decodedStudentEmail
      ) || null
    );
  }, [gradebook, decodedStudentEmail]);

  const assignmentScores = Array.isArray(student?.assignment_scores)
    ? student.assignment_scores
    : [];

  const gradedAssignments = assignmentScores.filter((assignment) => assignment.score !== null);
  const notGradedAssignments = assignmentScores.filter((assignment) => assignment.score === null);

  const pathwayBreakdown = useMemo(() => {
    const groups = new Map();

    for (const item of assignmentScores) {
      if (!item.category_name || item.score === null) continue;

      const key = String(item.category_id || item.category_name);

      if (!groups.has(key)) {
        groups.set(key, {
          name: item.category_name,
          scores: [],
        });
      }

      groups.get(key).scores.push(Number(item.score));
    }

    return Array.from(groups.values()).map((group) => {
      const average =
        group.scores.reduce((sum, value) => sum + value, 0) / group.scores.length;

      return {
        name: group.name,
        average_score: Number(average.toFixed(2)),
        graded_count: group.scores.length,
      };
    });
  }, [assignmentScores]);

  const evidenceBreakdown = useMemo(() => {
    const groups = new Map();

    for (const item of assignmentScores) {
      if (!item.subcategory_name || item.score === null) continue;

      const key = String(item.subcategory_id || item.subcategory_name);

      if (!groups.has(key)) {
        groups.set(key, {
          name: item.subcategory_name,
          pathway: item.category_name || "Assessment Pathway",
          scores: [],
        });
      }

      groups.get(key).scores.push(Number(item.score));
    }

    return Array.from(groups.values()).map((group) => {
      const average =
        group.scores.reduce((sum, value) => sum + value, 0) / group.scores.length;

      return {
        name: group.name,
        pathway: group.pathway,
        average_score: Number(average.toFixed(2)),
        graded_count: group.scores.length,
      };
    });
  }, [assignmentScores]);

  const statusSummary = getStatusSummary(assignmentScores);
  const missingWork = getMissingWork(assignmentScores);
  const upcomingWork = getUpcomingWork(assignmentScores);
  const atRiskIndicators = getAtRiskIndicators(student, missingWork, statusSummary);
  const familySummary = getFamilySummary(student, gradedAssignments, assignmentScores.length);

  if (loading) {
    return (
      <div className="content-area">
        <section className="panel">
          <p>Loading student snapshot...</p>
        </section>
      </div>
    );
  }

  return (
    <div className="content-area">
      <section className="panel">
        <div style={{ marginBottom: "16px" }}>
          <button type="button" onClick={() => navigate(-1)} style={buttonStyle}>
            ← Back
          </button>
        </div>

        <div
          style={{
            border: "2px solid #111827",
            borderRadius: "18px",
            padding: "20px",
            background: "#ffffff",
            marginBottom: "20px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "16px",
              flexWrap: "wrap",
              alignItems: "flex-start",
            }}
          >
            <div>
              <h1 style={{ marginTop: 0, marginBottom: "8px" }}>
                Student Snapshot
              </h1>
              <p style={{ margin: 0, color: "#4b5563", lineHeight: 1.5 }}>
                Teacher preview of what a student or parent could see for this course.
              </p>
            </div>

            <div
              style={{
                border: "1px solid #9ca3af",
                borderRadius: "14px",
                padding: "14px 18px",
                background: "#f8fafc",
                minWidth: "220px",
              }}
            >
              <div style={{ fontSize: "28px", fontWeight: 800 }}>
                {formatPercent(student?.current_percent)}
              </div>
              <div style={{ fontWeight: 700 }}>Current Course Grade</div>
              <div style={{ color: "#4b5563", marginTop: "6px" }}>
                Based on {formatPercent(student?.graded_weight_percent)} graded weight.
              </div>
            </div>
          </div>
        </div>

        {error ? <div style={noticeStyle}>{error}</div> : null}

        {!student ? (
          <div style={noticeStyle}>
            No student record found for {decodedStudentEmail || "this student"} in this course.
          </div>
        ) : (
          <div style={{ display: "grid", gap: "18px", maxWidth: "1120px" }}>
            <section style={sectionStyle}>
              <h2 style={{ marginTop: 0 }}>At-Risk Intelligence</h2>

              {atRiskIndicators.length > 0 ? (
                <div style={{ display: "grid", gap: "10px" }}>
                  {atRiskIndicators.map((indicator) => (
                    <div key={indicator.title} style={alertRowStyle}>
                      <strong>⚠ {indicator.title}</strong>
                      <div style={{ marginTop: "4px", color: "#4b5563" }}>
                        {indicator.detail}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={noticeStyle}>
                  ✓ No at-risk indicators are currently visible for this student.
                </div>
              )}
            </section>

            <section style={sectionStyle}>
              <h2 style={{ marginTop: 0 }}>Family-Friendly Summary</h2>
              <p style={{ color: "#4b5563", lineHeight: 1.6, marginBottom: 0 }}>
                {familySummary}
              </p>
            </section>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "14px",
              }}
            >
              <SnapshotCard title="Student">
                <strong>{student.student_name || "Unnamed Student"}</strong>
                <div>{student.student_email}</div>
              </SnapshotCard>

              <SnapshotCard title="Course">
                <strong>{gradebook?.class?.class_name || "Course"}</strong>
                <div>Course ID: {courseId}</div>
              </SnapshotCard>

              <SnapshotCard title="Graded Weight">
                <strong>{formatPercent(student.graded_weight_percent)}</strong>
                <div>Weight currently included in grade.</div>
              </SnapshotCard>

              <SnapshotCard title="Assignments">
                <strong>{assignmentScores.length}</strong>
                <div>
                  {gradedAssignments.length} graded / {notGradedAssignments.length} not graded
                </div>
              </SnapshotCard>

              <SnapshotCard title="Returned">
                <strong>{statusSummary.Returned}</strong>
                <div>Assignments with grades or feedback.</div>
              </SnapshotCard>

              <SnapshotCard title="Not Started">
                <strong>{statusSummary["Not Started"]}</strong>
                <div>Assignments without visible submissions yet.</div>
              </SnapshotCard>
            </div>

            <section style={sectionStyle}>
              <h2 style={{ marginTop: 0 }}>Course Performance Breakdown</h2>
              <p style={{ color: "#4b5563", lineHeight: 1.6 }}>
                This explains how the current course standing is being built from graded evidence.
              </p>

              {Array.isArray(student.group_breakdown) && student.group_breakdown.length > 0 ? (
                <div style={{ display: "grid", gap: "10px" }}>
                  {student.group_breakdown.map((group) => (
                    <div key={`performance-${group.subcategory_id}`} style={threeColumnRowStyle}>
                      <div>
                        <strong>{group.category_name || "Assessment Pathway"}</strong>
                        <div>{group.subcategory_name || "Evidence Tier"}</div>
                      </div>
                      <div>
                        Average: <strong>{formatScore(group.average_score)}</strong>
                      </div>
                      <div>
                        Contribution: <strong>{formatPercent(group.earned_course_points)}</strong>
                        <div style={{ color: "#4b5563" }}>
                          of {formatPercent(group.course_weight_percent)} course weight
                        </div>
                      </div>
                    </div>
                  ))}

                  <div style={threeColumnRowStyle}>
                    <div>
                      <strong>Current Calculation</strong>
                      <div>Only graded evidence is included.</div>
                    </div>
                    <div>
                      Earned: <strong>{formatPercent(student.earned_course_points)}</strong>
                    </div>
                    <div>
                      Graded Weight: <strong>{formatPercent(student.graded_weight_percent)}</strong>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={noticeStyle}>
                  No graded course-performance breakdown is available yet. Once assignments are graded,
                  this section will show how each evidence tier contributes to the current grade.
                </div>
              )}
            </section>

            <section style={sectionStyle}>
              <h2 style={{ marginTop: 0 }}>Missing Work Intelligence</h2>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "14px",
                  marginBottom: "14px",
                }}
              >
                <SnapshotCard title="Missing Work">
                  <strong>{missingWork.length}</strong>
                  <div>Past due and not started.</div>
                </SnapshotCard>

                <SnapshotCard title="Upcoming Work">
                  <strong>{upcomingWork.length}</strong>
                  <div>Not started but not past due.</div>
                </SnapshotCard>
              </div>

              {missingWork.length > 0 ? (
                <div style={{ display: "grid", gap: "10px" }}>
                  {missingWork.map((assignment) => (
                    <div key={assignment.assignment_id} style={threeColumnRowStyle}>
                      <div>
                        <strong>{assignment.assignment_title || "Untitled Assignment"}</strong>
                        <div>{assignment.category_name || "Not linked"} → {assignment.subcategory_name || "Not linked"}</div>
                      </div>
                      <div>
                        Due: <strong>{formatDueDate(assignment.due_date)}</strong>
                      </div>
                      <div>
                        Status: <strong>Missing</strong>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={noticeStyle}>
                  No missing work is currently visible for this student.
                </div>
              )}
            </section>

            <section style={sectionStyle}>
              <h2 style={{ marginTop: 0 }}>Pathway Breakdown</h2>

              {pathwayBreakdown.length > 0 ? (
                <div style={{ display: "grid", gap: "10px" }}>
                  {pathwayBreakdown.map((pathway) => (
                    <div key={pathway.name} style={rowStyle}>
                      <div>
                        <strong>{pathway.name}</strong>
                        <div>{pathway.graded_count} graded assignment{pathway.graded_count === 1 ? "" : "s"}</div>
                      </div>
                      <div>
                        Average: <strong>{formatScore(pathway.average_score)}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={noticeStyle}>
                  No graded pathway evidence is available yet for this student.
                </div>
              )}
            </section>

            <section style={sectionStyle}>
              <h2 style={{ marginTop: 0 }}>Evidence Tier Breakdown</h2>

              {evidenceBreakdown.length > 0 ? (
                <div style={{ display: "grid", gap: "10px" }}>
                  {evidenceBreakdown.map((tier) => (
                    <div key={`${tier.pathway}-${tier.name}`} style={rowStyle}>
                      <div>
                        <strong>{tier.name}</strong>
                        <div>{tier.pathway}</div>
                      </div>
                      <div>
                        Average: <strong>{formatScore(tier.average_score)}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={noticeStyle}>
                  No graded evidence tier results are available yet for this student.
                </div>
              )}
            </section>

            <section style={sectionStyle}>
              <h2 style={{ marginTop: 0 }}>KDU / Evidence Summary</h2>

              {Array.isArray(student.group_breakdown) && student.group_breakdown.length > 0 ? (
                <div style={{ display: "grid", gap: "10px" }}>
                  {student.group_breakdown.map((group) => (
                    <div key={group.subcategory_id} style={threeColumnRowStyle}>
                      <div>
                        <strong>{group.category_name || "Assessment Pathway"}</strong>
                        <div>{group.subcategory_name || "Evidence Tier"}</div>
                      </div>
                      <div>
                        Average: <strong>{formatScore(group.average_score)}</strong>
                      </div>
                      <div>
                        Course Weight: <strong>{formatPercent(group.course_weight_percent)}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={noticeStyle}>
                  No graded KDU evidence is available yet for this student.
                </div>
              )}
            </section>

            <section style={sectionStyle}>
              <h2 style={{ marginTop: 0 }}>Assignment Results</h2>

              {assignmentScores.length === 0 ? (
                <div style={noticeStyle}>No assignments found for this course.</div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "760px" }}>
                    <thead>
                      <tr>
                        <th style={tableHeaderStyle}>Assignment</th>
                        <th style={tableHeaderStyle}>Status</th>
                        <th style={tableHeaderStyle}>Pathway</th>
                        <th style={tableHeaderStyle}>Evidence Tier</th>
                        <th style={tableHeaderStyle}>Due</th>
                        <th style={tableHeaderStyle}>Score</th>
                        <th style={tableHeaderStyle}>Teacher Feedback</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assignmentScores.map((assignment) => (
                        <tr key={assignment.assignment_id}>
                          <td style={tableCellStyle}>
                            <strong>{assignment.assignment_title || "Untitled Assignment"}</strong>
                          </td>
                          <td style={tableCellStyle}>
                            <strong>{getAssignmentStatus(assignment)}</strong>
                          </td>
                          <td style={tableCellStyle}>{assignment.category_name || "Not linked"}</td>
                          <td style={tableCellStyle}>{assignment.subcategory_name || "Not linked"}</td>
                          <td style={tableCellStyle}>{formatDueDate(assignment.due_date)}</td>
                          <td style={tableCellStyle}>{formatScore(assignment.score)}</td>
                          <td style={{ ...tableCellStyle, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                            {assignment.feedback || "No feedback yet"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}
      </section>
    </div>
  );
}

function SnapshotCard({ title, children }) {
  return (
    <div
      style={{
        border: "1px solid #d7dce5",
        borderRadius: "14px",
        padding: "14px",
        background: "#f8fafc",
      }}
    >
      <div style={{ fontSize: "0.85rem", color: "#4b5563", marginBottom: "6px" }}>
        {title}
      </div>
      <div>{children}</div>
    </div>
  );
}

const buttonStyle = {
  border: "1px solid #111827",
  borderRadius: "10px",
  padding: "10px 14px",
  background: "#ffffff",
  fontWeight: 700,
  cursor: "pointer",
};

const sectionStyle = {
  border: "1px solid #d7dce5",
  borderRadius: "16px",
  padding: "18px",
  background: "#ffffff",
};

const noticeStyle = {
  border: "1px solid #9ca3af",
  borderRadius: "12px",
  padding: "14px",
  background: "#f8fafc",
  lineHeight: 1.5,
};

const alertRowStyle = {
  border: "1px solid #111827",
  borderRadius: "12px",
  padding: "14px",
  background: "#ffffff",
  lineHeight: 1.5,
};

const rowStyle = {
  border: "1px solid #d7dce5",
  borderRadius: "12px",
  padding: "12px",
  background: "#f8fafc",
  display: "grid",
  gridTemplateColumns: "minmax(220px, 1.4fr) minmax(160px, 1fr)",
  gap: "12px",
  alignItems: "center",
};

const threeColumnRowStyle = {
  border: "1px solid #d7dce5",
  borderRadius: "12px",
  padding: "12px",
  background: "#f8fafc",
  display: "grid",
  gridTemplateColumns: "minmax(220px, 1.4fr) minmax(160px, 1fr) minmax(160px, 1fr)",
  gap: "12px",
  alignItems: "center",
};

const tableHeaderStyle = {
  border: "1px solid #d7dce5",
  padding: "10px",
  textAlign: "left",
  verticalAlign: "top",
  background: "#f8fafc",
};

const tableCellStyle = {
  border: "1px solid #d7dce5",
  padding: "10px",
  verticalAlign: "top",
};
