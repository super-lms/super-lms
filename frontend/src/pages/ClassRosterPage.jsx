import { Fragment, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";
import API_BASE from "../apiBase";
import authFetch from "../services/authFetch";
import { printCompactClassRoster, printMultipleClassRosters } from "../services/compactClassRoster.js";
import { buildRosterPrintChoices, rosterPrintEndpoint } from "../services/rosterPrintChoices.js";


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
  const [isMasterRoster, setIsMasterRoster] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Loading courses...");
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [newStudent, setNewStudent] = useState(emptyStudentForm);
  const [enrollmentMessage, setEnrollmentMessage] = useState("");
  const [enrollmentError, setEnrollmentError] = useState("");
  const [enrollmentSaving, setEnrollmentSaving] = useState(false);
  const [removingStudentId, setRemovingStudentId] = useState("");
  const [editingStudentId, setEditingStudentId] = useState("");
  const [editingStudent, setEditingStudent] = useState(emptyStudentForm);
  const [editingStudentSaving, setEditingStudentSaving] = useState(false);
  const [editingStudentError, setEditingStudentError] = useState("");
  const [selectedHomeform, setSelectedHomeform] = useState("");
  const [homeformImporting, setHomeformImporting] = useState(false);
  const [exportingWord, setExportingWord] = useState(false);
  const [exportError, setExportError] = useState("");
  const [printCourseIds, setPrintCourseIds] = useState([]);
  const [batchPrinting, setBatchPrinting] = useState(false);

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
      const sharedTeacherIds = Array.isArray(course?.shared_teacher_ids)
        ? course.shared_teacher_ids.map((teacherId) => String(teacherId))
        : [];
      if (normalizedUserId && sharedTeacherIds.includes(normalizedUserId)) {
        return true;
      }

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
      setIsMasterRoster(false);
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
      setIsMasterRoster(Boolean(data?.is_master_roster));
      setStatusMessage("");
    } catch (error) {
      console.error(error);
      setStudents([]);
      setIsMasterRoster(false);
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

  function startEditingStudent(student) {
    const safeParentEmail =
      String(student.parent_email || "").trim().toLowerCase() === "not recorded"
        ? ""
        : student.parent_email || "";

    setEditingStudentId(String(student.id));
    setEditingStudent({
      name:
        student.name ||
        [student.first_name, student.last_name].filter(Boolean).join(" "),
      email: student.email || "",
      student_id: student.student_id || "",
      parent_email: safeParentEmail,
    });
    setEditingStudentError("");
    setEnrollmentMessage("");
    setEnrollmentError("");
  }

  function updateEditingStudent(field, value) {
    setEditingStudent((current) => ({
      ...current,
      [field]: value,
    }));
    setEditingStudentError("");
    setEnrollmentMessage("");
    setEnrollmentError("");
  }

  function cancelEditingStudent() {
    setEditingStudentId("");
    setEditingStudent(emptyStudentForm);
    setEditingStudentError("");
  }

  async function saveEditedStudent(student) {
    const updatedStudent = {
      name: String(editingStudent.name || "").trim(),
      email: String(editingStudent.email || "").trim().toLowerCase(),
      student_id: String(editingStudent.student_id || "").trim(),
      parent_email: String(editingStudent.parent_email || "").trim().toLowerCase(),
      role: "student",
    };

    if (!updatedStudent.name) {
      setEditingStudentError("Student name is required.");
      return;
    }

    if (!updatedStudent.email) {
      setEditingStudentError("Student email is required.");
      return;
    }

    setEditingStudentSaving(true);
    setEnrollmentMessage("");
    setEnrollmentError("");
    setEditingStudentError("");

    try {
      const response = await authFetch(`/api/users/${student.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatedStudent),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "Failed to update student");
      }

      cancelEditingStudent();
      setEnrollmentMessage(`${updatedStudent.name} was updated.`);
      await loadRoster(selectedCourseId);
    } catch (error) {
      console.error(error);
      setEditingStudentError(error.message || "Failed to update student.");
    } finally {
      setEditingStudentSaving(false);
    }
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
      setEnrollmentMessage(
        data?.already_enrolled
          ? "This student is already enrolled in the selected course."
          : "Student added to this course."
      );
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

        const preferredCourseId = requestedCourseId || storedCourseId;

        if (visibleCourses.length === 0 && !preferredCourseId) {
          setSelectedCourseId("");
          setStatusMessage("No courses found");
          return;
        }

        let requestedCourseMatch =
          preferredCourseId === ""
            ? null
            : visibleCourses.find(
                (course) => String(course.id) === preferredCourseId
              ) || null;

        // An administrator using the teacher workspace may open a section
        // assigned to another teacher. That section is intentionally omitted
        // from the general teacher-workspace course list, but Manage Roster
        // must still remain on the exact section that launched this page.
        let selectableCourses = visibleCourses;
        if (!requestedCourseMatch && preferredCourseId) {
          const rosterResponse = await authFetch(
            `/api/class-roster/${preferredCourseId}?scope=section`
          );

          if (rosterResponse.ok) {
            const rosterData = await rosterResponse.json();
            if (rosterData?.course?.id) {
              requestedCourseMatch = rosterData.course;
              selectableCourses = [rosterData.course, ...visibleCourses];
              setCourses(selectableCourses);
            }
          }
        }

        if (requestedCourseMatch) {
          const matchedCourseId = String(requestedCourseMatch.id);
          setSelectedCourseId(matchedCourseId);
          window.localStorage.setItem(
            "super-lms-class-roster-course-id",
            matchedCourseId
          );
          setSearchParams({ courseId: matchedCourseId });
        } else if (selectableCourses.length > 0) {
          const fallbackCourseId = String(selectableCourses[0].id);
          setSelectedCourseId(fallbackCourseId);
          window.localStorage.setItem(
            "super-lms-class-roster-course-id",
            fallbackCourseId
          );
          setSearchParams({ courseId: fallbackCourseId });
        } else {
          setSelectedCourseId("");
          setStatusMessage("Course not found");
          return;
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
    cancelEditingStudent();
    loadRoster(selectedCourseId);
  }, [selectedCourseId]);

  async function downloadRosterWord() {
    setExportError("");setExportingWord(true);
    try {
      const response=await authFetch(`/api/class-roster/${selectedCourseId}/export.docx`);
      if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.error || "Could not download class roster.");}
      const url=URL.createObjectURL(await response.blob()),link=document.createElement("a");
      link.href=url;link.download=`${selectedCourse?.title || "Class"} Roster.docx`;link.click();
      window.setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(error){setExportError(error.message);}finally{setExportingWord(false);}
  }

  function togglePrintCourse(choiceKey) {
    const id = String(choiceKey);
    setPrintCourseIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id]
    );
    setExportError("");
  }

  async function printSelectedRosters() {
    if (!printCourseIds.length) {
      setExportError("Select at least one class or cohort to print.");
      return;
    }

    setExportError("");
    setBatchPrinting(true);
    try {
      const rosters = await Promise.all(
        printCourseIds.map(async (choiceKey) => {
          const choice = printChoices.find((item) => item.key === choiceKey);
          const course = choice?.course;
          if (!choice) {
            throw new Error("A selected class is no longer available. Clear the selection and try again.");
          }
          const response = await authFetch(rosterPrintEndpoint(choice));
          const data = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(`Could not load ${course?.title || "a selected class"}.`);
          }
          return {
            course: data.course || course,
            students: Array.isArray(data.students) ? data.students : [],
          };
        })
      );
      printMultipleClassRosters(rosters);
    } catch (error) {
      setExportError(error.message || "Could not prepare the selected class lists.");
    } finally {
      setBatchPrinting(false);
    }
  }

  const selectedCourse = useMemo(() => {
    return (
      courses.find((course) => String(course.id) === String(selectedCourseId)) ||
      null
    );
  }, [courses, selectedCourseId]);

  const printChoices = useMemo(() => buildRosterPrintChoices(courses), [courses]);

  return (
    <div className="content-area">
      <section className="panel">
        <div className="section-header">
          <div>
            <h2>Class Roster</h2>
            <p className="section-subtitle">
              View and print Master Class or individual cohort student lists.
            </p>
          </div>
        </div>

        <div className="form-stack">
          <section className="panel-subsection">
            <div className="section-header">
              <div>
                <h3>Print Several Class Lists</h3>
                <p className="section-subtitle">
                  Check the Master Classes or cohorts you need. Each selected list starts on a separate PDF page.
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "12px" }}>
              <button type="button" onClick={() => setPrintCourseIds(printChoices.filter((choice) => choice.scope === "section").map((choice) => choice.key))} disabled={!printChoices.some((choice) => choice.scope === "section")}>
                Select All Cohorts
              </button>
              <button type="button" onClick={() => setPrintCourseIds(printChoices.map((choice) => choice.key))} disabled={!printChoices.length}>
                Select Everything
              </button>
              <button type="button" onClick={() => setPrintCourseIds([])} disabled={!printCourseIds.length}>
                Clear
              </button>
              <button type="button" className="primary-btn" onClick={printSelectedRosters} disabled={!printCourseIds.length || batchPrinting}>
                {batchPrinting ? "Preparing PDF…" : `Print Selected (${printCourseIds.length})`}
              </button>
            </div>
            <div style={printChecklistStyle}>
              {printChoices.map((choice) => (
                <label key={choice.key} style={printChoiceStyle}>
                  <input
                    type="checkbox"
                    checked={printCourseIds.includes(choice.key)}
                    onChange={() => togglePrintCourse(choice.key)}
                  />
                  <span>
                    <strong>{choice.label}</strong><br />
                    <small>{choice.typeLabel}</small>
                  </span>
                </label>
              ))}
            </div>
          </section>

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
                  {course.title}{course.master_course_id ? " — Cohort" : " — Master Class"}
                </option>
              ))}
            </select>
          </div>

          <div style={{display:"flex",gap:"10px",flexWrap:"wrap",margin:"16px 0"}}>
            <button type="button" disabled={!selectedCourse || studentsLoading || !students.length}
              onClick={()=>{setExportError("");try{printCompactClassRoster(selectedCourse,students);}catch(error){setExportError(error.message);}}}>
              Print / Save PDF
            </button>
            <button type="button" disabled={!selectedCourse || studentsLoading || !students.length || exportingWord} onClick={downloadRosterWord}>
              {exportingWord ? "Preparing Word…" : "Download Word"}
            </button>
            <span>One A4 sheet · Student names, IDs and notes</span>
          </div>
          {exportError ? <p role="alert">{exportError}</p> : null}

          <div className="summary-grid">
            <div className="summary-card">
              <strong>Selected Course:</strong>{" "}
              {selectedCourse ? selectedCourse.title : "None selected"}
            </div>
            <div className="summary-card">
              <strong>Total Students:</strong> {students.length}
            </div>
            <div className="summary-card">
              <strong>List Type:</strong> {isMasterRoster ? "Master Class" : "Cohort"}
            </div>
          </div>

          {!isMasterRoster ? <section className="panel-subsection">
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
          </section> : null}

          {!isMasterRoster ? <section className="panel-subsection">
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
          </section> : (
            <section className="panel-subsection">
              <h3>Master Class List</h3>
              <p className="section-subtitle">
                This printable list combines students from every linked cohort. Manage enrollment inside the individual cohort.
              </p>
            </section>
          )}

          {statusMessage ? <p className="form-message">{statusMessage}</p> : null}

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Student ID</th>
                  <th>Email</th>
                  <th>Parent Email</th>
                  {isMasterRoster ? <th>Cohort</th> : <th>Actions</th>}
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
                  students.map((student) => {
                    const isEditing = editingStudentId === String(student.id);

                    return (
                      <Fragment key={student.id}>
                      <tr>
                        <td>
                          {isEditing ? (
                            <input
                              type="text"
                              className="form-input"
                              value={editingStudent.name}
                              onChange={(event) => updateEditingStudent("name", event.target.value)}
                              disabled={editingStudentSaving}
                              aria-label={`Student name for ${student.name || student.email}`}
                            />
                          ) : (
                            student.name || [student.first_name, student.last_name].filter(Boolean).join(" ") || "Unnamed student"
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <input
                              type="text"
                              className="form-input"
                              value={editingStudent.student_id}
                              onChange={(event) => updateEditingStudent("student_id", event.target.value)}
                              disabled={editingStudentSaving}
                              placeholder="Student ID"
                              aria-label={`Student ID for ${student.name || student.email}`}
                            />
                          ) : (
                            student.student_id || "Not recorded"
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <input
                              type="email"
                              className="form-input"
                              value={editingStudent.email}
                              onChange={(event) => updateEditingStudent("email", event.target.value)}
                              disabled={editingStudentSaving}
                              aria-label={`Student email for ${student.name || student.email}`}
                            />
                          ) : (
                            student.email || "No email"
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <input
                              type="email"
                              className="form-input"
                              value={editingStudent.parent_email}
                              onChange={(event) => updateEditingStudent("parent_email", event.target.value)}
                              disabled={editingStudentSaving}
                              placeholder="Optional"
                              aria-label={`Parent email for ${student.name || student.email}`}
                            />
                          ) : (
                            student.parent_email || "Not recorded"
                          )}
                        </td>
                        <td>
                          {isMasterRoster ? (
                            student.section_title || "Master Class"
                          ) : (
                          <div style={actionButtonsStyle}>
                            {isEditing ? (
                              <>
                                <button
                                  type="button"
                                  className="primary-btn"
                                  onClick={() => saveEditedStudent(student)}
                                  disabled={editingStudentSaving}
                                >
                                  {editingStudentSaving ? "Saving..." : "Save"}
                                </button>
                                <button
                                  type="button"
                                  className="secondary-btn"
                                  onClick={cancelEditingStudent}
                                  disabled={editingStudentSaving}
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                {isAdmin ? (
                                  <button
                                    type="button"
                                    className="secondary-btn"
                                    onClick={() => startEditingStudent(student)}
                                    disabled={Boolean(editingStudentId) || Boolean(removingStudentId)}
                                  >
                                    Edit
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  className="secondary-btn"
                                  onClick={() => handleRemoveStudent(student)}
                                  disabled={Boolean(editingStudentId) || removingStudentId === String(student.id)}
                                >
                                  {removingStudentId === String(student.id)
                                    ? "Removing..."
                                    : "Remove"}
                                </button>
                              </>
                            )}
                          </div>
                          )}
                        </td>
                      </tr>
                      {isEditing && editingStudentError ? (
                        <tr>
                          <td colSpan="5">
                            <div className="form-message" role="alert" style={editErrorStyle}>
                              {editingStudentError}
                            </div>
                          </td>
                        </tr>
                      ) : null}
                      </Fragment>
                    );
                  })
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

const printChecklistStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
  gap: "10px",
  maxHeight: "360px",
  overflowY: "auto",
  padding: "4px",
};

const printChoiceStyle = {
  display: "flex",
  alignItems: "flex-start",
  gap: "10px",
  padding: "12px",
  border: "1px solid #d7dde8",
  borderRadius: "10px",
  background: "#fff",
  cursor: "pointer",
};

const actionButtonsStyle = {
  display: "flex",
  gap: "8px",
  alignItems: "center",
  flexWrap: "wrap",
};

const editErrorStyle = {
  color: "#b91c1c",
  fontWeight: 700,
  margin: 0,
};
