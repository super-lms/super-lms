import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatDisplayDate(value) {
  if (!value) return "—";

  const raw = String(value).slice(0, 10);
  const date = new Date(`${raw}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return raw;
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getStatusLabel(student) {
  return student.attendance_status || "Not recorded";
}

function getStatusGroup(student) {
  const normalized = String(student.attendance_status || "").trim().toLowerCase();

  if (normalized === "present") return "Present";
  if (normalized === "absent") return "Absent";
  if (normalized === "late") return "Late";
  if (normalized === "excused") return "Excused";
  return "Unrecorded";
}

function SectionHeader({ title, subtitle, action }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: "12px",
        flexWrap: "wrap",
        marginBottom: "16px",
      }}
    >
      <div>
        <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800 }}>{title}</h2>
        {subtitle ? (
          <p
            style={{
              margin: "6px 0 0 0",
              fontSize: "0.95rem",
              lineHeight: 1.5,
              color: "#4b5563",
            }}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
      {action || null}
    </div>
  );
}

function SummaryCard({ label, value, helper }) {
  return (
    <div
      style={{
        border: "1px solid #d7dce5",
        borderRadius: "14px",
        padding: "18px",
        background: "#ffffff",
        boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)",
      }}
    >
      <div
        style={{
          fontSize: "0.82rem",
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: "#6b7280",
          marginBottom: "10px",
        }}
      >
        {label}
      </div>

      <div style={{ fontSize: "2rem", fontWeight: 800, lineHeight: 1 }}>{value}</div>

      <div
        style={{
          marginTop: "10px",
          fontSize: "0.95rem",
          lineHeight: 1.4,
          color: "#4b5563",
        }}
      >
        {helper}
      </div>
    </div>
  );
}

function NoticeBox({ children, type = "info" }) {
  const borderColor = type === "error" ? "#d1a1a1" : "#cfd8e3";
  const background = type === "error" ? "#fff8f8" : "#f8fafc";

  return (
    <div
      style={{
        border: `1px solid ${borderColor}`,
        borderRadius: "12px",
        padding: "14px 16px",
        background,
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  );
}

function ActionButton({ children, onClick, type = "button", quiet = false }) {
  return (
    <button
      type={type}
      onClick={onClick}
      style={{
        padding: "10px 14px",
        borderRadius: "10px",
        border: "1px solid #d7dce5",
        background: quiet ? "#ffffff" : "#f3f4f6",
        font: "inherit",
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function DetailCard({ title, children }) {
  return (
    <div
      style={{
        border: "1px solid #d7dce5",
        borderRadius: "12px",
        padding: "14px",
        background: "#ffffff",
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: "10px" }}>{title}</div>
      {children}
    </div>
  );
}

export default function AttendancePage() {
  const navigate = useNavigate();
  const { courseId } = useParams();

  const routeCourseId = String(courseId || "").trim();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [selectedClassId, setSelectedClassId] = useState(routeCourseId || "");
  const [selectedDate, setSelectedDate] = useState(todayIsoDate());

  useEffect(() => {
    if (routeCourseId) {
      setSelectedClassId(routeCourseId);
    }
  }, [routeCourseId]);

  const attendanceUrl = useMemo(() => {
    const safeClassId = String(selectedClassId || "").trim();
    const safeDate = String(selectedDate || "").trim();

    if (!safeClassId) return "";

    const query = safeDate ? `?date=${encodeURIComponent(safeDate)}` : "";
    return `/api/classes/${encodeURIComponent(safeClassId)}/attendance${query}`;
  }, [selectedClassId, selectedDate]);

  useEffect(() => {
    let isMounted = true;

    async function loadAttendance() {
      if (!attendanceUrl) {
        setData(null);
        setLoading(false);
        setErrorText("");
        return;
      }

      try {
        setLoading(true);
        setErrorText("");

        const response = await fetch(attendanceUrl);

        if (!response.ok) {
          if (response.status === 404) {
            if (!isMounted) return;
            setData({
              class: {
                id: selectedClassId,
                class_name: routeCourseId ? `Course ${selectedClassId}` : "Selected Class",
                description: "Attendance has not been set up for this class yet.",
              },
              date: selectedDate,
              students: [],
            });
            setErrorText("");
            return;
          }

          throw new Error(`Attendance request failed with status ${response.status}`);
        }

        const result = await response.json();

        if (!isMounted) return;

        setData(result);
      } catch (error) {
        if (!isMounted) return;
        setErrorText(error.message || "Could not load attendance.");
      } finally {
        if (!isMounted) return;
        setLoading(false);
      }
    }

    loadAttendance();

    return () => {
      isMounted = false;
    };
  }, [attendanceUrl, routeCourseId, selectedClassId, selectedDate]);

  const classInfo = data?.class || {};
  const students = useMemo(() => toArray(data?.students), [data]);

  const attendanceSummary = useMemo(() => {
    const summary = {
      Present: 0,
      Absent: 0,
      Late: 0,
      Excused: 0,
      Unrecorded: 0,
    };

    students.forEach((student) => {
      const group = getStatusGroup(student);
      summary[group] += 1;
    });

    return summary;
  }, [students]);

  const attendanceRows = useMemo(() => {
    return students.map((student, index) => ({
      key: student.student_email || student.student_name || index,
      student_name: student.student_name || "—",
      student_email: student.student_email || "—",
      attendance_status: getStatusLabel(student),
      attendance_note: student.attendance_note || "—",
      attendance_group: getStatusGroup(student),
    }));
  }, [students]);

  const backTarget = routeCourseId
    ? `/admin/courses/${encodeURIComponent(routeCourseId)}`
    : "/dashboard";

  return (
    <>
      <div className="topbar">
        <h1>Attendance</h1>
        <p className="topbar-subtitle">
          Review attendance for the selected course. If no attendance has been recorded yet,
          this page will show a clean empty state instead of a broken request.
        </p>
      </div>

      <div className="content-area">
        <section className="panel">
          <SectionHeader
            title="Attendance Lookup"
            subtitle={
              routeCourseId
                ? "This attendance view is connected to the selected Administrator Course Workspace."
                : "Use class and date to review attendance records without leaving the teacher workflow."
            }
            action={
              <ActionButton quiet onClick={() => navigate(backTarget)}>
                {routeCourseId ? "Back to Course Workspace" : "Back to Dashboard"}
              </ActionButton>
            }
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "220px 220px auto",
              gap: "16px",
              alignItems: "end",
            }}
          >
            <div>
              <label
                htmlFor="attendance-class-id"
                style={{
                  display: "block",
                  fontSize: "0.92rem",
                  fontWeight: 700,
                  marginBottom: "6px",
                }}
              >
                Class ID
              </label>
              <input
                id="attendance-class-id"
                value={selectedClassId}
                onChange={(event) => setSelectedClassId(event.target.value)}
                placeholder="Enter class ID"
                disabled={Boolean(routeCourseId)}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  border: "1px solid #d7dce5",
                  background: routeCourseId ? "#f3f4f6" : "#ffffff",
                  font: "inherit",
                }}
              />
            </div>

            <div>
              <label
                htmlFor="attendance-date"
                style={{
                  display: "block",
                  fontSize: "0.92rem",
                  fontWeight: 700,
                  marginBottom: "6px",
                }}
              >
                Date
              </label>
              <input
                id="attendance-date"
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  border: "1px solid #d7dce5",
                  background: "#ffffff",
                  font: "inherit",
                }}
              />
            </div>

            <div style={{ color: "#4b5563", fontSize: "0.95rem", lineHeight: 1.5 }}>
              Current request: <strong>{attendanceUrl || "No request URL"}</strong>
            </div>
          </div>
        </section>

        {loading ? (
          <section className="panel">
            <p>Loading attendance...</p>
          </section>
        ) : null}

        {errorText ? (
          <section className="panel">
            <NoticeBox type="error">
              <strong>Attendance could not be loaded.</strong>
              <div style={{ marginTop: "8px" }}>{errorText}</div>
            </NoticeBox>
          </section>
        ) : null}

        {!loading && !errorText ? (
          <>
            <section
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
                gap: "16px",
              }}
            >
              <SummaryCard
                label="Students"
                value={students.length}
                helper="Total students returned for this class and date."
              />
              <SummaryCard
                label="Present"
                value={attendanceSummary.Present}
                helper="Students marked present."
              />
              <SummaryCard
                label="Absent"
                value={attendanceSummary.Absent}
                helper="Students marked absent."
              />
              <SummaryCard
                label="Late"
                value={attendanceSummary.Late}
                helper="Students marked late."
              />
              <SummaryCard
                label="Unrecorded"
                value={attendanceSummary.Unrecorded}
                helper="Students without a recorded status."
              />
            </section>

            <section className="panel">
              <SectionHeader
                title={classInfo.class_name || classInfo.title || "Class Attendance"}
                subtitle={`Attendance for ${formatDisplayDate(data?.date || selectedDate)}`}
              />

              {attendanceRows.length === 0 ? (
                <NoticeBox>
                  No attendance has been recorded for this class and date yet. This is expected
                  before the school begins using the attendance workflow.
                </NoticeBox>
              ) : null}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  gap: "14px",
                  marginTop: attendanceRows.length === 0 ? "16px" : 0,
                }}
              >
                <DetailCard title="Class Name">
                  <div>{classInfo.class_name || classInfo.title || `Course ${selectedClassId}`}</div>
                </DetailCard>

                <DetailCard title="Date">
                  <div>{formatDisplayDate(data?.date || selectedDate)}</div>
                </DetailCard>

                <DetailCard title="Description">
                  <div>{classInfo.description || "No class description"}</div>
                </DetailCard>
              </div>
            </section>

            <section className="panel">
              <SectionHeader
                title="Attendance Roster"
                subtitle="A simple roster view for attendance review."
              />

              {attendanceRows.length === 0 ? (
                <NoticeBox>No attendance roster was returned for this class and date.</NoticeBox>
              ) : (
                <div
                  style={{
                    border: "1px solid #d7dce5",
                    borderRadius: "12px",
                    background: "#ffffff",
                    overflowX: "auto",
                  }}
                >
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", padding: "12px", borderBottom: "1px solid #d7dce5", whiteSpace: "nowrap" }}>
                          Student
                        </th>
                        <th style={{ textAlign: "left", padding: "12px", borderBottom: "1px solid #d7dce5", whiteSpace: "nowrap" }}>
                          Email
                        </th>
                        <th style={{ textAlign: "left", padding: "12px", borderBottom: "1px solid #d7dce5", whiteSpace: "nowrap" }}>
                          Status
                        </th>
                        <th style={{ textAlign: "left", padding: "12px", borderBottom: "1px solid #d7dce5", whiteSpace: "nowrap" }}>
                          Note
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendanceRows.map((student) => (
                        <tr key={student.key}>
                          <td style={{ padding: "12px", borderBottom: "1px solid #e5e7eb", verticalAlign: "top" }}>
                            <div style={{ fontWeight: 700 }}>{student.student_name}</div>
                          </td>
                          <td style={{ padding: "12px", borderBottom: "1px solid #e5e7eb", verticalAlign: "top" }}>
                            {student.student_email}
                          </td>
                          <td style={{ padding: "12px", borderBottom: "1px solid #e5e7eb", verticalAlign: "top", fontWeight: 700 }}>
                            {student.attendance_status}
                          </td>
                          <td style={{ padding: "12px", borderBottom: "1px solid #e5e7eb", verticalAlign: "top" }}>
                            {student.attendance_note}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>
    </>
  );
}
