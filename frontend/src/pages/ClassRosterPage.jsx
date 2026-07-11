import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";
import API_BASE from "../apiBase";
import authFetch from "../services/authFetch";


const emptyStudentForm = {
  name: "",
  email: "",
  student_id: "",
  parent_email: "",
};

export default function ClassRosterPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [students, setStudents] = useState([]);
  const [statusMessage, setStatusMessage] = useState("Loading courses...");
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [newStudent, setNewStudent] = useState(emptyStudentForm);
  const [enrollmentMessage, setEnrollmentMessage] = useState("");
  const [enrollmentError, setEnrollmentError] = useState("");
  const [enrollmentSaving, setEnrollmentSaving] = useState(false);
  const [removingStudentId, setRemovingStudentId] = useState("");
  const [selectedHomeform, setSelectedHomeform] = useState("");
  const [homeformImporting, setHomeformImporting] = useState(false);

  const normalizedRole = String(user?.role || "").trim().toLowerCase();
  const isTeacher = normalizedRole === "teacher";
  const isAdmin = normalizedRole === "admin";
  const normalizedUserId = String(user?.id || "").trim();
  const normalizedUserEmail = String(user?.email || "").trim().toLowerCase();
  const requestedCourseId = String(searchParams.get("courseId") || "").trim();
  const storedCourseId = String(
    window.localStorage.getItem("super-lms-class-roster-course-id") || ""
  ).trim();

  function filterCoursesForCurrentUser(allCourses) {
    const safeCourses = Array.isArray(allCourses) ? allCourses : [];

    if (isAdmin) {
      return safeCourses;
    }

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
      const response = await authFetch(`/api/class-roster/${courseId}`);

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

  async function handleRemoveStudent(student) {
    if (!selectedCourseId || !student?.id) {
      return;
    }

    const studentName = student.name || student.email || "this student";
    const confirmed = window.confirm(
      `Remove ${studentName} from this course? This will not delete the student account.`
    );

    if (!confirmed) {
      return;
    }

    setRemovingStudentId(String(student.id));
    setEnrollmentMessage("");
    setEnrollmentError("");

    try {
      const response = await authFetch(
        `/api/class-roster/${selectedCourseId}/students/${student.id}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "Failed to remove student");
      }

      setEnrollmentMessage("Student removed from this course.");
      await loadRoster(selectedCourseId);
    } catch (error) {
      console.error(error);
      setEnrollmentError(error.message || "Failed to remove student.");
    } finally {
      setRemovingStudentId("");
    }
  }

  async function handleImportHomeform() {
    if (!selectedCourseId) {
      setEnrollmentError("Select a course before importing a homeform.");
      return;
    }

    if (!selectedHomeform) {
      setEnrollmentError("Select a homeform to import.");
      return;
    }

    setHomeformImporting(true);
    setEnrollmentMessage("");
    setEnrollmentError("");

    try {
      const response = await authFetch(
        `/api/class-roster/${selectedCourseId}/import-homeform`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ homeform: selectedHomeform }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "Failed to import homeform");
      }

      setEnrollmentMessage(
        `Imported ${data.enrolled_students || 0} new students from ${selectedHomeform}. Processed ${data.processed_master_students || 0} students.`
      );
      await loadRoster(selectedCourseId);
    } catch (error) {
      console.error(error);
      setEnrollmentError(error.message || "Failed to import homeform.");
    } finally {
      setHomeformImporting(false);
    }
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
      const response = await authFetch(
        `/api/class-roster/${selectedCourseId}/students`,
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
        const response = await authFetch(`/api/courses`);

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

        const preferredCourseId = requestedCourseId || storedCourseId;

        const requestedCourseMatch =
          preferredCourseId === ""
            ? null
            : visibleCourses.find(
                (course) => String(course.id) === preferredCourseId
              ) || null;

        if (requestedCourseMatch) {
          const matchedCourseId = String(requestedCourseMatch.id);
          setSelectedCourseId(matchedCourseId);
          window.localStorage.setItem(
            "super-lms-class-roster-course-id",
            matchedCourseId
          );
          setSearchParams({ courseId: matchedCourseId });
        } else {
          const fallbackCourseId = String(visibleCourses[0].id);
          setSelectedCourseId(fallbackCourseId);
          window.localStorage.setItem(
            "super-lms-class-roster-course-id",
            fallbackCourseId
          );
          setSearchParams({ courseId: fallbackCourseId });
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
              onChange={(event) => {
                const nextCourseId = event.target.value;
                setSelectedCourseId(nextCourseId);

                if (nextCourseId) {
                  window.localStorage.setItem(
                    "super-lms-class-roster-course-id",
                    nextCourseId
                  );
                  setSearchParams({ courseId: nextCourseId });
                } else {
                  window.localStorage.removeItem(
                    "super-lms-class-roster-course-id"
                  );
                  setSearchParams({});
                }
              }}
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
                <h3>Import Homeform</h3>
                <p className="section-subtitle">
                  Build this course roster from assigned homeforms such as 10A, 11B, or 12C.
                </p>
              </div>
            </div>

            <div className="form-grid">
              <div className="form-field">
                <label htmlFor="homeform-import-select" className="form-label">
                  Homeform
                </label>
                <select
                  id="homeform-import-select"
                  className="form-input"
                  value={selectedHomeform}
                  onChange={(event) => {
                    setSelectedHomeform(event.target.value);
                    setEnrollmentMessage("");
                    setEnrollmentError("");
                  }}
                  disabled={!selectedCourseId || homeformImporting}
                >
                  <option value="">Select a homeform</option>
                  <option value="10A">10A</option>
                  <option value="10B">10B</option>
                  <option value="10C">10C</option>
                  <option value="11A">11A</option>
                  <option value="11B">11B</option>
                  <option value="11C">11C</option>
                  <option value="12A">12A</option>
                  <option value="12B">12B</option>
                  <option value="12C">12C</option>
                </select>
              </div>

              <div className="form-field">
                <label className="form-label">Action</label>
                <button
                  type="button"
                  className="primary-btn"
                  onClick={handleImportHomeform}
                  disabled={!selectedCourseId || !selectedHomeform || homeformImporting}
                >
                  {homeformImporting ? "Importing Homeform..." : "Import Homeform"}
                </button>
              </div>
            </div>
          </section>

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
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {!selectedCourseId ? (
                  <tr>
                    <td colSpan="5">Select a course to view the roster.</td>
                  </tr>
                ) : studentsLoading ? (
                  <tr>
                    <td colSpan="5">Loading students...</td>
                  </tr>
                ) : students.length === 0 ? (
                  <tr>
                    <td colSpan="5">No students found for this course.</td>
                  </tr>
                ) : (
                  students.map((student) => (
                    <tr key={student.id}>
                      <td>{student.name || [student.first_name, student.last_name].filter(Boolean).join(" ") || "Unnamed student"}</td>
                      <td>{student.student_id || "Not recorded"}</td>
                      <td>{student.email || "No email"}</td>
                      <td>{student.parent_email || "Not recorded"}</td>
                      <td>
                        <button
                          type="button"
                          className="secondary-btn"
                          onClick={() => handleRemoveStudent(student)}
                          disabled={removingStudentId === String(student.id)}
                        >
                          {removingStudentId === String(student.id)
                            ? "Removing..."
                            : "Remove"}
                        </button>
                      </td>
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
