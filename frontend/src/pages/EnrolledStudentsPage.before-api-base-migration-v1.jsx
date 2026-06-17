import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

const API_BASE = "http://localhost:3000";

export default function EnrolledStudentsPage() {
  const navigate = useNavigate();
  const { studentId: routeStudentId = "" } = useParams();

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/api/enrolled-students`)
      .then((res) => res.json())
      .then((data) => {
        setStudents(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error loading enrolled students:", error);
        setStudents([]);
        setLoading(false);
      });
  }, []);

  const matchedRouteStudent = useMemo(() => {
    if (!routeStudentId) {
      return null;
    }

    return (
      students.find((student) => String(student.id) === String(routeStudentId)) || null
    );
  }, [students, routeStudentId]);

  useEffect(() => {
    if (!matchedRouteStudent) {
      return;
    }

    const nextSearchValue = String(matchedRouteStudent.student_name || "").trim();

    if (nextSearchValue) {
      setSearchText(nextSearchValue);
    }
  }, [matchedRouteStudent]);

  const filteredStudents = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    if (!query) return students;

    return students.filter((student) => {
      const name = (student.student_name || "").toLowerCase();
      const email = (student.student_email || "").toLowerCase();

      return name.includes(query) || email.includes(query);
    });
  }, [students, searchText]);

  const totalStudents = students.length;
  const visibleStudents = filteredStudents.length;
  const hasSearch = searchText.trim().length > 0;
  const hasRouteStudent = Boolean(routeStudentId);
  const routeStudentFound = Boolean(matchedRouteStudent);

  return (
    <>
      <div className="topbar">
        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          style={{
            marginBottom: "12px",
            border: "1px solid #d0d7de",
            borderRadius: "10px",
            background: "#ffffff",
            padding: "10px 14px",
            font: "inherit",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          ← Back to Dashboard
        </button>

        <h1>Enrolled Students</h1>
        <p className="topbar-subtitle">
          Roster directory for students saved through Class Enrollment
        </p>
      </div>

      <div className="content-area">
        {hasRouteStudent ? (
          <section className="panel">
            <div
              style={{
                border: "1px solid #d0d7de",
                borderRadius: "14px",
                background: "#ffffff",
                padding: "18px",
                boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)",
                display: "grid",
                gap: "8px",
              }}
            >
              <div
                style={{
                  fontSize: "0.82rem",
                  fontWeight: 800,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: "#4b5563",
                }}
              >
                Direct Student Route
              </div>

              {loading ? (
                <div style={{ fontWeight: 700 }}>Loading selected student...</div>
              ) : routeStudentFound ? (
                <>
                  <div style={{ fontWeight: 800, fontSize: "1.1rem" }}>
                    Focused on: {matchedRouteStudent.student_name}
                  </div>
                  <div
                    style={{
                      fontSize: "0.95rem",
                      color: "#4b5563",
                      lineHeight: 1.5,
                    }}
                  >
                    This page was opened for student ID {matchedRouteStudent.id}. The matching
                    row is highlighted below.
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontWeight: 800, fontSize: "1.1rem" }}>
                    Student not found
                  </div>
                  <div
                    style={{
                      fontSize: "0.95rem",
                      color: "#4b5563",
                      lineHeight: 1.5,
                    }}
                  >
                    No enrolled student record matched route ID {routeStudentId}.
                  </div>
                </>
              )}
            </div>
          </section>
        ) : null}

        <section
          className="panel"
          style={{
            display: "grid",
            gap: "18px",
          }}
        >
          <div
            style={{
              display: "grid",
              gap: "10px",
            }}
          >
            <div
              style={{
                fontSize: "0.82rem",
                fontWeight: 800,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: "#4b5563",
              }}
            >
              Roster Directory
            </div>

            <h2
              style={{
                margin: 0,
                fontSize: "1.8rem",
                fontWeight: 800,
                lineHeight: 1.2,
              }}
            >
              Student enrollment records
            </h2>

            <p
              style={{
                margin: 0,
                fontSize: "1rem",
                lineHeight: 1.6,
                color: "#4b5563",
                maxWidth: "760px",
              }}
            >
              This page confirms which students are available in the teacher-facing roster,
              gradebook, and reporting flows.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: "16px",
            }}
          >
            <div
              style={{
                border: "1px solid #d0d7de",
                borderRadius: "14px",
                background: "#ffffff",
                padding: "18px",
                boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)",
              }}
            >
              <div
                style={{
                  fontSize: "0.82rem",
                  fontWeight: 800,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: "#4b5563",
                  marginBottom: "10px",
                }}
              >
                Total Students
              </div>
              <div style={{ fontSize: "2rem", fontWeight: 800, lineHeight: 1 }}>
                {loading ? "..." : totalStudents}
              </div>
              <div
                style={{
                  marginTop: "10px",
                  fontSize: "0.95rem",
                  color: "#4b5563",
                  lineHeight: 1.4,
                }}
              >
                All roster entries loaded from enrollment data
              </div>
            </div>

            <div
              style={{
                border: "1px solid #d0d7de",
                borderRadius: "14px",
                background: "#ffffff",
                padding: "18px",
                boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)",
              }}
            >
              <div
                style={{
                  fontSize: "0.82rem",
                  fontWeight: 800,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: "#4b5563",
                  marginBottom: "10px",
                }}
              >
                Visible Results
              </div>
              <div style={{ fontSize: "2rem", fontWeight: 800, lineHeight: 1 }}>
                {loading ? "..." : visibleStudents}
              </div>
              <div
                style={{
                  marginTop: "10px",
                  fontSize: "0.95rem",
                  color: "#4b5563",
                  lineHeight: 1.4,
                }}
              >
                Students currently shown in the directory table
              </div>
            </div>

            <div
              style={{
                border: "1px solid #d0d7de",
                borderRadius: "14px",
                background: "#ffffff",
                padding: "18px",
                boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)",
              }}
            >
              <div
                style={{
                  fontSize: "0.82rem",
                  fontWeight: 800,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: "#4b5563",
                  marginBottom: "10px",
                }}
              >
                Search Status
              </div>
              <div style={{ fontSize: "1.35rem", fontWeight: 800, lineHeight: 1.2 }}>
                {loading ? "Loading..." : hasSearch ? "Filtered view" : "Full roster"}
              </div>
              <div
                style={{
                  marginTop: "10px",
                  fontSize: "0.95rem",
                  color: "#4b5563",
                  lineHeight: 1.4,
                }}
              >
                {loading
                  ? "Preparing student records"
                  : hasSearch
                    ? `Search active for: ${searchText}`
                    : "Showing all enrolled students"}
              </div>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="section-header">
            <div>
              <h2>Search Students</h2>
              <p className="section-subtitle">
                Search by student name or email
              </p>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gap: "12px",
              maxWidth: "540px",
            }}
          >
            <div className="form-field form-field-narrow" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="student-search">
                Search
              </label>
              <input
                id="student-search"
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="form-input"
                placeholder="Example: David or david@email.com"
              />
            </div>

            <div
              style={{
                fontSize: "0.95rem",
                color: "#4b5563",
                lineHeight: 1.4,
              }}
            >
              {loading
                ? "Loading roster records..."
                : hasSearch
                  ? `Showing ${visibleStudents} of ${totalStudents} students`
                  : `Showing all ${totalStudents} enrolled students`}
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="section-header">
            <div>
              <h2>Student Directory</h2>
              <p className="section-subtitle">
                Confirm student identity links for reports and gradebook
              </p>
            </div>
          </div>

          {loading ? (
            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: "12px",
                background: "#ffffff",
                padding: "18px",
              }}
            >
              <p style={{ margin: 0 }}>Loading enrolled students...</p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: "12px",
                background: "#ffffff",
                padding: "18px",
                display: "grid",
                gap: "8px",
              }}
            >
              <div style={{ fontWeight: 800 }}>
                {hasSearch ? "No matching students found." : "No enrolled students found."}
              </div>
              <div
                style={{
                  fontSize: "0.95rem",
                  color: "#4b5563",
                  lineHeight: 1.4,
                }}
              >
                {hasSearch
                  ? "Try a different student name or email."
                  : "No student records are available from Class Enrollment yet."}
              </div>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>Student Email</th>
                    <th>Student ID</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student) => {
                    const isRouteStudent =
                      String(student.id) === String(routeStudentId);

                    return (
                      <tr
                        key={student.id}
                        style={
                          isRouteStudent
                            ? {
                                background: "#f8fafc",
                                boxShadow: "inset 4px 0 0 #111827",
                              }
                            : undefined
                        }
                      >
                        <td>{student.student_name}</td>
                        <td>{student.student_email}</td>
                        <td>{student.id}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <p className="table-footer">
            Total visible students: {loading ? "..." : visibleStudents}
          </p>
        </section>
      </div>
    </>
  );
}