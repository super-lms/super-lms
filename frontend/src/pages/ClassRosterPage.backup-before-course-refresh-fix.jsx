import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";

const API_BASE = "http://localhost:3000";

const emptyStudentForm = {
  name: "",
  email: "",
  student_id: "",
  parent_email: "",
};

export default function ClassRosterPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [students, setStudents] = useState([]);
  const [statusMessage, setStatusMessage] = useState("Loading courses...");
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [newStudent, setNewStudent] = useState(emptyStudentForm);
  const [enrollmentMessage, setEnrollmentMessage] = useState("");
  const [enrollmentError, setEnrollmentError] = useState("");
  const [enrollmentSaving, setEnrollmentSaving] = useState(false);

  const normalizedRole = String(user?.role || "").trim().toLowerCase();
  const isTeacher = normalizedRole === "teacher";
  const normalizedUserId = String(user?.id || "").trim();
  const normalizedUserEmail = String(user?.email || "").trim().toLowerCase();
  const requestedCourseId = String(searchParams.get("courseId") || "").trim();

  function filterCoursesForCurrentUser(allCourses) {
    const safeCourses = Array.isArray(allCourses) ? allCourses : [];

    if (!isTeacher) {
      return safeCourses;
    }

    return safeCourses.filter((course) => {
      const courseTeacherId = String(course?.teacher_id || "").trim();
      const courseTeacherEmail = String(course?.teacher_email || "")
        .trim()
        .toLowerCase();

      const matchesTeacherId =
        normalizedUserId &&
        courseTeacherId &&
        courseTeacherId === normalizedUserId;

      const matchesTeacherEmail =
        normalizedUserEmail &&
        courseTeacherEmail &&
        courseTeacherEmail === normalizedUserEmail;

      return Boolean(matchesTeacherId || matchesTeacherEmail);
    });
  }

  async function loadRoster(courseId) {
    if (!courseId) {
      setStudents([]);
      return;
    }

    setStudentsLoading(true);
    setStatusMessage("Loading class roster...");

    try {
      const response = await fetch(`${API_BASE}/api/class-roster/${courseId}`);

      if (!response.ok) {
        throw new Error("Failed to load class roster");
      }

      const data = await response.json();
      const safeStudents = Array.isArray(data?.students) ? data.students : [];
      setStudents(safeStudents);
      setStatusMessage("");
    } catch (error) {
      console.error(error);
      setStudents([]);
      setStatusMessage("Failed to load class roster");
    } finally {
      setStudentsLoading(false);
    }
  }

  function updateNewStudent(field, value) {
    setNewStudent((current) => ({
      ...current,
      [field]: value,
    }));
    setEnrollmentMessage("");
    setEnrollmentError("");
  }

  async function handleEnrollStudent(event) {
    event.preventDefault();

    if (!selectedCourseId) {
      setEnrollmentError("Select a course before adding a student.");
      return;
    }

    const trimmedStudent = {
      name: String(newStudent.name || "").trim(),
      email: String(newStudent.email || "").trim().toLowerCase(),
      student_id: String(newStudent.student_id || "").trim(),
      parent_email: String(newStudent.parent_email || "").trim(),
    };

    if (!trimmedStudent.name) {
      setEnrollmentError("Student name is required.");
      return;
    }

    if (!trimmedStudent.email) {
      setEnrollmentError("Student email is required.");
      return;
    }

    setEnrollmentSaving(true);
    setEnrollmentMessage("");
    setEnrollmentError("");

    try {
      const response = await fetch(
        `${API_BASE}/api/class-roster/${selectedCourseId}/students`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(trimmedStudent),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "Failed to enroll student");
      }

      setNewStudent(emptyStudentForm);
      setEnrollmentMessage("Student added to this course.");
      await loadRoster(selectedCourseId);
    } catch (error) {
      console.error(error);
      setEnrollmentError(error.message || "Failed to enroll student.");
    } finally {
      setEnrollmentSaving(false);
    }
  }

  useEffect(() => {
    async function loadCourses() {
      try {
        const response = await fetch(`${API_BASE}/api/courses`);

        if (!response.ok) {
          throw new Error("Failed to load courses");
        }

        const data = await response.json();
        const visibleCourses = filterCoursesForCurrentUser(data);

        setCourses(visibleCourses);

        if (visibleCourses.length === 0) {
          setSelectedCourseId("");
          setStatusMessage("No courses found");
          return;
        }

        const requestedCourseMatch =
          requestedCourseId === ""
            ? null
            : visibleCourses.find(
                (course) => String(course.id) === requestedCourseId
              ) || null;

        if (requestedCourseMatch) {
          setSelectedCourseId(String(requestedCourseMatch.id));
        } else {
          setSelectedCourseId(String(visibleCourses[0].id));
        }

        setStatusMessage("");
      } catch (error) {
        console.error(error);
        setCourses([]);
        setSelectedCourseId("");
        setStatusMessage("Failed to load courses");
      }
    }

    loadCourses();
  }, [requestedCourseId, user?.id, user?.email, user?.role]);

  useEffect(() => {
    setEnrollmentMessage("");
    setEnrollmentError("");
    loadRoster(selectedCourseId);
  }, [selectedCourseId]);

  const selectedCourse = useMemo(() => {
    return (
      courses.find((course) => String(course.id) === String(selectedCourseId)) ||
      null
    );
  }, [courses, selectedCourseId]);

  return (
    <div className="content-area">
      <section className="panel">
        <div className="section-header">
          <div>
            <h2>Class Roster</h2>
            <p className="section-subtitle">
              View student names, emails, parent contacts, and student IDs.
            </p>
          </div>
        </div>

        <div className="form-stack">
          <div className="form-field" style={compactFieldStyle}>
            <label htmlFor="class-roster-course-select" className="form-label">
              Select Course
            </label>
            <select
              id="class-roster-course-select"
              value={selectedCourseId}
              onChange={(event) => setSelectedCourseId(event.target.value)}
              className="form-input"
              disabled={courses.length === 0}
            >
              <option value="">
                {courses.length === 0 ? "No courses available" : "Select a course"}
              </option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </div>

          <div className="summary-grid">
            <div className="summary-card">
              <strong>Selected Course:</strong>{" "}
              {selectedCourse ? selectedCourse.title : "None selected"}
            </div>
            <div className="summary-card">
              <strong>Total Students:</strong> {students.length}
            </div>
          </div>

          <section className="panel-subsection">
            <div className="section-header">
              <div>
                <h3>Add Student Manually</h3>
                <p className="section-subtitle">
                  Enroll one student without uploading a spreadsheet.
                </p>
              </div>
            </div>

            <form onSubmit={handleEnrollStudent} className="form-stack">
              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="manual-student-name" className="form-label">
                    Student Name
                  </label>
                  <input
                    id="manual-student-name"
                    type="text"
                    className="form-input"
                    value={newStudent.name}
                    onChange={(event) =>
                      updateNewStudent("name", event.target.value)
                    }
                    placeholder="Example: Jordan Lee"
                    disabled={!selectedCourseId || enrollmentSaving}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="manual-student-email" className="form-label">
                    Student Email
                  </label>
                  <input
                    id="manual-student-email"
                    type="email"
                    className="form-input"
                    value={newStudent.email}
                    onChange={(event) =>
                      updateNewStudent("email", event.target.value)
                    }
                    placeholder="student@school.ca"
                    disabled={!selectedCourseId || enrollmentSaving}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="manual-student-id" className="form-label">
                    Student ID
                  </label>
                  <input
                    id="manual-student-id"
                    type="text"
                    className="form-input"
                    value={newStudent.student_id}
                    onChange={(event) =>
                      updateNewStudent("student_id", event.target.value)
                    }
                    placeholder="Optional"
                    disabled={!selectedCourseId || enrollmentSaving}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="manual-parent-email" className="form-label">
                    Parent Email
                  </label>
                  <input
                    id="manual-parent-email"
                    type="email"
                    className="form-input"
                    value={newStudent.parent_email}
                    onChange={(event) =>
                      updateNewStudent("parent_email", event.target.value)
                    }
                    placeholder="Optional"
                    disabled={!selectedCourseId || enrollmentSaving}
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  className="primary-btn"
                  disabled={!selectedCourseId || enrollmentSaving}
                >
                  {enrollmentSaving ? "Adding Student..." : "Add Student"}
                </button>
              </div>

              {enrollmentMessage ? (
                <p className="form-message">{enrollmentMessage}</p>
              ) : null}

              {enrollmentError ? (
                <p className="form-message">{enrollmentError}</p>
              ) : null}
            </form>
          </section>

          {statusMessage ? <p className="form-message">{statusMessage}</p> : null}

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Student ID</th>
                  <th>Email</th>
                  <th>Parent Email</th>
                </tr>
              </thead>
              <tbody>
                {!selectedCourseId ? (
                  <tr>
                    <td colSpan="4">Select a course to view the roster.</td>
                  </tr>
                ) : studentsLoading ? (
                  <tr>
                    <td colSpan="4">Loading students...</td>
                  </tr>
                ) : students.length === 0 ? (
                  <tr>
                    <td colSpan="4">No students found for this course.</td>
                  </tr>
                ) : (
                  students.map((student) => (
                    <tr key={student.id}>
                      <td>{student.name || "Unnamed student"}</td>
                      <td>{student.student_id || "Not recorded"}</td>
                      <td>{student.email || "No email"}</td>
                      <td>{student.parent_email || "Not recorded"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

const compactFieldStyle = {
  maxWidth: "420px",
};
